'use client';

import { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sileo } from 'sileo';
import type {
  AnnotatorState,
  AnnotatorAction,
  Annotation,
  TextAnnotation,
  ShapeType,
} from '@/lib/annotate/types';
import { moveAnnotation } from '@/lib/annotate/drawing';
import { exportAnnotatedPDF } from '@/lib/annotate/export';
import { createAnnotationFile, updateAnnotations, fetchAnnotationFile, downloadFile } from '@/lib/annotate/storage';
import { createEmptyHistory, pushAction, undo, redo } from '@/lib/annotate/history';
import { FileUploadZone } from './FileUploadZone';
import { PDFRenderer } from './PDFRenderer';
import { AnnotationCanvas } from './AnnotationCanvas';
import { AnnotationToolbar } from './AnnotationToolbar';
import { PageNavigator } from './PageNavigator';
import { TextOverlay } from './TextOverlay';

const initialState: AnnotatorState = {
  fileDataUrl: null,
  fileType: null,
  totalPages: 0,
  currentPage: 0,
  annotations: {},
  history: createEmptyHistory(),
  activeTool: 'pen',
  penColor: '#1a1a1a',
  penSize: 4,
  highlighterColor: '#eab308',
  highlighterSize: 16,
  textColor: '#1a1a1a',
  textSize: 18,
  zoom: 1,
  panX: 0,
  panY: 0,
  shapeType: 'rectangle' as ShapeType,
  shapeColor: '#3b82f6',
  shapeSize: 2,
  selectedAnnotationIds: [],
  textInput: null,
};

function clampPan(panX: number, panY: number, zoom: number, contentW: number, contentH: number) {
  if (zoom <= 1) return { panX: 0, panY: 0 };
  const maxPanX = (zoom - 1) * contentW / 2;
  const maxPanY = (zoom - 1) * contentH / 2;
  return {
    panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, panY)),
  };
}

function reducer(state: AnnotatorState, action: AnnotatorAction): AnnotatorState {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...initialState,
        fileDataUrl: action.dataUrl,
        fileType: action.fileType,
        totalPages: action.totalPages,
        // Preserve tool settings
        activeTool: state.activeTool,
        penColor: state.penColor,
        penSize: state.penSize,
        highlighterColor: state.highlighterColor,
        highlighterSize: state.highlighterSize,
        textColor: state.textColor,
        textSize: state.textSize,
      };

    case 'SET_PAGE':
      return { ...state, currentPage: action.page, textInput: null };

    case 'SET_TOOL':
      return { ...state, activeTool: action.tool, textInput: null, selectedAnnotationIds: [] };

    case 'SET_PEN_COLOR':
      return { ...state, penColor: action.color };

    case 'SET_PEN_SIZE':
      return { ...state, penSize: action.size };

    case 'SET_HIGHLIGHTER_COLOR':
      return { ...state, highlighterColor: action.color };

    case 'SET_HIGHLIGHTER_SIZE':
      return { ...state, highlighterSize: action.size };

    case 'SET_TEXT_COLOR':
      return { ...state, textColor: action.color };

    case 'SET_TEXT_SIZE':
      return { ...state, textSize: action.size };

    case 'SET_ZOOM': {
      const newZoom = action.zoom;
      if (newZoom <= 1) return { ...state, zoom: newZoom, panX: 0, panY: 0 };
      return { ...state, zoom: newZoom };
    }

    case 'SET_PAN':
      return { ...state, panX: action.panX, panY: action.panY };

    case 'SET_ZOOM_AT_POINT': {
      const newZoom = Math.max(0.5, Math.min(3.0, action.zoom));
      if (newZoom <= 1.0) return { ...state, zoom: newZoom, panX: 0, panY: 0 };
      const newPanX = action.focalX * state.zoom + state.panX - action.focalX * newZoom;
      const newPanY = action.focalY * state.zoom + state.panY - action.focalY * newZoom;
      const clamped = clampPan(newPanX, newPanY, newZoom, action.contentWidth, action.contentHeight);
      return { ...state, zoom: newZoom, panX: clamped.panX, panY: clamped.panY };
    }

    case 'SET_SHAPE_TYPE':
      return { ...state, shapeType: action.shapeType };

    case 'SET_SHAPE_COLOR':
      return { ...state, shapeColor: action.color };

    case 'SET_SHAPE_SIZE':
      return { ...state, shapeSize: action.size };

    case 'SET_SELECTION':
      return { ...state, selectedAnnotationIds: action.ids };

    case 'CLEAR_SELECTION':
      return { ...state, selectedAnnotationIds: [] };

    case 'MOVE_ANNOTATION': {
      const pageAnns = state.annotations[action.pageIndex] || [];
      const idx = pageAnns.findIndex(a => a.id === action.annotationId);
      if (idx === -1) return state;
      const ann = pageAnns[idx];
      const moved = moveAnnotation(ann, action.deltaX, action.deltaY);
      const newPageAnns = [...pageAnns];
      newPageAnns[idx] = moved;
      const newHistory = pushAction(state.history, {
        actionType: 'move',
        pageIndex: action.pageIndex,
        annotation: moved,
        previousAnnotation: ann,
      });
      return {
        ...state,
        annotations: { ...state.annotations, [action.pageIndex]: newPageAnns },
        history: newHistory,
      };
    }

    case 'DELETE_SELECTED': {
      const pageAnns = state.annotations[action.pageIndex] || [];
      let newHistory = state.history;
      const toRemove = pageAnns.filter(a => state.selectedAnnotationIds.includes(a.id));
      for (const ann of toRemove) {
        newHistory = pushAction(newHistory, {
          actionType: 'remove',
          pageIndex: action.pageIndex,
          annotation: ann,
        });
      }
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [action.pageIndex]: pageAnns.filter(a => !state.selectedAnnotationIds.includes(a.id)),
        },
        history: newHistory,
        selectedAnnotationIds: [],
      };
    }

    case 'ADD_ANNOTATION': {
      const pageAnns = state.annotations[action.pageIndex] || [];
      const newAnnotations = {
        ...state.annotations,
        [action.pageIndex]: [...pageAnns, action.annotation],
      };
      const newHistory = pushAction(state.history, {
        actionType: 'add',
        pageIndex: action.pageIndex,
        annotation: action.annotation,
      });
      return { ...state, annotations: newAnnotations, history: newHistory };
    }

    case 'REMOVE_ANNOTATION': {
      const pageAnns = state.annotations[action.pageIndex] || [];
      const removed = pageAnns.find(a => a.id === action.annotationId);
      if (!removed) return state;
      const newAnnotations = {
        ...state.annotations,
        [action.pageIndex]: pageAnns.filter(a => a.id !== action.annotationId),
      };
      const newHistory = pushAction(state.history, {
        actionType: 'remove',
        pageIndex: action.pageIndex,
        annotation: removed,
      });
      return { ...state, annotations: newAnnotations, history: newHistory };
    }

    case 'RESTORE_ANNOTATIONS':
      // Bulk-set annotations without touching history (used when loading saved files)
      return { ...state, annotations: action.annotations };

    case 'UNDO': {
      const result = undo(state.history);
      if (!result.action) return state;
      const act = result.action;

      let newAnnotations = { ...state.annotations };
      const pageAnns = newAnnotations[act.pageIndex] || [];

      if (act.actionType === 'add') {
        newAnnotations[act.pageIndex] = pageAnns.filter(a => a.id !== act.annotation.id);
      } else if (act.actionType === 'remove') {
        newAnnotations[act.pageIndex] = [...pageAnns, act.annotation];
      } else if (act.actionType === 'move' && act.previousAnnotation) {
        newAnnotations[act.pageIndex] = pageAnns.map(a =>
          a.id === act.annotation.id ? act.previousAnnotation! : a
        );
      }

      return { ...state, annotations: newAnnotations, history: result.history, selectedAnnotationIds: [] };
    }

    case 'REDO': {
      const result = redo(state.history);
      if (!result.action) return state;
      const act = result.action;

      let newAnnotations = { ...state.annotations };
      const pageAnns = newAnnotations[act.pageIndex] || [];

      if (act.actionType === 'add') {
        newAnnotations[act.pageIndex] = [...pageAnns, act.annotation];
      } else if (act.actionType === 'remove') {
        newAnnotations[act.pageIndex] = pageAnns.filter(a => a.id !== act.annotation.id);
      } else if (act.actionType === 'move' && act.previousAnnotation) {
        newAnnotations[act.pageIndex] = pageAnns.map(a =>
          a.id === act.previousAnnotation!.id ? act.annotation : a
        );
      }

      return { ...state, annotations: newAnnotations, history: result.history, selectedAnnotationIds: [] };
    }

    case 'SET_TEXT_INPUT':
      return { ...state, textInput: action.position };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

interface PDFAnnotatorProps {
  userId?: string;
  fileId?: string | null;
}

export function PDFAnnotator({ userId, fileId }: PDFAnnotatorProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);
  const [savedFileId, setSavedFileId] = useState<string | null>(fileId || null);
  const [fileName, setFileName] = useState<string>('Untitled');
  const [loadingFile, setLoadingFile] = useState(!!fileId);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const skipNextSaveRef = useRef(!!fileId); // Skip the auto-save triggered by initial load

  // Load an existing saved file
  useEffect(() => {
    if (!fileId || !userId) return;
    let cancelled = false;

    async function loadSavedFile() {
      setLoadingFile(true);
      try {
        // Fetch metadata + annotations from DB, and file from storage in parallel
        const file = await fetchAnnotationFile(fileId!);
        if (cancelled || !file) {
          if (!cancelled) sileo.error({ title: 'Failed to load annotation file' });
          setLoadingFile(false);
          return;
        }

        // Download the actual file from storage
        let dataUrl: string | null = null;
        if (file.file_storage_path) {
          dataUrl = await downloadFile(file.file_storage_path);
        }

        if (cancelled) return;

        if (dataUrl) {
          setFileName(file.file_name);
          setSavedFileId(file.id);
          skipNextSaveRef.current = true; // Don't auto-save what we just loaded

          dispatch({
            type: 'SET_FILE',
            dataUrl,
            fileType: file.file_type as 'pdf' | 'image',
            totalPages: file.page_count,
          });

          // Restore all annotations in one shot — no history, no per-annotation re-renders
          if (file.annotations && Object.keys(file.annotations).length > 0) {
            dispatch({ type: 'RESTORE_ANNOTATIONS', annotations: file.annotations });
          }
        } else {
          sileo.error({ title: 'Could not load the original file' });
        }
      } catch (err) {
        console.error('Error loading file:', err);
        if (!cancelled) sileo.error({ title: 'Failed to load annotation file' });
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    }

    loadSavedFile();
    return () => { cancelled = true; };
  }, [fileId, userId]);

  // Auto-save annotations when they change (debounced)
  useEffect(() => {
    if (!userId || !state.fileDataUrl || !state.fileType || loadingFile) return;

    // Skip the save triggered by loading existing annotations
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      // Prevent concurrent saves
      if (isSavingRef.current) return;
      isSavingRef.current = true;

      try {
        if (savedFileId) {
          // Lightweight: only update annotations JSON + count
          await updateAnnotations(savedFileId, state.annotations);
        } else {
          // First save: upload file + generate thumbnail + create row
          const result = await createAnnotationFile(
            userId,
            state.fileDataUrl!,
            fileName,
            state.fileType!,
            state.totalPages,
            state.annotations,
          );
          if (result) {
            setSavedFileId(result.id);
          }
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        isSavingRef.current = false;
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state.annotations, userId, state.fileDataUrl, state.fileType, state.totalPages, fileName, savedFileId, loadingFile]);

  const handleFileLoaded = useCallback((dataUrl: string, fileType: 'pdf' | 'image', totalPages: number, name: string) => {
    dispatch({ type: 'SET_FILE', dataUrl, fileType, totalPages });
    setFileName(name);
    setSavedFileId(null); // New file, will get an ID on first save
  }, []);

  const handleDimensionsChange = useCallback((width: number, height: number) => {
    setCanvasDimensions({ width, height });
  }, []);

  const handleAddAnnotation = useCallback((annotation: Annotation) => {
    dispatch({ type: 'ADD_ANNOTATION', pageIndex: state.currentPage, annotation });
  }, [state.currentPage]);

  const handleRemoveAnnotation = useCallback((annotationId: string) => {
    dispatch({ type: 'REMOVE_ANNOTATION', pageIndex: state.currentPage, annotationId });
  }, [state.currentPage]);

  const handleTextClick = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_TEXT_INPUT', position: { x, y } });
  }, []);

  const handleTextSubmit = useCallback((text: string) => {
    if (!state.textInput) return;
    const annotation: TextAnnotation = {
      id: crypto.randomUUID(),
      type: 'text',
      x: state.textInput.x,
      y: state.textInput.y,
      content: text,
      fontSize: state.textSize,
      color: state.textColor,
    };
    dispatch({ type: 'ADD_ANNOTATION', pageIndex: state.currentPage, annotation });
    dispatch({ type: 'SET_TEXT_INPUT', position: null });
  }, [state.textInput, state.textSize, state.textColor, state.currentPage]);

  const handleTextCancel = useCallback(() => {
    dispatch({ type: 'SET_TEXT_INPUT', position: null });
  }, []);

  const handleSave = useCallback(async () => {
    if (!state.fileDataUrl || !state.fileType || saving) return;
    setSaving(true);
    try {
      await exportAnnotatedPDF(
        state.fileDataUrl,
        state.fileType,
        state.totalPages,
        state.annotations,
      );
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setSaving(false);
    }
  }, [state.fileDataUrl, state.fileType, state.totalPages, state.annotations, saving]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in text input
      if (state.textInput) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const metaOrCtrl = e.metaKey || e.ctrlKey;

      if (metaOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }
      if (metaOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      if (metaOrCtrl && e.key === '=') {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: Math.min(3, state.zoom + 0.25) });
        return;
      }
      if (metaOrCtrl && e.key === '-') {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: Math.max(0.5, state.zoom - 0.25) });
        return;
      }
      if (metaOrCtrl && e.key === '0') {
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: 1 });
        return;
      }

      // Delete/Backspace to delete selected annotations
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedAnnotationIds.length > 0) {
        e.preventDefault();
        dispatch({ type: 'DELETE_SELECTED', pageIndex: state.currentPage });
        return;
      }

      if (!metaOrCtrl && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            dispatch({ type: 'SET_TOOL', tool: 'select' });
            break;
          case 'p':
            dispatch({ type: 'SET_TOOL', tool: 'pen' });
            break;
          case 'h':
            dispatch({ type: 'SET_TOOL', tool: 'highlighter' });
            break;
          case 't':
            dispatch({ type: 'SET_TOOL', tool: 'text' });
            break;
          case 'e':
            dispatch({ type: 'SET_TOOL', tool: 'eraser' });
            break;
          case 's':
            dispatch({ type: 'SET_TOOL', tool: 'shape' });
            break;
          case 'arrowleft':
            if (state.currentPage > 0) {
              dispatch({ type: 'SET_PAGE', page: state.currentPage - 1 });
            }
            break;
          case 'arrowright':
            if (state.currentPage < state.totalPages - 1) {
              dispatch({ type: 'SET_PAGE', page: state.currentPage + 1 });
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.textInput, state.zoom, state.currentPage, state.totalPages, state.selectedAnnotationIds]);

  // Wheel event for pinch-to-zoom and two-finger pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !state.fileDataUrl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll
        const rect = el.getBoundingClientRect();
        const focalX = e.clientX - rect.left - rect.width / 2;
        const focalY = e.clientY - rect.top - rect.height / 2;
        const zoomDelta = -e.deltaY * 0.01;
        dispatch({
          type: 'SET_ZOOM_AT_POINT',
          zoom: state.zoom + zoomDelta,
          focalX,
          focalY,
          contentWidth: canvasDimensions.width,
          contentHeight: canvasDimensions.height,
        });
      } else if (state.zoom > 1.0) {
        // Two-finger pan when zoomed in
        const newPanX = state.panX - e.deltaX;
        const newPanY = state.panY - e.deltaY;
        const clamped = clampPan(newPanX, newPanY, state.zoom, canvasDimensions.width, canvasDimensions.height);
        dispatch({ type: 'SET_PAN', panX: clamped.panX, panY: clamped.panY });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [state.fileDataUrl, state.zoom, state.panX, state.panY, canvasDimensions]);

  const currentAnnotations = state.annotations[state.currentPage] || [];

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 overflow-hidden">
      {/* Toolbar */}
      {state.fileDataUrl && (
        <AnnotationToolbar
          activeTool={state.activeTool}
          penColor={state.penColor}
          penSize={state.penSize}
          highlighterColor={state.highlighterColor}
          highlighterSize={state.highlighterSize}
          shapeType={state.shapeType}
          shapeColor={state.shapeColor}
          shapeSize={state.shapeSize}
          canUndo={state.history.undoStack.length > 0}
          canRedo={state.history.redoStack.length > 0}
          zoom={state.zoom}
          onToolChange={(tool) => dispatch({ type: 'SET_TOOL', tool })}
          onPenColorChange={(color) => dispatch({ type: 'SET_PEN_COLOR', color })}
          onPenSizeChange={(size) => dispatch({ type: 'SET_PEN_SIZE', size })}
          onHighlighterColorChange={(color) => dispatch({ type: 'SET_HIGHLIGHTER_COLOR', color })}
          onHighlighterSizeChange={(size) => dispatch({ type: 'SET_HIGHLIGHTER_SIZE', size })}
          onShapeTypeChange={(shapeType) => dispatch({ type: 'SET_SHAPE_TYPE', shapeType })}
          onShapeColorChange={(color) => dispatch({ type: 'SET_SHAPE_COLOR', color })}
          onShapeSizeChange={(size) => dispatch({ type: 'SET_SHAPE_SIZE', size })}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onRedo={() => dispatch({ type: 'REDO' })}
          onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
          onBack={() => router.push('/')}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Main canvas area */}
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
        {loadingFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading annotation file...</p>
          </div>
        ) : !state.fileDataUrl ? (
          <FileUploadZone onFileLoaded={handleFileLoaded} />
        ) : (
          <div
            className="relative shadow-xl rounded-sm"
            style={{
              transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* PDF background */}
            <PDFRenderer
              fileDataUrl={state.fileDataUrl}
              fileType={state.fileType!}
              currentPage={state.currentPage}
              onDimensionsChange={handleDimensionsChange}
            />

            {/* Annotation overlay */}
            {canvasDimensions.width > 0 && (
              <AnnotationCanvas
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                annotations={currentAnnotations}
                activeTool={state.activeTool}
                penColor={state.penColor}
                penSize={state.penSize}
                highlighterColor={state.highlighterColor}
                highlighterSize={state.highlighterSize}
                shapeType={state.shapeType}
                shapeColor={state.shapeColor}
                shapeSize={state.shapeSize}
                selectedAnnotationIds={state.selectedAnnotationIds}
                onAddAnnotation={handleAddAnnotation}
                onRemoveAnnotation={handleRemoveAnnotation}
                onTextClick={handleTextClick}
                onSelectAnnotation={(id) => {
                  if (id) {
                    dispatch({ type: 'SET_SELECTION', ids: [id] });
                  } else {
                    dispatch({ type: 'CLEAR_SELECTION' });
                  }
                }}
                onMoveAnnotation={(id, dx, dy) => {
                  dispatch({ type: 'MOVE_ANNOTATION', pageIndex: state.currentPage, annotationId: id, deltaX: dx, deltaY: dy });
                }}
              />
            )}

            {/* Text input overlay */}
            {state.textInput && (
              <TextOverlay
                position={state.textInput}
                fontSize={state.textSize}
                color={state.textColor}
                zoom={state.zoom}
                onSubmit={handleTextSubmit}
                onCancel={handleTextCancel}
              />
            )}
          </div>
        )}
      </div>

      {/* Page navigator */}
      {state.fileDataUrl && (
        <PageNavigator
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          onPageChange={(page) => dispatch({ type: 'SET_PAGE', page })}
        />
      )}
    </div>
  );
}
