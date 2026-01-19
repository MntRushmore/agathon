import { useEffect, useRef, useState, useCallback } from 'react';
import { Editor, TLShapeId, TLDrawShape } from 'tldraw';
import {
  convertTldrawShapeToIinkStrokes,
  getDrawShapes,
  groupShapesByProximity,
  hashStrokes,
  recognizeStrokes,
  IinkStroke,
  RecognitionResult,
} from '@/lib/services/handwriting-recognition';

interface UseHandwritingRecognitionOptions {
  editor: Editor | null;
  enabled: boolean;
  debounceMs?: number;
  contentType?: 'MATH' | 'TEXT';
}

interface UseHandwritingRecognitionReturn {
  isRecognizing: boolean;
  results: RecognitionResult[];
  lastRecognizedShapeIds: Set<TLShapeId>;
  clearResults: () => void;
  recognizeNow: () => Promise<void>;
}

export function useHandwritingRecognition({
  editor,
  enabled,
  debounceMs = 2000,
  contentType = 'MATH',
}: UseHandwritingRecognitionOptions): UseHandwritingRecognitionReturn {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [results, setResults] = useState<RecognitionResult[]>([]);
  const [lastRecognizedShapeIds, setLastRecognizedShapeIds] = useState<Set<TLShapeId>>(new Set());

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, RecognitionResult>>(new Map());
  const lastShapeHashRef = useRef<string>('');

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  const recognizeNow = useCallback(async () => {
    if (!editor || !enabled) return;

    const drawShapes = getDrawShapes(editor);
    if (drawShapes.length === 0) {
      setResults([]);
      return;
    }

    // Group shapes by proximity for batch recognition
    const shapeGroups = groupShapesByProximity(drawShapes);

    // Convert all shapes to strokes and create a hash
    const allStrokes: IinkStroke[] = [];
    const allShapeIds: TLShapeId[] = [];

    for (const shape of drawShapes) {
      const strokes = convertTldrawShapeToIinkStrokes(shape);
      allStrokes.push(...strokes);
      allShapeIds.push(shape.id);
    }

    if (allStrokes.length === 0) {
      setResults([]);
      return;
    }

    // Check if shapes have changed since last recognition
    const currentHash = hashStrokes(allStrokes);
    if (currentHash === lastShapeHashRef.current) {
      return; // No changes, skip recognition
    }

    // Check cache
    if (cacheRef.current.has(currentHash)) {
      const cachedResult = cacheRef.current.get(currentHash)!;
      setResults([{ ...cachedResult, shapeIds: allShapeIds }]);
      setLastRecognizedShapeIds(new Set(allShapeIds));
      lastShapeHashRef.current = currentHash;
      return;
    }

    setIsRecognizing(true);

    try {
      // Recognize all strokes together for math (more context = better recognition)
      const result = await recognizeStrokes(allStrokes, contentType);

      if (result) {
        const fullResult = { ...result, shapeIds: allShapeIds };

        // Cache the result
        cacheRef.current.set(currentHash, fullResult);

        // Limit cache size
        if (cacheRef.current.size > 100) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) cacheRef.current.delete(firstKey);
        }

        setResults([fullResult]);
        setLastRecognizedShapeIds(new Set(allShapeIds));
        lastShapeHashRef.current = currentHash;
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Recognition error:', error);
      setResults([]);
    } finally {
      setIsRecognizing(false);
    }
  }, [editor, enabled, contentType]);

  // Listen to editor changes and debounce recognition
  useEffect(() => {
    if (!editor || !enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const resetTimer = () => {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        recognizeNow();
      }, debounceMs);
    };

    // Listen to draw shape changes specifically
    const handleChange = (event: any) => {
      // Check if any draw shapes were modified
      const changes = event.changes;
      if (!changes) return;

      const hasDrawChanges =
        (changes.added && Object.values(changes.added).some((s: any) => s.type === 'draw')) ||
        (changes.updated && Object.values(changes.updated).some((u: any) => u[1]?.type === 'draw')) ||
        (changes.removed && Object.values(changes.removed).some((s: any) => s.type === 'draw'));

      if (hasDrawChanges) {
        resetTimer();
      }
    };

    const dispose = editor.store.listen(handleChange, {
      source: 'user',
      scope: 'document',
    });

    return () => {
      clearTimer();
      dispose();
    };
  }, [editor, enabled, debounceMs, recognizeNow]);

  // Clear results when disabled
  useEffect(() => {
    if (!enabled) {
      clearResults();
      lastShapeHashRef.current = '';
    }
  }, [enabled, clearResults]);

  return {
    isRecognizing,
    results,
    lastRecognizedShapeIds,
    clearResults,
    recognizeNow,
  };
}
