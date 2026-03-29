import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  Group,
  Line,
  rect,
  vec,
  Paint,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import type { SkiaStroke, SkiaPoint, ToolType, BackgroundType } from './types';

interface SkiaCanvasProps {
  width: number;
  height: number;
  strokes: SkiaStroke[];
  activeTool: ToolType;
  color: string;
  size: number;
  stylusOnly: boolean;
  background: BackgroundType;
  onStrokeComplete: (stroke: SkiaStroke) => void;
  onEraseStroke: (strokeId: string) => void;
}

// Build a smooth cubic-bezier SVG path string from an array of points
function buildPath(points: SkiaPoint[]): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;
  if (points.length === 1) {
    path.moveTo(points[0].x, points[0].y);
    path.lineTo(points[0].x + 0.1, points[0].y + 0.1);
    return path;
  }

  path.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    path.lineTo(points[1].x, points[1].y);
    return path;
  }

  // Cubic spline: control points at 1/3 and 2/3 between consecutive points
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const cp1x = prev.x + (curr.x - prev.x) * (2 / 3);
    const cp1y = prev.y + (curr.y - prev.y) * (2 / 3);
    const cp2x = curr.x - (next.x - curr.x) * (1 / 3);
    const cp2y = curr.y - (next.y - curr.y) * (1 / 3);

    path.cubicTo(cp1x, cp1y, cp2x, cp2y, curr.x, curr.y);
  }

  const last = points[points.length - 1];
  path.lineTo(last.x, last.y);

  return path;
}

// Find which stroke (if any) is near a given point (for eraser)
function findStrokeNear(
  strokes: SkiaStroke[],
  x: number,
  y: number,
  radius: number = 20,
): string | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    for (const pt of stroke.points) {
      const dx = pt.x - x;
      const dy = pt.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        return stroke.id;
      }
    }
  }
  return null;
}

// Draw background pattern with Skia paths — memoized since dimensions/type rarely change
const BackgroundLayer = React.memo(function BackgroundLayer({
  width,
  height,
  type,
}: {
  width: number;
  height: number;
  type: BackgroundType;
}) {
  if (type === 'white') return null;

  const lines: React.ReactNode[] = [];
  const lineColor = 'rgba(180,190,210,0.5)';
  const lineWidth = 0.8;

  if (type === 'lined') {
    const spacing = 36;
    for (let y = spacing; y < height; y += spacing) {
      const p = Skia.Path.Make();
      p.moveTo(0, y);
      p.lineTo(width, y);
      lines.push(
        <Path key={`h${y}`} path={p} color={lineColor} style="stroke" strokeWidth={lineWidth} />
      );
    }
  }

  if (type === 'graph') {
    const spacing = 36;
    for (let y = spacing; y < height; y += spacing) {
      const p = Skia.Path.Make();
      p.moveTo(0, y);
      p.lineTo(width, y);
      lines.push(
        <Path key={`h${y}`} path={p} color={lineColor} style="stroke" strokeWidth={lineWidth} />
      );
    }
    for (let x = spacing; x < width; x += spacing) {
      const p = Skia.Path.Make();
      p.moveTo(x, 0);
      p.lineTo(x, height);
      lines.push(
        <Path key={`v${x}`} path={p} color={lineColor} style="stroke" strokeWidth={lineWidth} />
      );
    }
  }

  if (type === 'dots') {
    const spacing = 36;
    const dotPath = Skia.Path.Make();
    for (let y = spacing; y < height; y += spacing) {
      for (let x = spacing; x < width; x += spacing) {
        dotPath.addCircle(x, y, 1.5);
      }
    }
    lines.push(
      <Path key="dots" path={dotPath} color={lineColor} style="fill" />
    );
  }

  return <Group>{lines}</Group>;
});

export function SkiaCanvas({
  width,
  height,
  strokes,
  activeTool,
  color,
  size,
  stylusOnly,
  background,
  onStrokeComplete,
  onEraseStroke,
}: SkiaCanvasProps) {
  // Live stroke points stored in a ref (mutated directly for perf, triggers re-render via shared value)
  const livePoints = useRef<SkiaPoint[]>([]);
  // Shared value to trigger canvas re-render
  const liveStrokeVersion = useSharedValue(0);
  // We use a ref for the rendered live path too, updated synchronously
  const livePathRef = useRef(Skia.Path.Make());

  // Refs for current tool settings (captured at gesture start)
  const toolRef = useRef(activeTool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const stylusOnlyRef = useRef(stylusOnly);

  // Keep refs in sync
  toolRef.current = activeTool;
  colorRef.current = color;
  sizeRef.current = size;
  stylusOnlyRef.current = stylusOnly;

  const handleStrokeComplete = useCallback((points: SkiaPoint[], strokeColor: string, strokeSize: number, isHighlighter: boolean) => {
    if (points.length < 2) return;
    const stroke: SkiaStroke = {
      id: Math.random().toString(36).slice(2),
      points,
      color: strokeColor,
      size: strokeSize,
      opacity: isHighlighter ? 0.35 : 1.0,
      isHighlighter,
    };
    onStrokeComplete(stroke);
  }, [onStrokeComplete]);

  const handleErase = useCallback((x: number, y: number) => {
    const hit = findStrokeNear(strokes, x, y);
    if (hit) onEraseStroke(hit);
  }, [strokes, onEraseStroke]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      // Palm rejection: if stylusOnly mode, reject non-stylus touches
      // On iOS, Apple Pencil has stylus pointerType; finger has .pressure near 0
      // react-native-gesture-handler doesn't expose pointerType directly,
      // but Apple Pencil always has force > 0 on supported devices.
      // We use a simple heuristic: if stylusOnly and force is 0 (finger), skip.
      if (stylusOnlyRef.current && e.force === 0) return;

      runOnJS((() => {
        livePoints.current = [{ x: e.x, y: e.y, pressure: e.force > 0 ? e.force : 0.5 }];
        livePathRef.current = buildPath(livePoints.current);
      }))();
      liveStrokeVersion.value += 1;
    })
    .onUpdate((e) => {
      'worklet';
      if (stylusOnlyRef.current && e.force === 0) return;
      if (toolRef.current === 'eraser') {
        runOnJS(handleErase)(e.x, e.y);
        return;
      }

      runOnJS((() => {
        livePoints.current.push({ x: e.x, y: e.y, pressure: e.force > 0 ? e.force : 0.5 });
        livePathRef.current = buildPath(livePoints.current);
      }))();
      liveStrokeVersion.value += 1;
    })
    .onEnd((e) => {
      'worklet';
      if (toolRef.current === 'eraser') return;
      if (livePoints.current.length < 2) {
        runOnJS((() => { livePoints.current = []; livePathRef.current = Skia.Path.Make(); }))();
        liveStrokeVersion.value += 1;
        return;
      }

      const points = [...livePoints.current];
      const strokeColor = colorRef.current;
      const strokeSize = sizeRef.current;
      const isHighlighter = toolRef.current === 'highlighter';

      runOnJS(handleStrokeComplete)(points, strokeColor, strokeSize, isHighlighter);
      runOnJS((() => { livePoints.current = []; livePathRef.current = Skia.Path.Make(); }))();
      liveStrokeVersion.value += 1;
    })
    .onFinalize(() => {
      'worklet';
      runOnJS((() => { livePoints.current = []; livePathRef.current = Skia.Path.Make(); }))();
      liveStrokeVersion.value += 1;
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ width, height }}>
        <Canvas style={{ width, height, backgroundColor: '#FFFFFF' }}>
          {/* Background pattern */}
          <BackgroundLayer width={width} height={height} type={background} />

          {/* Committed strokes */}
          {strokes.map(stroke => (
            <CommittedStroke key={stroke.id} stroke={stroke} />
          ))}

          {/* Live stroke (currently drawing) — rendered by re-building from livePathRef */}
          {/* We use a separate component that reads from shared state via liveStrokeVersion */}
          <LiveStroke
            livePathRef={livePathRef}
            color={color}
            size={size}
            isHighlighter={activeTool === 'highlighter'}
            version={liveStrokeVersion}
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

// Memoized committed stroke — only re-renders when the stroke itself changes
const CommittedStroke = React.memo(function CommittedStroke({ stroke }: { stroke: SkiaStroke }) {
  const strokePath = useMemo(() => buildPath(stroke.points), [stroke.points]);
  return (
    <Path
      path={strokePath}
      color={stroke.color}
      style="stroke"
      strokeWidth={stroke.size}
      strokeCap="round"
      strokeJoin="round"
      opacity={stroke.opacity}
      blendMode={stroke.isHighlighter ? 'multiply' : 'srcOver'}
    />
  );
});

// Separate component so it can re-render on live stroke updates
function LiveStroke({
  livePathRef,
  color,
  size,
  isHighlighter,
  version,
}: {
  livePathRef: React.MutableRefObject<ReturnType<typeof Skia.Path.Make>>;
  color: string;
  size: number;
  isHighlighter: boolean;
  version: ReturnType<typeof useSharedValue<number>>;
}) {
  // This component re-renders whenever version changes (via Reanimated)
  return (
    <Path
      path={livePathRef.current}
      color={color}
      style="stroke"
      strokeWidth={size}
      strokeCap="round"
      strokeJoin="round"
      opacity={isHighlighter ? 0.35 : 1.0}
      blendMode={isHighlighter ? 'multiply' : 'srcOver'}
    />
  );
}
