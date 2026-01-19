import type { Editor, TLDrawShape, TLShapeId } from 'tldraw';

export interface IinkStroke {
  x: number[];
  y: number[];
  t: number[];
  p: number[];
}

export interface RecognitionResult {
  latex?: string;
  mathml?: string;
  text?: string;
  confidence?: number;
  shapeIds: TLShapeId[];
}

/**
 * Convert a tldraw draw shape to iink stroke format
 * tldraw stores strokes as segments with points: [{x, y, z}, ...]
 * iink expects: {x: number[], y: number[], t: number[], p: number[]}
 */
export function convertTldrawShapeToIinkStrokes(shape: TLDrawShape): IinkStroke[] {
  const strokes: IinkStroke[] = [];

  if (!shape.props.segments) return strokes;

  for (const segment of shape.props.segments) {
    if (segment.type !== 'free' || !segment.points || segment.points.length < 2) {
      continue;
    }

    const x: number[] = [];
    const y: number[] = [];
    const t: number[] = [];
    const p: number[] = [];

    let timestamp = 0;

    for (const point of segment.points) {
      x.push(shape.x + point.x);
      y.push(shape.y + point.y);
      t.push(timestamp);
      // tldraw uses z for pressure (0-1), default to 0.5 if not available
      p.push(typeof point.z === 'number' ? point.z : 0.5);
      timestamp += 10; // Assume 10ms between points
    }

    if (x.length >= 2) {
      strokes.push({ x, y, t, p });
    }
  }

  return strokes;
}

/**
 * Get all draw shapes from the editor
 */
export function getDrawShapes(editor: Editor): TLDrawShape[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.filter((shape): shape is TLDrawShape => shape.type === 'draw');
}

/**
 * Group shapes by spatial proximity for batch recognition
 * Returns groups of shape IDs that are close together
 */
export function groupShapesByProximity(
  shapes: TLDrawShape[],
  maxDistance: number = 200
): TLDrawShape[][] {
  if (shapes.length === 0) return [];
  if (shapes.length === 1) return [shapes];

  const groups: TLDrawShape[][] = [];
  const assigned = new Set<TLShapeId>();

  for (const shape of shapes) {
    if (assigned.has(shape.id)) continue;

    const group: TLDrawShape[] = [shape];
    assigned.add(shape.id);

    // Find all shapes within maxDistance of any shape in the group
    let i = 0;
    while (i < group.length) {
      const currentShape = group[i];
      const currentBounds = getShapeBounds(currentShape);

      for (const otherShape of shapes) {
        if (assigned.has(otherShape.id)) continue;

        const otherBounds = getShapeBounds(otherShape);
        const distance = getBoundsDistance(currentBounds, otherBounds);

        if (distance <= maxDistance) {
          group.push(otherShape);
          assigned.add(otherShape.id);
        }
      }

      i++;
    }

    groups.push(group);
  }

  return groups;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function getShapeBounds(shape: TLDrawShape): Bounds {
  let minX = shape.x;
  let minY = shape.y;
  let maxX = shape.x;
  let maxY = shape.y;

  if (shape.props.segments) {
    for (const segment of shape.props.segments) {
      if (segment.points) {
        for (const point of segment.points) {
          const px = shape.x + point.x;
          const py = shape.y + point.y;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

function getBoundsDistance(a: Bounds, b: Bounds): number {
  // Calculate minimum distance between two bounding boxes
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create a hash of stroke data for caching purposes
 */
export function hashStrokes(strokes: IinkStroke[]): string {
  const data = strokes.map(s =>
    `${s.x.slice(0, 5).join(',')}-${s.y.slice(0, 5).join(',')}-${s.x.length}`
  ).join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Normalize strokes to a standard coordinate system
 * This helps with recognition consistency
 */
export function normalizeStrokes(strokes: IinkStroke[]): IinkStroke[] {
  if (strokes.length === 0) return strokes;

  // Find bounding box
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const stroke of strokes) {
    for (let i = 0; i < stroke.x.length; i++) {
      minX = Math.min(minX, stroke.x[i]);
      minY = Math.min(minY, stroke.y[i]);
      maxX = Math.max(maxX, stroke.x[i]);
      maxY = Math.max(maxY, stroke.y[i]);
    }
  }

  // Translate to origin
  return strokes.map(stroke => ({
    x: stroke.x.map(v => v - minX),
    y: stroke.y.map(v => v - minY),
    t: stroke.t,
    p: stroke.p,
  }));
}

/**
 * Call the recognition API
 */
export async function recognizeStrokes(
  strokes: IinkStroke[],
  contentType: 'MATH' | 'TEXT' = 'MATH'
): Promise<RecognitionResult | null> {
  if (strokes.length === 0) return null;

  try {
    const response = await fetch('/api/iink/recognize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strokes: normalizeStrokes(strokes),
        contentType,
      }),
    });

    if (!response.ok) {
      console.error('Recognition API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.success && data.result) {
      return {
        ...data.result,
        shapeIds: [],
      };
    }

    return null;
  } catch (error) {
    console.error('Recognition error:', error);
    return null;
  }
}
