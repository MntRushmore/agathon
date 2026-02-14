import type { Point, Stroke, Annotation, ShapeAnnotation, BoundingBox } from './types';

// Lerp between two values
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Distance from a point to a line segment
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Ramer-Douglas-Peucker point simplification
export function simplifyPoints(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = distToSegment(points[i].x, points[i].y, first.x, first.y, last.x, last.y);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPoints(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

// --- Stroke rendering ---

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const { points, style } = stroke;
  if (points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.color;
  ctx.globalAlpha = style.opacity;
  ctx.globalCompositeOperation = style.compositeOp;

  if (points.length === 1) {
    ctx.fillStyle = style.color;
    ctx.globalAlpha = style.opacity;
    const r = (style.size * points[0].pressure) / 2;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(r, 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    ctx.lineWidth = style.size * lerp(points[0].pressure, points[1].pressure, 0.5);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 6;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;

    ctx.lineWidth = style.size * lerp(p1.pressure, p2.pressure, 0.5);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    ctx.stroke();
  }

  ctx.restore();
}

// --- Text rendering ---

export function renderTextAnnotation(ctx: CanvasRenderingContext2D, ann: { x: number; y: number; content: string; fontSize: number; color: string }) {
  ctx.save();
  ctx.font = `${ann.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = ann.color;
  ctx.textBaseline = 'top';

  const lines = ann.content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], ann.x, ann.y + i * (ann.fontSize * 1.4));
  }

  ctx.restore();
}

// --- Shape rendering ---

export function renderShape(ctx: CanvasRenderingContext2D, shape: ShapeAnnotation) {
  ctx.save();
  ctx.strokeStyle = shape.style.color;
  ctx.lineWidth = shape.style.size;
  ctx.globalAlpha = shape.style.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape.shapeType) {
    case 'line':
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      break;

    case 'rectangle': {
      const x = Math.min(shape.startX, shape.endX);
      const y = Math.min(shape.startY, shape.endY);
      const w = Math.abs(shape.endX - shape.startX);
      const h = Math.abs(shape.endY - shape.startY);
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();
      break;
    }

    case 'circle': {
      const cx = (shape.startX + shape.endX) / 2;
      const cy = (shape.startY + shape.endY) / 2;
      const rx = Math.abs(shape.endX - shape.startX) / 2;
      const ry = Math.abs(shape.endY - shape.startY) / 2;
      if (rx > 0 && ry > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'arrow': {
      // Shaft
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
      const headLen = Math.max(12, shape.style.size * 5);
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(shape.endX, shape.endY);
      ctx.lineTo(
        shape.endX - headLen * Math.cos(angle - headAngle),
        shape.endY - headLen * Math.sin(angle - headAngle),
      );
      ctx.moveTo(shape.endX, shape.endY);
      ctx.lineTo(
        shape.endX - headLen * Math.cos(angle + headAngle),
        shape.endY - headLen * Math.sin(angle + headAngle),
      );
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

// --- Render all ---

export function renderAllAnnotations(ctx: CanvasRenderingContext2D, annotations: Annotation[]) {
  for (const ann of annotations) {
    if (ann.type === 'stroke') {
      renderStroke(ctx, ann);
    } else if (ann.type === 'text') {
      renderTextAnnotation(ctx, ann);
    } else if (ann.type === 'shape') {
      renderShape(ctx, ann);
    }
  }
}

// --- Hit-testing ---

function hitTestShape(x: number, y: number, shape: ShapeAnnotation, radius: number): boolean {
  const threshold = radius + shape.style.size / 2;

  switch (shape.shapeType) {
    case 'line':
    case 'arrow':
      return distToSegment(x, y, shape.startX, shape.startY, shape.endX, shape.endY) < threshold;

    case 'rectangle': {
      const left = Math.min(shape.startX, shape.endX);
      const right = Math.max(shape.startX, shape.endX);
      const top = Math.min(shape.startY, shape.endY);
      const bottom = Math.max(shape.startY, shape.endY);
      return (
        distToSegment(x, y, left, top, right, top) < threshold ||
        distToSegment(x, y, right, top, right, bottom) < threshold ||
        distToSegment(x, y, right, bottom, left, bottom) < threshold ||
        distToSegment(x, y, left, bottom, left, top) < threshold
      );
    }

    case 'circle': {
      const cx = (shape.startX + shape.endX) / 2;
      const cy = (shape.startY + shape.endY) / 2;
      const rx = Math.abs(shape.endX - shape.startX) / 2;
      const ry = Math.abs(shape.endY - shape.startY) / 2;
      if (rx === 0 || ry === 0) return false;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const normalizedThreshold = threshold / Math.min(rx, ry);
      return Math.abs(dist - 1.0) < normalizedThreshold;
    }
  }
  return false;
}

export function findAnnotationAtPoint(
  x: number,
  y: number,
  annotations: Annotation[],
  radius: number
): string | null {
  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];

    if (ann.type === 'text') {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${ann.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const lines = ann.content.split('\n');
      const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
      const height = lines.length * ann.fontSize * 1.4;

      if (x >= ann.x - radius && x <= ann.x + maxWidth + radius &&
          y >= ann.y - radius && y <= ann.y + height + radius) {
        return ann.id;
      }
      continue;
    }

    if (ann.type === 'shape') {
      if (hitTestShape(x, y, ann, radius)) return ann.id;
      continue;
    }

    if (ann.type === 'stroke') {
      for (const pt of ann.points) {
        const dist = Math.hypot(pt.x - x, pt.y - y);
        if (dist < radius + ann.style.size / 2) {
          return ann.id;
        }
      }
    }
  }
  return null;
}

// Keep old name as alias for backward compatibility
export const findStrokeAtPoint = findAnnotationAtPoint;

// --- Selection utilities ---

export function moveAnnotation(ann: Annotation, dx: number, dy: number): Annotation {
  switch (ann.type) {
    case 'stroke':
      return {
        ...ann,
        points: ann.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
      };
    case 'text':
      return { ...ann, x: ann.x + dx, y: ann.y + dy };
    case 'shape':
      return {
        ...ann,
        startX: ann.startX + dx,
        startY: ann.startY + dy,
        endX: ann.endX + dx,
        endY: ann.endY + dy,
      };
  }
}

export function getAnnotationBounds(ann: Annotation): BoundingBox {
  switch (ann.type) {
    case 'stroke': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of ann.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const pad = ann.style.size / 2;
      return {
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + ann.style.size,
        height: maxY - minY + ann.style.size,
      };
    }
    case 'text': {
      const lineHeight = ann.fontSize * 1.4;
      const lines = ann.content.split('\n');
      const approxWidth = ann.fontSize * 0.6 * Math.max(...lines.map(l => l.length));
      return {
        x: ann.x,
        y: ann.y,
        width: Math.max(approxWidth, 20),
        height: lines.length * lineHeight,
      };
    }
    case 'shape': {
      const pad = ann.style.size / 2;
      return {
        x: Math.min(ann.startX, ann.endX) - pad,
        y: Math.min(ann.startY, ann.endY) - pad,
        width: Math.abs(ann.endX - ann.startX) + ann.style.size,
        height: Math.abs(ann.endY - ann.startY) + ann.style.size,
      };
    }
  }
}

export function renderSelectionBox(ctx: CanvasRenderingContext2D, bounds: BoundingBox) {
  const pad = 6;
  ctx.save();

  // Dashed border
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(
    bounds.x - pad,
    bounds.y - pad,
    bounds.width + pad * 2,
    bounds.height + pad * 2,
  );
  ctx.setLineDash([]);

  // Corner handles
  const handleSize = 7;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  const corners = [
    [bounds.x - pad, bounds.y - pad],
    [bounds.x + bounds.width + pad, bounds.y - pad],
    [bounds.x - pad, bounds.y + bounds.height + pad],
    [bounds.x + bounds.width + pad, bounds.y + bounds.height + pad],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}
