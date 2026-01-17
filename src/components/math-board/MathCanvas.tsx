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

// An equation is a group of strokes on the same "line" with its solution
export interface EquationLine {
  id: string;
  strokeIds: string[];
  bounds: { x: number; y: number; width: number; height: number };
  solution?: string;
  recognized?: boolean;
}

interface MathCanvasProps {
  strokes: Stroke[];
  equations: EquationLine[];
  onStrokesChange: (strokes: Stroke[]) => void;
  onEquationsChange: (equations: EquationLine[]) => void;
  onRecognitionRequest: (
    imageData: string,
    equation: EquationLine,
    bounds: { x: number; y: number; width: number; height: number }
  ) => void;
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
  equations,
  onStrokesChange,
  onEquationsChange,
  onRecognitionRequest,
  tool,
  penColor = '#1a1a2e',
  penWidth = 2.5,
  solutionColor = '#00B4D8', // Nice cyan color
  disabled = false,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvasImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return '';
      return canvas.toDataURL('image/png');
    },
  }));

  // Resize canvas
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

  useEffect(() => {
    redrawCanvas();
  }, [strokes, equations, currentStroke]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw all strokes with smoothing
    strokes.forEach(stroke => {
      drawSmoothStroke(ctx, stroke.points, stroke.color, stroke.width);
    });

    // Draw current stroke
    if (currentStroke.length > 0) {
      drawSmoothStroke(ctx, currentStroke, penColor, penWidth);
    }

    // Draw solutions inline (right after each equation)
    equations.forEach(eq => {
      if (eq.solution) {
        ctx.save();
        ctx.font = '600 26px "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
        ctx.fillStyle = solutionColor;
        ctx.textBaseline = 'middle';

        // Position: right after the equation bounds, vertically centered
        const x = eq.bounds.x + eq.bounds.width + 15;
        const y = eq.bounds.y + eq.bounds.height / 2;

        ctx.fillText(eq.solution, x, y);
        ctx.restore();
      }
    });
  }, [strokes, equations, currentStroke, penColor, penWidth, solutionColor]);

  // Draw stroke with bezier curve smoothing for cleaner look
  const drawSmoothStroke = (ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Use quadratic bezier curves for smoothing
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      // Smooth curve through points
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      // Last segment
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
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

      // Draw incrementally for smooth drawing
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
        points: smoothPoints(currentStroke), // Smooth the points
        color: penColor,
        width: penWidth,
        timestamp: Date.now(),
      };

      const newStrokes = [...strokes, newStroke];
      onStrokesChange(newStrokes);

      // Group strokes into equation lines and trigger recognition
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      recognitionTimeoutRef.current = setTimeout(() => {
        processEquations(newStrokes);
      }, 1500); // 1.5 seconds
    }

    setCurrentStroke([]);
  };

  // Smooth points by averaging nearby points (reduces jitter)
  const smoothPoints = (points: Point[]): Point[] => {
    if (points.length < 3) return points;

    const smoothed: Point[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      smoothed.push({
        x: (prev.x + curr.x * 2 + next.x) / 4,
        y: (prev.y + curr.y * 2 + next.y) / 4,
        pressure: curr.pressure,
      });
    }

    smoothed.push(points[points.length - 1]);
    return smoothed;
  };

  const eraseAtPoint = (point: Point) => {
    const eraseRadius = 20;
    const erasedStrokeIds = new Set<string>();

    const newStrokes = strokes.filter(stroke => {
      const shouldErase = stroke.points.some(p => {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        return Math.sqrt(dx * dx + dy * dy) < eraseRadius;
      });
      if (shouldErase) {
        erasedStrokeIds.add(stroke.id);
      }
      return !shouldErase;
    });

    if (erasedStrokeIds.size > 0) {
      onStrokesChange(newStrokes);

      // Remove equations that used erased strokes
      const newEquations = equations.filter(eq =>
        !eq.strokeIds.some(id => erasedStrokeIds.has(id))
      );
      onEquationsChange(newEquations);
    }
  };

  // Group strokes into equation lines based on vertical position
  const processEquations = (allStrokes: Stroke[]) => {
    if (allStrokes.length === 0) return;

    // Calculate bounds for each stroke
    const strokeBounds = allStrokes.map(stroke => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      stroke.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      return {
        stroke,
        minX, minY, maxX, maxY,
        centerY: (minY + maxY) / 2,
      };
    });

    // Group strokes into "lines" based on vertical overlap
    const lines: { strokeIds: string[]; bounds: typeof strokeBounds }[] = [];
    const used = new Set<string>();

    strokeBounds.forEach(sb => {
      if (used.has(sb.stroke.id)) return;

      // Find all strokes on the same horizontal line (within 50px vertical)
      const lineStrokes = strokeBounds.filter(other => {
        if (used.has(other.stroke.id)) return false;
        const verticalOverlap = !(sb.maxY < other.minY - 30 || sb.minY > other.maxY + 30);
        return verticalOverlap;
      });

      if (lineStrokes.length > 0) {
        const ids = lineStrokes.map(s => s.stroke.id);
        ids.forEach(id => used.add(id));
        lines.push({ strokeIds: ids, bounds: lineStrokes });
      }
    });

    // Create equation objects
    const newEquations: EquationLine[] = lines.map(line => {
      // Calculate combined bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      line.bounds.forEach(sb => {
        minX = Math.min(minX, sb.minX);
        minY = Math.min(minY, sb.minY);
        maxX = Math.max(maxX, sb.maxX);
        maxY = Math.max(maxY, sb.maxY);
      });

      // Check if this equation already exists
      const existing = equations.find(eq =>
        eq.strokeIds.length === line.strokeIds.length &&
        eq.strokeIds.every(id => line.strokeIds.includes(id))
      );

      if (existing && existing.recognized) {
        return existing; // Keep existing recognized equation
      }

      return {
        id: existing?.id || crypto.randomUUID(),
        strokeIds: line.strokeIds,
        bounds: {
          x: minX - 10,
          y: minY - 10,
          width: maxX - minX + 20,
          height: maxY - minY + 20,
        },
        solution: existing?.solution,
        recognized: existing?.recognized,
      };
    });

    onEquationsChange(newEquations);

    // Trigger recognition for unrecognized equations
    newEquations.forEach(eq => {
      if (!eq.recognized) {
        triggerRecognitionForEquation(eq, allStrokes);
      }
    });
  };

  const triggerRecognitionForEquation = (equation: EquationLine, allStrokes: Stroke[]) => {
    const eqStrokes = allStrokes.filter(s => equation.strokeIds.includes(s.id));
    if (eqStrokes.length === 0) return;

    const bounds = equation.bounds;
    const padding = 20;

    // Create image of just this equation's strokes
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = (bounds.width + padding * 2) * 2;
    tempCanvas.height = (bounds.height + padding * 2) * 2;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.scale(2, 2);

    eqStrokes.forEach(stroke => {
      const offsetPoints = stroke.points.map(p => ({
        x: p.x - bounds.x + padding,
        y: p.y - bounds.y + padding,
        pressure: p.pressure,
      }));
      drawSmoothStroke(tempCtx, offsetPoints, stroke.color, stroke.width);
    });

    const imageData = tempCanvas.toDataURL('image/png');
    onRecognitionRequest(imageData, equation, bounds);
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
