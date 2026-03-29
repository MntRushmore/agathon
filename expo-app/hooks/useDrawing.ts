import { useState, useCallback } from 'react';
import type { SkiaStroke, ToolType, BackgroundType } from '../components/skia/types';
import { COLORS } from '../components/skia/types';

const MAX_HISTORY = 100;

interface UseDrawingReturn {
  strokes: SkiaStroke[];
  activeTool: ToolType;
  color: string;
  size: number;
  stylusOnly: boolean;
  background: BackgroundType;
  canUndo: boolean;
  addStroke: (stroke: SkiaStroke) => void;
  eraseAt: (strokeId: string) => void;
  loadStrokes: (strokes: SkiaStroke[]) => void;
  undo: () => void;
  clear: () => void;
  setTool: (tool: ToolType) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setStylusOnly: (on: boolean) => void;
  setBackground: (bg: BackgroundType) => void;
}

export function useDrawing(): UseDrawingReturn {
  const [strokes, setStrokes] = useState<SkiaStroke[]>([]);
  const [history, setHistory] = useState<SkiaStroke[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [color, setColorState] = useState(COLORS[0].hex);
  const [size, setSizeState] = useState(4);
  const [stylusOnly, setStylusOnlyState] = useState(false);
  const [background, setBackgroundState] = useState<BackgroundType>('white');

  const pushHistory = useCallback((newStrokes: SkiaStroke[]) => {
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, newStrokes].slice(-MAX_HISTORY);
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const addStroke = useCallback((stroke: SkiaStroke) => {
    setStrokes(prev => {
      const next = [...prev, stroke];
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const eraseAt = useCallback((strokeId: string) => {
    setStrokes(prev => {
      const next = prev.filter(s => s.id !== strokeId);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const loadStrokes = useCallback((loaded: SkiaStroke[]) => {
    setStrokes(loaded);
    setHistory([[...loaded]]);
    setHistoryIndex(0);
  }, []);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setStrokes(history[newIndex] ?? []);
  }, [historyIndex, history]);

  const clear = useCallback(() => {
    setStrokes([]);
    pushHistory([]);
  }, [pushHistory]);

  const setTool = useCallback((tool: ToolType) => setActiveTool(tool), []);
  const setColor = useCallback((c: string) => setColorState(c), []);
  const setSize = useCallback((s: number) => setSizeState(s), []);
  const setStylusOnly = useCallback((on: boolean) => setStylusOnlyState(on), []);
  const setBackground = useCallback((bg: BackgroundType) => setBackgroundState(bg), []);

  return {
    strokes,
    activeTool,
    color,
    size,
    stylusOnly,
    background,
    canUndo: historyIndex > 0,
    addStroke,
    eraseAt,
    loadStrokes,
    undo,
    clear,
    setTool,
    setColor,
    setSize,
    setStylusOnly,
    setBackground,
  };
}
