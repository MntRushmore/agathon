'use client';

/**
 * AffineCanvas — React wrapper for BlockSuite's AffineEditorContainer web component.
 *
 * The editor is Lit-based; we mount it imperatively into a div ref.
 * Tool selection is forwarded to the BlockSuite editor's tool controller via
 * the same tool name mapping that AFFiNE uses internally.
 *
 * Tool name mapping (our ActiveTool → BlockSuite GfxToolsFullOptionMap keys):
 *   default  → default (select)
 *   pan      → pan
 *   frame    → affine:frame
 *   connector→ connector
 *   note     → affine:note
 *   pen      → brush
 *   eraser   → eraser
 *   shape    → affine:shape
 *   text     → affine:edgeless-text
 *   sticky   → affine:note  (opens note-type menu in AFFiNE — we reuse note)
 *   mindmap  → mindmap
 *   template → template
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { ActiveTool } from './EditorToolbar';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

export type CanvasMode = 'page' | 'edgeless';

export interface AffineCanvasHandle {
  getTextContent(): string;
  getDoc(): BSDoc | null;
  switchMode(mode: CanvasMode): void;
  setTool(tool: ActiveTool): void;
}

interface AffineCanvasProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any;
  mode?: CanvasMode;
  activeTool?: ActiveTool;
  className?: string;
  onSelectionChange?: (text: string) => void;
}

// Map our toolbar IDs → BlockSuite tool names
const TOOL_MAP: Record<ActiveTool, string> = {
  default:   'default',
  pan:       'pan',
  frame:     'affine:frame',
  connector: 'connector',
  note:      'affine:note',
  link:      'affine:bookmark',
  pen:       'brush',
  eraser:    'eraser',
  shape:     'affine:shape',
  text:      'affine:edgeless-text',
  sticky:    'affine:note',
  mindmap:   'mindmap',
  template:  'template',
};

// Register BlockSuite custom elements once globally
let effectsLoaded = false;
async function ensureEffects() {
  if (effectsLoaded) return;
  effectsLoaded = true;
  try { await import('@blocksuite/presets/effects'); } catch { /* optional */ }
  try { await import('@blocksuite/blocks/effects'); } catch { /* optional */ }
}

type EditorEl = HTMLElement & {
  doc: BSDoc;
  mode: CanvasMode;
  autofocus: boolean;
  switchEditor: (mode: CanvasMode) => void;
  // host gives access to the block-std scope where tool controllers live
  host?: {
    std?: {
      get?: (id: unknown) => unknown;
    };
  };
};

// Try to activate a tool via BlockSuite's GfxToolsFullOptionMap controller
function activateBSTool(el: EditorEl, toolId: ActiveTool) {
  try {
    const bsTool = TOOL_MAP[toolId];
    if (!bsTool || !el.host?.std?.get) return;

    // BlockSuite exposes EditorLifeCycleExtension or GfxControllerIdentifier
    // Attempt the edgeless tool controller approach used in AFFiNE source
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edgelessRoot = (el as any).host?.querySelector?.('affine-edgeless-root');
    if (edgelessRoot?.tools?.setEdgelessTool) {
      edgelessRoot.tools.setEdgelessTool({ type: bsTool });
    }
  } catch {
    // Safe to ignore — tool may not be registered in this mode
  }
}

const AffineCanvas = forwardRef<AffineCanvasHandle, AffineCanvasProps>(
  ({ doc, mode = 'edgeless', activeTool = 'default', className, onSelectionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorEl | null>(null);

    useImperativeHandle(ref, () => ({
      getTextContent() {
        if (!doc) return '';
        try {
          const blocks = doc.getBlocksByFlavour?.('affine:paragraph') ?? [];
          return (blocks as { model: { text?: { toString(): string } } }[])
            .map((b) => b.model?.text?.toString() ?? '')
            .filter(Boolean)
            .join('\n');
        } catch { return ''; }
      },
      getDoc() { return doc as BSDoc; },
      switchMode(m: CanvasMode) { editorRef.current?.switchEditor(m); },
      setTool(t: ActiveTool) {
        if (editorRef.current) activateBSTool(editorRef.current, t);
      },
    }));

    // Mount the editor
    useEffect(() => {
      const container = containerRef.current;
      if (!container || !doc) return;
      let destroyed = false;

      ensureEffects().then(() => {
        if (destroyed || !container) return;
        const el = document.createElement('affine-editor-container') as EditorEl;
        el.doc = doc;
        el.mode = mode;
        el.autofocus = true;

        if (onSelectionChange) {
          el.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (sel?.toString().trim()) onSelectionChange(sel.toString().trim());
          });
        }

        container.appendChild(el);
        editorRef.current = el;
      });

      return () => {
        destroyed = true;
        if (editorRef.current && container.contains(editorRef.current)) {
          container.removeChild(editorRef.current);
        }
        editorRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc]);

    // Mode switch without remount
    useEffect(() => {
      editorRef.current?.switchEditor(mode);
    }, [mode]);

    // Forward tool selection to BlockSuite
    useEffect(() => {
      if (editorRef.current) activateBSTool(editorRef.current, activeTool);
    }, [activeTool]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
    );
  }
);

AffineCanvas.displayName = 'AffineCanvas';
export default AffineCanvas;
