'use client';

/**
 * AffineCanvas — embeds BlockSuite's EdgelessEditor / PageEditor web components.
 *
 * Uses the exact same setup as BlockSuite's own playground examples:
 *   const doc = createEmptyDoc().init();
 *   const editor = new EdgelessEditor();
 *   editor.doc = doc;
 *   document.body.append(editor);
 *
 * The editor renders its own full UI (top bar, toolbar, canvas) — we just
 * provide a container div and let BlockSuite handle everything inside it.
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

// Map our toolbar tool IDs → BlockSuite edgeless tool type strings
const TOOL_MAP: Partial<Record<ActiveTool, string>> = {
  default:   'default',
  pan:       'pan',
  frame:     'affine:frame',
  connector: 'connector',
  note:      'affine:note',
  pen:       'brush',
  eraser:    'eraser',
  shape:     'affine:shape',
  text:      'affine:edgeless-text',
  sticky:    'affine:note',
  mindmap:   'mindmap',
};

let effectsLoaded = false;
async function ensureEffects() {
  if (effectsLoaded) return;
  effectsLoaded = true;
  // Import theme CSS
  await import('@toeverything/theme/style.css');
  // Register all BlockSuite custom elements
  await import('@blocksuite/presets/effects');
  await import('@blocksuite/blocks/effects');
}

type EditorEl = HTMLElement & { doc: BSDoc };

function trySetTool(container: HTMLDivElement, tool: ActiveTool) {
  const bsTool = TOOL_MAP[tool];
  if (!bsTool) return;
  try {
    // BlockSuite's edgeless root exposes a `tools` controller
    const root = container.querySelector('affine-edgeless-root') as HTMLElement & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools?: { setEdgelessTool?: (t: { type: string }) => void };
    };
    root?.tools?.setEdgelessTool?.({ type: bsTool });
  } catch { /* ignore — tool may not be registered in this mode */ }
}

const AffineCanvas = forwardRef<AffineCanvasHandle, AffineCanvasProps>(
  ({ doc, mode = 'edgeless', activeTool = 'default', className, onSelectionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorEl | null>(null);

    useImperativeHandle(ref, () => ({
      getTextContent() {
        if (!doc) return '';
        try {
          const blocks = doc.getBlockByFlavour?.('affine:paragraph') ?? [];
          return (blocks as { model: { text?: { toString(): string } } }[])
            .map((b) => b.model?.text?.toString() ?? '')
            .filter(Boolean)
            .join('\n');
        } catch { return ''; }
      },
      getDoc() { return doc; },
      switchMode(m: CanvasMode) {
        // Swap the editor element
        const container = containerRef.current;
        if (!container) return;
        mountEditor(container, doc, m, activeTool, onSelectionChange).then((el) => {
          editorRef.current = el;
        });
      },
      setTool(t: ActiveTool) {
        if (containerRef.current) trySetTool(containerRef.current, t);
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !doc) return;
      let destroyed = false;

      ensureEffects().then(() => {
        if (destroyed || !container) return;
        mountEditor(container, doc, mode, activeTool, onSelectionChange).then((el) => {
          if (!destroyed) editorRef.current = el;
        });
      });

      return () => {
        destroyed = true;
        container.innerHTML = '';
        editorRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc]);

    // Mode changes: remount with new element type
    useEffect(() => {
      const container = containerRef.current;
      if (!container || !doc || !editorRef.current) return;
      container.innerHTML = '';
      editorRef.current = null;
      mountEditor(container, doc, mode, activeTool, onSelectionChange).then((el) => {
        editorRef.current = el;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    // Tool changes: forward to BlockSuite without remounting
    useEffect(() => {
      if (containerRef.current) trySetTool(containerRef.current, activeTool);
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

async function mountEditor(
  container: HTMLDivElement,
  doc: BSDoc,
  mode: CanvasMode,
  activeTool: ActiveTool,
  onSelectionChange?: (text: string) => void,
): Promise<EditorEl> {
  container.innerHTML = '';
  const tag = mode === 'edgeless' ? 'edgeless-editor' : 'page-editor';
  const el = document.createElement(tag) as EditorEl;
  el.doc = doc;
  // Fill the container
  el.style.cssText = 'width:100%;height:100%;display:block;';

  if (onSelectionChange) {
    el.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (sel?.toString().trim()) onSelectionChange(sel.toString().trim());
    });
  }

  container.appendChild(el);

  // After mount, set initial tool
  if (mode === 'edgeless') {
    // Give the Lit element one frame to initialise before forwarding the tool
    requestAnimationFrame(() => trySetTool(container, activeTool));
  }

  return el;
}

AffineCanvas.displayName = 'AffineCanvas';
export default AffineCanvas;
