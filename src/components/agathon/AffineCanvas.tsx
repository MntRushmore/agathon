'use client';

/**
 * AffineCanvas — wraps BlockSuite's AffineEditorContainer web component in React.
 * Supports doc (page) mode and edgeless (infinite canvas) mode.
 * The editor is a Lit-based custom element; we mount it imperatively via a ref.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// Use `any` for the BlockSuite Doc to avoid version-mismatch issues between
// @blocksuite/store at root vs the nested copy inside @blocksuite/block-std.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

export type CanvasMode = 'page' | 'edgeless';

export interface AffineCanvasHandle {
  /** Get plain text of all blocks for AI context */
  getTextContent(): string;
  /** Get the underlying Doc */
  getDoc(): BSDoc | null;
  /** Switch between doc and edgeless mode */
  switchMode(mode: CanvasMode): void;
}

interface AffineCanvasProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any;
  mode?: CanvasMode;
  className?: string;
  onSelectionChange?: (text: string) => void;
}

// Register BlockSuite custom elements once
let effectsLoaded = false;
async function ensureEffects() {
  if (effectsLoaded) return;
  effectsLoaded = true;
  try {
    await import('@blocksuite/presets/effects');
  } catch { /* effects may not exist in this version */ }
  try {
    await import('@blocksuite/blocks/effects');
  } catch { /* optional */ }
}

type EditorEl = HTMLElement & {
  doc: BSDoc;
  mode: CanvasMode;
  autofocus: boolean;
  switchEditor: (mode: CanvasMode) => void;
};

const AffineCanvas = forwardRef<AffineCanvasHandle, AffineCanvasProps>(
  ({ doc, mode = 'edgeless', className, onSelectionChange }, ref) => {
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
        } catch {
          return '';
        }
      },
      getDoc() {
        return doc as BSDoc;
      },
      switchMode(m: CanvasMode) {
        editorRef.current?.switchEditor(m);
      },
    }));

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
            if (sel && sel.toString().trim()) {
              onSelectionChange(sel.toString().trim());
            }
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

    // Switch mode without remounting
    useEffect(() => {
      editorRef.current?.switchEditor(mode);
    }, [mode]);

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
