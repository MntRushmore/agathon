'use client';

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  timestamp: number;
}

// Solution that appears to the right of an equation
export interface SolutionOverlay {
  id: string;
  text: string;  // The computed answer like "= 42" or "x = 3"
  position: { x: number; y: number };
}

interface MathCanvasProps {
  strokes: Stroke[];
  solutions: SolutionOverlay[];
  onStrokesChange: (strokes: Stroke[]) => void;
  onRecognitionRequest: (imageData: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  tool: 'pen' | 'eraser';
  penColor?: string;
  penWidth?: number;
  solutionColor?: string;
  disabled?: boolean;
}

export interface MathCanvasRef {
  getCanvasImage: () => string;
}

export const MathCanvas = forwardRef<MathCanvasRef, MathCanvasProps>(({
  strokes,
  solutions,
  onStrokesChange,
  onRecognitionRequest,
  tool,
  penColor = '#1a1a2e',
  penWidth = 3,
  solutionColor = '#00CED1', // Cyan/teal color for solutions (like Apple Notes)
  disabled = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      return canvas.toDataURL('image/png');
    },
  }));

  // Resize canvas to match container
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Redraw canvas when strokes or solutions change
  useEffect(() => {
    redrawCanvas();
  }, [strokes, solutions]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw all saved strokes (user's handwriting - stays as handwriting!)
    strokes.forEach(stroke => {
      drawStroke(ctx, stroke.points, stroke.color, stroke.width);
    });

    // Draw current stroke being drawn
    if (currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, penColor, penWidth);
    }

    // Draw solution overlays (the computed answers in cyan/teal color)
    solutions.forEach(solution => {
      ctx.save();
      ctx.font = 'italic 28px "SF Pro", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
      ctx.fillStyle = solutionColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(solution.text, solution.position.x, solution.position.y);
      ctx.restore();
    });
  }, [strokes, solutions, currentStroke, penColor, penWidth, solutionColor]);

  const drawStroke = (ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }

    ctx.stroke();
  };

  const getPointerPosition = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }

    const point = getPointerPosition(e);

    if (tool === 'eraser') {
      eraseAtPoint(point);
    } else {
      setIsDrawing(true);
      setCurrentStroke([point]);

      // Clear any pending recognition
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const point = getPointerPosition(e);

    if (tool === 'eraser' && e.buttons > 0) {
      eraseAtPoint(point);
      return;
    }

    if (!isDrawing) return;

    setCurrentStroke(prev => {
      const newPoints = [...prev, point];

      // Draw the new segment immediately for smooth drawing
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && prev.length > 0) {
        const lastPoint = prev[prev.length - 1];
        ctx.beginPath();
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }

      return newPoints;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !isDrawing) return;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    setIsDrawing(false);

    if (currentStroke.length > 1) {
      const newStroke: Stroke = {
        id: crypto.randomUUID(),
        points: currentStroke,
        color: penColor,
        width: penWidth,
        timestamp: Date.now(),
      };

      const newStrokes = [...strokes, newStroke];
      onStrokesChange(newStrokes);

      // Start recognition timer (2 seconds after last stroke)
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      recognitionTimeoutRef.current = setTimeout(() => {
        triggerRecognition(newStrokes);
      }, 2000);
    }

    setCurrentStroke([]);
  };

  const eraseAtPoint = (point: Point) => {
    const eraseRadius = 20;
    const newStrokes = strokes.filter(stroke => {
      return !stroke.points.some(p => {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        return Math.sqrt(dx * dx + dy * dy) < eraseRadius;
      });
    });

    if (newStrokes.length !== strokes.length) {
      onStrokesChange(newStrokes);
    }
  };

  const triggerRecognition = (allStrokes: Stroke[]) => {
    if (allStrokes.length === 0) return;

    // Calculate bounding box of all strokes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allStrokes.forEach(stroke => {
      stroke.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const padding = 30;
    const bounds = {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };

    // Create image of just the strokes (without solutions) for OCR
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bounds.width * 2;
    tempCanvas.height = bounds.height * 2;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // White background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw strokes offset to bounds
    tempCtx.scale(2, 2);
    allStrokes.forEach(stroke => {
      const offsetPoints = stroke.points.map(p => ({
        x: p.x - bounds.x,
        y: p.y - bounds.y,
        pressure: p.pressure,
      }));
      drawStroke(tempCtx, offsetPoints, stroke.color, stroke.width);
    });

    const imageData = tempCanvas.toDataURL('image/png');
    onRecognitionRequest(imageData, bounds);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white relative"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          touchAction: 'none',
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
});

MathCanvas.displayName = 'MathCanvas';
