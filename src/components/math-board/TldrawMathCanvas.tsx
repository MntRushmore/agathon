'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  Editor,
  TLUiOverrides,
  TLUiComponents,
  TLShapeId,
} from 'tldraw';
import 'tldraw/tldraw.css';

export interface EquationResult {
  id: string;
  recognized: string;
  solution: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface TldrawMathCanvasProps {
  onRecognitionRequest: (imageData: string, bounds: { x: number; y: number; width: number; height: number }) => Promise<{ recognized: string; solution: string } | null>;
  onEquationsChange?: (equations: EquationResult[]) => void;
}

export interface TldrawMathCanvasRef {
  getCanvasImage: () => Promise<string>;
  getEditor: () => Editor | null;
}

export const TldrawMathCanvas = React.forwardRef<TldrawMathCanvasRef, TldrawMathCanvasProps>(({
  onRecognitionRequest,
  onEquationsChange,
}, ref) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [equations, setEquations] = useState<EquationResult[]>([]);
  const lastProcessedShapesRef = useRef<string>('');
  const isProcessingRef = useRef(false);

  React.useImperativeHandle(ref, () => ({
    getCanvasImage: async () => {
      if (!editor) return '';
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) return '';

      try {
        const svg = await editor.getSvgString([...shapeIds]);
        if (!svg) return '';

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        return new Promise((resolve) => {
          img.onload = () => {
            canvas.width = img.width || 800;
            canvas.height = img.height || 600;
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve('');
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.svg)));
        });
      } catch {
        return '';
      }
    },
    getEditor: () => editor,
  }));

  // Recognition function - completely silent, no UI feedback
  const triggerRecognition = useCallback(async () => {
    if (!editor || isProcessingRef.current) return;

    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) return;

    // Get all draw shapes (filter out text/solution shapes)
    const drawShapeIds = [...shapeIds].filter(id => {
      const shape = editor.getShape(id);
      return shape && shape.type === 'draw';
    });
    if (drawShapeIds.length === 0) return;

    // Create a signature of current shapes to avoid re-processing
    const shapesSignature = drawShapeIds.sort().join(',');
    if (shapesSignature === lastProcessedShapesRef.current) return;

    isProcessingRef.current = true;

    try {
      // Get combined bounds of all draw shapes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      drawShapeIds.forEach(id => {
        const bounds = editor.getShapePageBounds(id);
        if (bounds) {
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
        }
      });

      if (minX === Infinity) {
        isProcessingRef.current = false;
        return;
      }

      const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

      // Export drawing as PNG
      const svg = await editor.getSvgString(drawShapeIds);
      if (!svg) {
        isProcessingRef.current = false;
        return;
      }

      const imageData = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
          // Add padding and ensure minimum size
          const padding = 40;
          canvas.width = Math.max(img.width + padding * 2, 200);
          canvas.height = Math.max(img.height + padding * 2, 100);

          // White background
          ctx!.fillStyle = 'white';
          ctx!.fillRect(0, 0, canvas.width, canvas.height);
          ctx!.drawImage(img, padding, padding);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load SVG'));
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.svg)));
      });

      // Call recognition API (silently)
      const result = await onRecognitionRequest(imageData, bounds);

      if (result && result.solution) {
        // Mark as processed
        lastProcessedShapesRef.current = shapesSignature;

        // Remove any existing solution text shapes
        const existingSolutions = [...editor.getCurrentPageShapeIds()]
          .filter(id => {
            const shape = editor.getShape(id);
            return shape && shape.type === 'text' && (shape.meta as any)?.isSolution;
          });

        if (existingSolutions.length > 0) {
          editor.deleteShapes(existingSolutions);
        }

        // Format solution text
        let displayText = result.solution;
        if (!displayText.startsWith('=') && !displayText.includes('=')) {
          displayText = `= ${displayText}`;
        }

        // Add solution as locked text shape to the right of the equation
        const solutionX = maxX + 30;
        const solutionY = minY + (maxY - minY) / 2 - 20;

        editor.createShape({
          type: 'text',
          x: solutionX,
          y: solutionY,
          isLocked: true,
          props: {
            text: displayText,
            color: 'light-blue',
            size: 'l',
            font: 'draw',
          },
          meta: {
            isSolution: true,
          },
        });

        // Update equations state
        const newEquation: EquationResult = {
          id: crypto.randomUUID(),
          recognized: result.recognized,
          solution: displayText,
          bounds,
        };

        setEquations(prev => {
          const updated = [...prev.filter(e =>
            Math.abs(e.bounds.y - bounds.y) > 50
          ), newEquation];
          onEquationsChange?.(updated);
          return updated;
        });
      }
    } catch (error) {
      console.error('Recognition error:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [editor, onRecognitionRequest, onEquationsChange]);

  // Listen for editor changes - trigger recognition after user stops drawing
  useEffect(() => {
    if (!editor) return;

    const scheduleRecognition = () => {
      // Clear any pending timeout
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      // Schedule recognition after 2 seconds of inactivity
      recognitionTimeoutRef.current = setTimeout(() => {
        triggerRecognition();
      }, 2000);
    };

    // Listen to store changes
    const dispose = editor.store.listen(
      () => {
        // Only schedule if there are draw shapes
        const hasDrawShapes = [...editor.getCurrentPageShapeIds()].some(id => {
          const shape = editor.getShape(id);
          return shape && shape.type === 'draw';
        });

        if (hasDrawShapes) {
          scheduleRecognition();
        }
      },
      { source: 'user', scope: 'document' }
    );

    return () => {
      dispose();
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, [editor, triggerRecognition]);

  const handleMount = useCallback((newEditor: Editor) => {
    setEditor(newEditor);
    newEditor.setCurrentTool('draw');
  }, []);

  // Custom UI - minimal toolbar
  const uiOverrides: TLUiOverrides = {
    tools(editor, tools) {
      return {
        select: tools.select,
        draw: tools.draw,
        eraser: tools.eraser,
      };
    },
  };

  const components: TLUiComponents = {
    PageMenu: null,
    MainMenu: null,
    QuickActions: null,
    HelpMenu: null,
    ActionsMenu: null,
  };

  return (
    <div className="w-full h-full absolute inset-0" style={{ touchAction: 'none' }}>
      <Tldraw
        licenseKey="tldraw-2026-03-19/WyJSZHJJZ3NSWCIsWyIqIl0sMTYsIjIwMjYtMDMtMTkiXQ.8X9Dhayg/Q1F82ArvwNCMl//yOg8tTOTqLIfhMAySFKg50Wq946/jip5Qved7oDYoVA+YWYTNo4/zQEPK2+neQ"
        onMount={handleMount}
        overrides={uiOverrides}
        components={components}
        inferDarkMode={false}
      />
    </div>
  );
});

TldrawMathCanvas.displayName = 'TldrawMathCanvas';
