import {
  StateNode,
  TLEventHandlers,
  TLShapeId,
  Vec,
  Box,
  createShapeId,
} from 'tldraw';

// Event that gets emitted when lasso selection is complete
export interface LassoSolveCompleteEvent {
  shapeIds: TLShapeId[];
  bounds: Box;
}

// Idle state - waiting for user to start drawing lasso
class Idle extends StateNode {
  static override id = 'idle';

  override onPointerDown: TLEventHandlers['onPointerDown'] = () => {
    this.parent.transition('lassooing');
  };

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 });
  };
}

// Lassooing state - user is drawing the lasso
class Lassooing extends StateNode {
  static override id = 'lassooing';

  private scribbleId: string | null = null;
  private points: Vec[] = [];

  override onEnter = () => {
    const { x, y } = this.editor.inputs.currentPagePoint;
    this.points = [new Vec(x, y)];

    // Create visual scribble feedback
    const scribble = this.editor.scribbles.addScribble({
      color: 'selection-stroke',
      opacity: 0.7,
      size: 3,
    });
    this.scribbleId = scribble.id;
    this.editor.scribbles.addPoint(this.scribbleId, x, y);
  };

  override onPointerMove: TLEventHandlers['onPointerMove'] = () => {
    const { x, y } = this.editor.inputs.currentPagePoint;
    this.points.push(new Vec(x, y));

    if (this.scribbleId) {
      this.editor.scribbles.addPoint(this.scribbleId, x, y);
    }
  };

  override onPointerUp: TLEventHandlers['onPointerUp'] = () => {
    this.complete();
  };

  override onCancel: TLEventHandlers['onCancel'] = () => {
    this.cancel();
  };

  override onKeyDown: TLEventHandlers['onKeyDown'] = (info) => {
    if (info.key === 'Escape') {
      this.cancel();
    }
  };

  private cancel() {
    if (this.scribbleId) {
      this.editor.scribbles.stop(this.scribbleId);
    }
    this.parent.transition('idle');
  }

  private complete() {
    if (this.scribbleId) {
      this.editor.scribbles.stop(this.scribbleId);
    }

    // Need at least 3 points to form a lasso
    if (this.points.length < 3) {
      this.parent.transition('idle');
      return;
    }

    // Close the lasso path
    this.points.push(this.points[0]);

    // Find shapes that intersect with the lasso
    const selectedShapeIds = this.findShapesInLasso();

    if (selectedShapeIds.length > 0) {
      // Calculate bounds of selected shapes
      const bounds = this.getShapesBounds(selectedShapeIds);

      // Emit custom event for the board to handle
      // Convert Box to plain object for serialization
      const event = new CustomEvent('lasso-solve-complete', {
        detail: {
          shapeIds: selectedShapeIds,
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
        } as LassoSolveCompleteEvent,
      });
      window.dispatchEvent(event);

      console.log('[LassoSolve] Selected shapes:', selectedShapeIds.length, 'bounds:', bounds);

      // Brief visual feedback - select the shapes temporarily
      this.editor.setSelectedShapes(selectedShapeIds);

      // Clear selection after a moment
      setTimeout(() => {
        this.editor.setSelectedShapes([]);
      }, 300);
    }

    this.parent.transition('idle');
  }

  private findShapesInLasso(): TLShapeId[] {
    const shapes = this.editor.getCurrentPageRenderingShapesSorted();
    const selectedIds: TLShapeId[] = [];

    // Create a bounding box of the lasso for quick rejection
    const lassoBounds = Box.FromPoints(this.points);

    for (const shape of shapes) {
      // Skip shapes that aren't user-drawn or user-pasted images, and skip AI-generated content
      if (shape.type !== 'draw' && shape.type !== 'image') continue;
      if (shape.meta?.aiGenerated) continue;

      const shapeBounds = this.editor.getShapePageBounds(shape);
      if (!shapeBounds) continue;

      // Quick rejection: skip if bounds don't overlap
      if (!lassoBounds.collides(shapeBounds)) continue;

      // Check if shape center is inside the lasso polygon
      const center = shapeBounds.center;
      if (this.isPointInPolygon(center, this.points)) {
        selectedIds.push(shape.id);
        continue;
      }

      // Check if any corner of the shape is inside the lasso
      const corners = [
        new Vec(shapeBounds.x, shapeBounds.y),
        new Vec(shapeBounds.maxX, shapeBounds.y),
        new Vec(shapeBounds.x, shapeBounds.maxY),
        new Vec(shapeBounds.maxX, shapeBounds.maxY),
      ];

      for (const corner of corners) {
        if (this.isPointInPolygon(corner, this.points)) {
          selectedIds.push(shape.id);
          break;
        }
      }
    }

    return selectedIds;
  }

  // Ray casting algorithm for point-in-polygon test
  private isPointInPolygon(point: Vec, polygon: Vec[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      if (
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  private getShapesBounds(shapeIds: TLShapeId[]): Box {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const id of shapeIds) {
      const bounds = this.editor.getShapePageBounds(id);
      if (!bounds) continue;

      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    return new Box(minX, minY, maxX - minX, maxY - minY);
  }
}

// Main Lasso Solve Tool
export class LassoSolveTool extends StateNode {
  static override id = 'lasso-solve';
  static override initial = 'idle';
  static override children = () => [Idle, Lassooing];

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 });
  };
}
