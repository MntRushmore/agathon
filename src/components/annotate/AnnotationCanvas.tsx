'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { Annotation, ToolType, StrokeStyle, Point, Stroke, ShapeType, ShapeAnnotation } from '@/lib/annotate/types';
import {
  renderStroke,
  renderShape,
  renderTextAnnotation,
  renderAllAnnotations,
  findAnnotationAtPoint,
  simplifyPoints,
  moveAnnotation,
  getAnnotationBounds,
  renderSelectionBox,
} from '@/lib/annotate/drawing';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  annotations: Annotation[];
  activeTool: ToolType;
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  shapeType: ShapeType;
  shapeColor: string;
  shapeSize: number;
  selectedAnnotationIds: string[];
  onAddAnnotation: (annotation: Annotation) => void;
  onRemoveAnnotation: (annotationId: string) => void;
  onTextClick: (x: number, y: number) => void;
  onSelectAnnotation: (id: string | null) => void;
  onMoveAnnotation: (id: string, deltaX: number, deltaY: number) => void;
}

export function AnnotationCanvas({
  width,
  height,
  annotations,
  activeTool,
  penColor,
  penSize,
  highlighterColor,
  highlighterSize,
  shapeType,
  shapeColor,
  shapeSize,
  selectedAnnotationIds,
  onAddAnnotation,
  onRemoveAnnotation,
  onTextClick,
  onSelectAnnotation,
  onMoveAnnotation,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const currentStyleRef = useRef<StrokeStyle | null>(null);
  const animFrameRef = useRef<number>(0);

  // Shape drawing refs
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeLiveEndRef = useRef<{ x: number; y: number } | null>(null);

  // Selection/drag refs
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragAnnotationIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragDeltaRef = useRef<{ x: number; y: number } | null>(null);

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2;

  // Cache committed annotations to offscreen canvas, optionally excluding an annotation
  const updateOffscreenCanvas = useCallback((excludeId?: string) => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const oc = offscreenCanvasRef.current;
    oc.width = width * dpr;
    oc.height = height * dpr;
    const ctx = oc.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const toDraw = excludeId ? annotations.filter(a => a.id !== excludeId) : annotations;
    renderAllAnnotations(ctx, toDraw);
  }, [annotations, width, height, dpr]);

  useEffect(() => {
    updateOffscreenCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }
    // Render selection boxes
    if (activeTool === 'select' && selectedAnnotationIds.length > 0) {
      ctx.save();
      ctx.scale(dpr, dpr);
      for (const id of selectedAnnotationIds) {
        const ann = annotations.find(a => a.id === id);
        if (ann) renderSelectionBox(ctx, getAnnotationBounds(ann));
      }
      ctx.restore();
    }
  }, [updateOffscreenCanvas, activeTool, selectedAnnotationIds, annotations, dpr]);

  // Set up canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [width, height, dpr]);

  const getStyle = useCallback((): StrokeStyle => {
    if (activeTool === 'highlighter') {
      return {
        color: highlighterColor,
        size: highlighterSize,
        opacity: 0.3,
        compositeOp: 'multiply',
      };
    }
    return {
      color: penColor,
      size: penSize,
      opacity: 1.0,
      compositeOp: 'source-over',
    };
  }, [activeTool, penColor, penSize, highlighterColor, highlighterSize]);

  const getCanvasPoint = useCallback((e: PointerEvent | React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // rect is in screen coords (scaled by CSS transform), canvas coords are unscaled
    const scaleX = canvas.clientWidth / rect.width;
    const scaleY = canvas.clientHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }, []);

  const renderLiveStroke = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }

    const points = currentStrokeRef.current;
    const style = currentStyleRef.current;
    if (points.length > 0 && style) {
      ctx.save();
      ctx.scale(dpr, dpr);
      renderStroke(ctx, { id: '', type: 'stroke', points, style });
      ctx.restore();
    }
  }, [dpr]);

  const renderLiveShape = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }

    const start = shapeStartRef.current;
    const end = shapeLiveEndRef.current;
    if (start && end) {
      ctx.save();
      ctx.scale(dpr, dpr);
      renderShape(ctx, {
        id: '',
        type: 'shape',
        shapeType,
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
        style: { color: shapeColor, size: shapeSize, opacity: 1.0 },
      });
      ctx.restore();
    }
  }, [dpr, shapeType, shapeColor, shapeSize]);

  const renderWithDrag = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const delta = dragDeltaRef.current;
    const dragId = dragAnnotationIdRef.current;

    if (dragId && delta) {
      const ann = annotations.find(a => a.id === dragId);
      if (ann) {
        const moved = moveAnnotation(ann, delta.x, delta.y);
        if (moved.type === 'stroke') renderStroke(ctx, moved as Stroke);
        else if (moved.type === 'shape') renderShape(ctx, moved as ShapeAnnotation);
        else if (moved.type === 'text') {
          renderTextAnnotation(ctx, moved);
        }
        renderSelectionBox(ctx, getAnnotationBounds(moved));
      }
    } else {
      for (const id of selectedAnnotationIds) {
        const ann = annotations.find(a => a.id === id);
        if (ann) renderSelectionBox(ctx, getAnnotationBounds(ann));
      }
    }

    ctx.restore();
  }, [dpr, annotations, selectedAnnotationIds]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const point = getCanvasPoint(e);

    // Select tool
    if (activeTool === 'select') {
      const hit = findAnnotationAtPoint(point.x, point.y, annotations, 8);
      if (hit) {
        onSelectAnnotation(hit);
        dragStartRef.current = { x: point.x, y: point.y };
        dragAnnotationIdRef.current = hit;
        isDraggingRef.current = false;
        // Rebuild offscreen without the dragged annotation for clean drag preview
        updateOffscreenCanvas(hit);
      } else {
        onSelectAnnotation(null);
      }
      isDrawingRef.current = true;
      return;
    }

    // Text tool
    if (activeTool === 'text') {
      onTextClick(point.x, point.y);
      return;
    }

    // Eraser tool
    if (activeTool === 'eraser') {
      const hit = findAnnotationAtPoint(point.x, point.y, annotations, 12);
      if (hit) onRemoveAnnotation(hit);
      isDrawingRef.current = true;
      return;
    }

    // Shape tool
    if (activeTool === 'shape') {
      shapeStartRef.current = { x: point.x, y: point.y };
      shapeLiveEndRef.current = { x: point.x, y: point.y };
      isDrawingRef.current = true;
      return;
    }

    // Pen or highlighter
    currentStyleRef.current = getStyle();
    currentStrokeRef.current = [point];
    isDrawingRef.current = true;
  }, [activeTool, annotations, getCanvasPoint, getStyle, onRemoveAnnotation, onTextClick, onSelectAnnotation, updateOffscreenCanvas]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    // Select tool drag
    if (activeTool === 'select' && dragStartRef.current && dragAnnotationIdRef.current) {
      const point = getCanvasPoint(e);
      isDraggingRef.current = true;
      dragDeltaRef.current = {
        x: point.x - dragStartRef.current.x,
        y: point.y - dragStartRef.current.y,
      };
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(renderWithDrag);
      return;
    }

    // Eraser
    if (activeTool === 'eraser') {
      const point = getCanvasPoint(e);
      const hit = findAnnotationAtPoint(point.x, point.y, annotations, 12);
      if (hit) onRemoveAnnotation(hit);
      return;
    }

    // Shape tool
    if (activeTool === 'shape' && shapeStartRef.current) {
      const point = getCanvasPoint(e);
      shapeLiveEndRef.current = { x: point.x, y: point.y };
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(renderLiveShape);
      return;
    }

    // Pen/highlighter: collect coalesced events
    const nativeEvent = e.nativeEvent;
    const coalescedEvents = (nativeEvent as any).getCoalescedEvents?.() ?? [nativeEvent];
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / rect.width;
    const scaleY = canvas.clientHeight / rect.height;
    for (const ce of coalescedEvents) {
      currentStrokeRef.current.push({
        x: (ce.clientX - rect.left) * scaleX,
        y: (ce.clientY - rect.top) * scaleY,
        pressure: ce.pressure > 0 ? ce.pressure : 0.5,
      });
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(renderLiveStroke);
  }, [activeTool, annotations, getCanvasPoint, onRemoveAnnotation, renderLiveStroke, renderLiveShape, renderWithDrag]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Select tool
    if (activeTool === 'select') {
      if (isDraggingRef.current && dragAnnotationIdRef.current && dragDeltaRef.current) {
        const dx = dragDeltaRef.current.x;
        const dy = dragDeltaRef.current.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          onMoveAnnotation(dragAnnotationIdRef.current, dx, dy);
        }
      }
      dragStartRef.current = null;
      dragAnnotationIdRef.current = null;
      isDraggingRef.current = false;
      dragDeltaRef.current = null;
      // Rebuild offscreen with all annotations
      updateOffscreenCanvas();
      return;
    }

    if (activeTool === 'eraser') return;

    // Shape tool
    if (activeTool === 'shape' && shapeStartRef.current && shapeLiveEndRef.current) {
      const start = shapeStartRef.current;
      const end = shapeLiveEndRef.current;
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      if (dist > 3) {
        const shape: ShapeAnnotation = {
          id: crypto.randomUUID(),
          type: 'shape',
          shapeType,
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          style: { color: shapeColor, size: shapeSize, opacity: 1.0 },
        };
        onAddAnnotation(shape);
      }
      shapeStartRef.current = null;
      shapeLiveEndRef.current = null;
      return;
    }

    // Pen/highlighter
    const points = currentStrokeRef.current;
    const style = currentStyleRef.current;
    if (points.length === 0 || !style) return;

    const simplified = points.length > 3 ? simplifyPoints(points, 1.0) : points;
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      type: 'stroke',
      points: simplified,
      style,
    };

    onAddAnnotation(stroke);
    currentStrokeRef.current = [];
    currentStyleRef.current = null;
  }, [activeTool, onAddAnnotation, onMoveAnnotation, shapeType, shapeColor, shapeSize, updateOffscreenCanvas]);

  const cursorStyle = (): string => {
    switch (activeTool) {
      case 'pen':
      case 'highlighter':
        return 'crosshair';
      case 'eraser':
        return 'pointer';
      case 'text':
        return 'text';
      case 'select':
        return 'default';
      case 'shape':
        return 'crosshair';
      default:
        return 'crosshair';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 touch-none"
      style={{ cursor: cursorStyle() }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
