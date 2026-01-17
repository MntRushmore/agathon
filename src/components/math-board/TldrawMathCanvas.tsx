'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  Editor,
  TLUiOverrides,
  TLUiComponents,
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
  disabled?: boolean;
}

export interface TldrawMathCanvasRef {
  getCanvasImage: () => Promise<string>;
  getEditor: () => Editor | null;
}

export const TldrawMathCanvas = React.forwardRef<TldrawMathCanvasRef, TldrawMathCanvasProps>(({
  onRecognitionRequest,
  onEquationsChange,
  disabled = false,
}, ref) => {
  const editorRef = useRef<Editor | null>(null);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [equations, setEquations] = useState<EquationResult[]>([]);
  const lastShapeCountRef = useRef(0);

  React.useImperativeHandle(ref, () => ({
    getCanvasImage: async () => {
      const editor = editorRef.current;
      if (!editor) return '';

      // Use getSvgString and convert to image
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) return '';

      try {
        const svg = await editor.getSvgString([...shapeIds]);
        if (!svg) return '';

        // Convert SVG to PNG using canvas
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
          img.src = 'data:image/svg+xml;base64,' + btoa(svg.svg);
        });
      } catch {
        return '';
      }
    },
    getEditor: () => editorRef.current,
  }));

  const triggerRecognition = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || disabled) return;

    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) return;

    // Get all shapes - filter out text shapes (solutions)
    const drawShapeIds = [...shapeIds].filter(id => {
      const shape = editor.getShape(id);
      return shape && shape.type !== 'text';
    });
    if (drawShapeIds.length === 0) return;

    // Get bounds of all drawings
    const bounds = editor.getShapePageBounds(drawShapeIds[0]);
    if (!bounds) return;

    // Export the current canvas as an image using SVG
    try {
      const svg = await editor.getSvgString(drawShapeIds);
      if (!svg) return;

      // Convert SVG to PNG
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const imageData = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width || 800;
          canvas.height = img.height || 600;
          // White background
          ctx!.fillStyle = 'white';
          ctx!.fillRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load SVG'));
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.svg)));
      });

      const result = await onRecognitionRequest(imageData, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });

      if (result && result.solution) {
        // Add solution as a text shape to the right of the drawing
        const solutionX = bounds.x + bounds.width + 20;
        const solutionY = bounds.y + bounds.height / 2 - 15;

        // Check if we already have a solution shape at this location
        const existingShapes = [...editor.getCurrentPageShapeIds()]
          .map(id => editor.getShape(id))
          .filter(s => s && s.type === 'text' && (s.props as any).text?.startsWith('='));

        // Remove old solution shapes
        if (existingShapes.length > 0) {
          editor.deleteShapes(existingShapes.map(s => s!.id));
        }

        // Create solution text
        let displayText = result.solution;
        if (!displayText.startsWith('=') && !displayText.includes('=')) {
          displayText = `= ${displayText}`;
        }

        editor.createShape({
          type: 'text',
          x: solutionX,
          y: solutionY,
          props: {
            text: displayText,
            color: 'blue',
            size: 'l',
            font: 'sans',
          },
        });

        const newEquation: EquationResult = {
          id: crypto.randomUUID(),
          recognized: result.recognized,
          solution: displayText,
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        };

        setEquations(prev => {
          const updated = [...prev.filter(e =>
            Math.abs(e.bounds.y - bounds.y) > 50 // Keep equations on different lines
          ), newEquation];
          onEquationsChange?.(updated);
          return updated;
        });
      }
    } catch (error) {
      console.error('Recognition error:', error);
    }
  }, [onRecognitionRequest, onEquationsChange, disabled]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Set up drawing tool as default
    editor.setCurrentTool('draw');

    // Listen for changes
    editor.store.listen((entry) => {
      // Clear any pending recognition
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      // Check if shapes changed (new drawing)
      const currentShapeCount = editor.getCurrentPageShapeIds().size;

      // Only trigger recognition if we have shapes and count changed (user drew something)
      if (currentShapeCount > 0 && currentShapeCount !== lastShapeCountRef.current) {
        lastShapeCountRef.current = currentShapeCount;

        // Wait for user to stop drawing, then recognize
        recognitionTimeoutRef.current = setTimeout(() => {
          triggerRecognition();
        }, 1500); // 1.5 second delay
      }
    }, { source: 'user', scope: 'document' });
  }, [triggerRecognition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, []);

  // Custom UI to hide unnecessary tools for math mode
  const uiOverrides: TLUiOverrides = {
    tools(editor, tools) {
      // Only keep draw, eraser, and select tools
      return {
        select: tools.select,
        draw: tools.draw,
        eraser: tools.eraser,
      };
    },
  };

  const components: TLUiComponents = {
    // Hide the pages menu
    PageMenu: null,
    // Hide main menu
    MainMenu: null,
    // Hide quick actions
    QuickActions: null,
    // Hide help menu
    HelpMenu: null,
    // Hide actions menu
    ActionsMenu: null,
  };

  return (
    <div className="w-full h-full" style={{ touchAction: 'none' }}>
      <Tldraw
        onMount={handleMount}
        overrides={uiOverrides}
        components={components}
        inferDarkMode={false}
      />
    </div>
  );
});

TldrawMathCanvas.displayName = 'TldrawMathCanvas';
