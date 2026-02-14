export interface Point {
  x: number;
  y: number;
  pressure: number; // 0-1, from PointerEvent.pressure (0.5 default for mouse)
}

export type ToolType = 'pen' | 'highlighter' | 'text' | 'eraser' | 'shape' | 'select';

export type ShapeType = 'line' | 'rectangle' | 'circle' | 'arrow';

export interface ShapeAnnotation {
  id: string;
  type: 'shape';
  shapeType: ShapeType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  style: {
    color: string;
    size: number;
    opacity: number;
  };
}

export interface StrokeStyle {
  color: string;
  size: number;
  opacity: number; // 1.0 for pen, 0.3 for highlighter
  compositeOp: GlobalCompositeOperation;
}

export interface Stroke {
  id: string;
  type: 'stroke';
  points: Point[];
  style: StrokeStyle;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize: number;
  color: string;
}

export type Annotation = Stroke | TextAnnotation | ShapeAnnotation;

export interface PageAnnotations {
  [pageIndex: number]: Annotation[];
}

export interface AnnotationAction {
  actionType: 'add' | 'remove' | 'move';
  pageIndex: number;
  annotation: Annotation;
  previousAnnotation?: Annotation;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HistoryState {
  undoStack: AnnotationAction[];
  redoStack: AnnotationAction[];
}

export interface AnnotatorState {
  fileDataUrl: string | null;
  fileType: 'pdf' | 'image' | null;
  totalPages: number;
  currentPage: number; // 0-indexed
  annotations: PageAnnotations;
  history: HistoryState;
  activeTool: ToolType;
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  textColor: string;
  textSize: number;
  zoom: number;
  panX: number;
  panY: number;
  shapeType: ShapeType;
  shapeColor: string;
  shapeSize: number;
  selectedAnnotationIds: string[];
  textInput: { x: number; y: number } | null;
}

export interface AnnotationFile {
  id: string;
  user_id: string;
  file_name: string;
  file_type: 'pdf' | 'image';
  page_count: number;
  annotation_count: number;
  thumbnail: string | null;
  file_storage_path: string | null;
  annotations: PageAnnotations;
  created_at: string;
  updated_at: string;
}

export type AnnotatorAction =
  | { type: 'SET_FILE'; dataUrl: string; fileType: 'pdf' | 'image'; totalPages: number }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_TOOL'; tool: ToolType }
  | { type: 'SET_PEN_COLOR'; color: string }
  | { type: 'SET_PEN_SIZE'; size: number }
  | { type: 'SET_HIGHLIGHTER_COLOR'; color: string }
  | { type: 'SET_HIGHLIGHTER_SIZE'; size: number }
  | { type: 'SET_TEXT_COLOR'; color: string }
  | { type: 'SET_TEXT_SIZE'; size: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; panX: number; panY: number }
  | { type: 'SET_ZOOM_AT_POINT'; zoom: number; focalX: number; focalY: number; contentWidth: number; contentHeight: number }
  | { type: 'SET_SHAPE_TYPE'; shapeType: ShapeType }
  | { type: 'SET_SHAPE_COLOR'; color: string }
  | { type: 'SET_SHAPE_SIZE'; size: number }
  | { type: 'SET_SELECTION'; ids: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'MOVE_ANNOTATION'; pageIndex: number; annotationId: string; deltaX: number; deltaY: number }
  | { type: 'DELETE_SELECTED'; pageIndex: number }
  | { type: 'ADD_ANNOTATION'; pageIndex: number; annotation: Annotation }
  | { type: 'REMOVE_ANNOTATION'; pageIndex: number; annotationId: string }
  | { type: 'RESTORE_ANNOTATIONS'; annotations: PageAnnotations }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_TEXT_INPUT'; position: { x: number; y: number } | null }
  | { type: 'RESET' };
