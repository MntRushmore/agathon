'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toRichText } from '@tldraw/tlschema';
import { createShapeId, Editor } from 'tldraw';

// MyScript iink-ts types
interface StrokeData {
  x: number[];
  y: number[];
  t: number[];
  p?: number[];
}

interface MyScriptConfig {
  applicationKey: string;
  hmacKey: string;
}

interface RecognitionResult {
  latex?: string;
  mathml?: string;
  value?: string | number;
}

interface MyScriptMathOverlayProps {
  editor: Editor | null;
  enabled: boolean;
  onResult?: (result: RecognitionResult) => void;
}

// Simple HMAC-SHA-512 implementation for MyScript authentication
async function computeHmac(message: string, applicationKey: string, hmacKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(`${applicationKey}${hmacKey}`);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function MyScriptMathOverlay({ editor, enabled, onResult }: MyScriptMathOverlayProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const strokesRef = useRef<StrokeData[]>([]);
  const currentStrokeRef = useRef<StrokeData | null>(null);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastShapeCountRef = useRef(0);
  const authFailedRef = useRef(false);
  const missingConfigWarnedRef = useRef(false);

  // Get MyScript credentials from environment (passed via props or context in real impl)
  const config: MyScriptConfig = {
    applicationKey: process.env.NEXT_PUBLIC_MYSCRIPT_APP_KEY || '',
    hmacKey: process.env.NEXT_PUBLIC_MYSCRIPT_HMAC_KEY || '',
  };

  // Extract stroke data from tldraw draw shapes
  const extractStrokesFromEditor = useCallback(() => {
    if (!editor) return [];

    const shapes = editor.getCurrentPageShapes();
    const strokes: StrokeData[] = [];

    shapes.forEach((shape) => {
      // Only process draw shapes (not text, images, etc.)
      if (shape.type === 'draw' && !shape.meta?.aiGenerated) {
        const drawShape = shape as any;
        const segments = drawShape.props?.segments || [];

        segments.forEach((segment: any) => {
          if (segment.type === 'free' && segment.points?.length > 0) {
            const stroke: StrokeData = {
              x: [],
              y: [],
              t: [],
              p: [],
            };

            segment.points.forEach((point: any, index: number) => {
              // Transform from shape-local coords to page coords
              stroke.x.push(shape.x + point.x);
              stroke.y.push(shape.y + point.y);
              // Generate timestamps (MyScript needs them for velocity analysis)
              stroke.t.push(Date.now() - (segment.points.length - index) * 10);
              stroke.p?.push(point.z || 0.5); // Pressure
            });

            if (stroke.x.length > 0) {
              strokes.push(stroke);
            }
          }
        });
      }
    });

    return strokes;
  }, [editor]);

  // Send strokes to MyScript for recognition
  const recognizeStrokes = useCallback(async (strokes: StrokeData[]) => {
    if (strokes.length === 0) {
      return null;
    }

    if (!config.applicationKey || !config.hmacKey) {
      if (!missingConfigWarnedRef.current) {
        console.warn('MyScript disabled: missing NEXT_PUBLIC_MYSCRIPT_APP_KEY or NEXT_PUBLIC_MYSCRIPT_HMAC_KEY');
        missingConfigWarnedRef.current = true;
      }
      return null;
    }

    if (authFailedRef.current) {
      return null;
    }

    setIsProcessing(true);

    try {
      // Build the request body for MyScript batch API
      const requestBody = {
        xDPI: 96,
        yDPI: 96,
        contentType: 'Math',
        conversionState: 'DIGITAL_EDIT',
        strokeGroups: [
          {
            strokes: strokes.map(stroke => ({
              x: stroke.x,
              y: stroke.y,
              t: stroke.t,
              p: stroke.p,
            })),
          },
        ],
      };

      const bodyString = JSON.stringify(requestBody);
      const hmac = await computeHmac(bodyString, config.applicationKey, config.hmacKey);

      const response = await fetch('https://cloud.myscript.com/api/v4.0/iink/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.myscript.jiix',
          'applicationKey': config.applicationKey,
          'hmac': hmac,
        },
        body: bodyString,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          if (!authFailedRef.current) {
            console.error('MyScript API unauthorized:', errorText);
            authFailedRef.current = true;
          }
        } else {
          console.error('MyScript API error:', response.status, errorText);
        }
        return null;
      }

      const result = await response.json();

      // Extract the recognized expression and solution
      // JIIX format contains 'label' (LaTeX) and 'value' (computed result)
      const recognition: RecognitionResult = {
        latex: result.expressions?.[0]?.label || result.label,
        value: result.expressions?.[0]?.value ?? result.value,
      };

      return recognition;
    } catch (error) {
      console.error('MyScript recognition error:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [config.applicationKey, config.hmacKey]);

  // Display the result on the canvas
  const displayResult = useCallback((result: RecognitionResult) => {
    if (!editor || !result.value) return;

    const viewportBounds = editor.getViewportPageBounds();
    const shapes = editor.getCurrentPageShapes();
    const userShapes = shapes.filter((s: any) => s.type === 'draw' && !s.meta?.aiGenerated);

    // Find the rightmost point of user drawings
    let maxX = viewportBounds.x;
    let avgY = viewportBounds.y + viewportBounds.height / 2;

    if (userShapes.length > 0) {
      const lastShape = userShapes[userShapes.length - 1];
      const bounds = editor.getShapePageBounds(lastShape);
      if (bounds) {
        maxX = bounds.maxX;
        avgY = bounds.y + bounds.height / 2;
      }
    }

    // Create text shape with the answer
    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'text',
      x: maxX + 30,
      y: avgY - 20,
      isLocked: true,
      props: {
        richText: toRichText(`= ${result.value}`),
        size: 'l',
        color: 'light-blue',
        font: 'draw',
      },
      meta: {
        aiGenerated: true,
        aiMode: 'myscript-quick',
        aiTimestamp: new Date().toISOString(),
        latex: result.latex,
      },
    });

    onResult?.(result);
  }, [editor, onResult]);

  // Watch for drawing changes and trigger recognition
  useEffect(() => {
    if (!editor || !enabled) return;

    const handleChange = () => {
      const shapes = editor.getCurrentPageShapes();
      const drawShapes = shapes.filter((s: any) => s.type === 'draw' && !s.meta?.aiGenerated);

      // Only trigger if we have new strokes
      if (drawShapes.length === lastShapeCountRef.current) return;
      lastShapeCountRef.current = drawShapes.length;

      // Debounce recognition - wait 500ms after last change
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      recognitionTimeoutRef.current = setTimeout(async () => {
        const strokes = extractStrokesFromEditor();
        if (strokes.length > 0) {
          const result = await recognizeStrokes(strokes);
          if (result && result.value !== undefined && result.value !== null) {
            displayResult(result);
          }
        }
      }, 500); // 500ms debounce - much faster than 2s!
    };

    // Subscribe to editor changes
    const unsubscribe = editor.store.listen(handleChange, { source: 'user' });

    return () => {
      unsubscribe();
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, [editor, enabled, extractStrokesFromEditor, recognizeStrokes, displayResult]);

  // No visible UI - this is an overlay that just processes
  return null;
}
