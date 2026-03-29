export type ToolType = 'pen' | 'highlighter' | 'eraser';

export type BackgroundType = 'white' | 'lined' | 'graph' | 'dots';

export interface SkiaPoint {
  x: number;
  y: number;
  pressure: number; // 0–1, from Apple Pencil or default 0.5
}

export interface SkiaStroke {
  id: string;
  points: SkiaPoint[];
  color: string;
  size: number;
  opacity: number; // 1.0 for pen, 0.35 for highlighter
  isHighlighter: boolean;
}

export interface DrawingState {
  strokes: SkiaStroke[];
  activeTool: ToolType;
  color: string;
  size: number;
  stylusOnly: boolean; // palm rejection
  background: BackgroundType;
}

export const COLORS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Teal', hex: '#0C5E70' },
  { name: 'Gray', hex: '#6b7280' },
];

export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', hex: '#fbbf24' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Green', hex: '#4ade80' },
];
