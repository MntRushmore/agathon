'use client';

/**
 * AffineCanvas — owns the full BlockSuite doc + editor lifecycle.
 *
 * Save/Restore strategy (how BlockSuite actually works):
 *   - rootDoc  (BlockSuiteDoc extends Y.Doc): holds metadata, spaces map, version
 *   - spaceDoc (Y.Doc, stored in rootDoc.spaces.get(pageId)): holds all blocks
 *
 * We must encode and restore BOTH independently:
 *   save:    { rootState: encode(rootDoc), spaceState: encode(spaceDoc) }
 *   restore: applyUpdate(rootDoc, rootState) then applyUpdate(spaceDoc, spaceState)
 *
 * When restoring, we must NOT call doc.load() (which would reinitialize from
 * the rootDoc and miss the spaceDoc content) — instead we apply state directly.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

export type CanvasMode = 'page' | 'edgeless';

export interface AffineCanvasHandle {
  getTextContent(): string;
  getScreenshot(): string | null;
}

export interface SavedDocState {
  /** base64-encoded encodeStateAsUpdate(rootDoc) */
  rootState: string;
  /** base64-encoded encodeStateAsUpdate(spaceDoc) */
  spaceState: string;
}

interface AffineCanvasProps {
  boardId: string;
  /** If set, restore from this saved state instead of starting fresh */
  savedState?: SavedDocState | null;
  mode?: CanvasMode;
  className?: string;
  onDocReady?: (doc: BSDoc) => void;
  onSelectionChange?: (text: string) => void;
}

// Load effects exactly once per browser session
let effectsPromise: Promise<void> | null = null;
function loadEffects(): Promise<void> {
  if (!effectsPromise) {
    effectsPromise = (async () => {
      if (customElements.get('editor-host')) return;
      const { effects: blocksEffects } = await import('@blocksuite/blocks/effects');
      blocksEffects();
      const { effects: presetsEffects } = await import('@blocksuite/presets/effects');
      presetsEffects();
    })();
  }
  return effectsPromise;
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const AffineCanvas = forwardRef<AffineCanvasHandle, AffineCanvasProps>(
  ({ boardId, savedState, mode = 'edgeless', className, onDocReady, onSelectionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const docRef = useRef<BSDoc>(null);
    const editorElRef = useRef<(HTMLElement & { doc: BSDoc; mode: string }) | null>(null);

    useImperativeHandle(ref, () => ({
      getTextContent() {
        const doc = docRef.current;
        if (!doc) return '';
        try {
          const blocks = doc.getBlockByFlavour?.('affine:paragraph') ?? [];
          return (blocks as { model: { text?: { toString(): string } } }[])
            .map((b) => b.model?.text?.toString() ?? '')
            .filter(Boolean)
            .join('\n');
        } catch { return ''; }
      },

      getScreenshot() {
        const container = containerRef.current;
        if (!container) return null;
        try {
          const findCanvas = (root: Element | ShadowRoot): HTMLCanvasElement | null => {
            const direct = Array.from(root.querySelectorAll('canvas'));
            if (direct.length > 0) {
              return direct.reduce((a, b) => a.width * a.height >= b.width * b.height ? a : b);
            }
            for (const el of Array.from(root.querySelectorAll('*'))) {
              if (el.shadowRoot) {
                const found = findCanvas(el.shadowRoot);
                if (found) return found;
              }
            }
            return null;
          };
          const canvas = findCanvas(container);
          if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
          const offscreen = document.createElement('canvas');
          offscreen.width = canvas.width;
          offscreen.height = canvas.height;
          const ctx = offscreen.getContext('2d');
          if (!ctx) return null;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, offscreen.width, offscreen.height);
          ctx.drawImage(canvas, 0, 0);
          return offscreen.toDataURL('image/png');
        } catch (e) {
          console.warn('[AffineCanvas] getScreenshot failed:', e);
          return null;
        }
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      let destroyed = false;

      (async () => {
        // 1. Register all block schemas + custom elements
        await loadEffects();
        if (destroyed) return;

        const { applyUpdate } = await import('yjs');
        const { createEmptyDoc } = await import('@blocksuite/presets');

        let doc: BSDoc;

        if (savedState?.rootState && savedState?.spaceState) {
          // ── RESTORE PATH ─────────────────────────────────────────────
          // Create an empty doc WITHOUT calling .init() (which would add
          // fresh blocks that conflict with saved state)
          const created = createEmptyDoc();
          doc = created.doc;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const da = doc as any;
          const rootYjsDoc = da.collection?.doc ?? da.rootDoc;

          // Apply rootDoc state first (restores metadata + spaces map)
          try {
            applyUpdate(rootYjsDoc, b64ToBytes(savedState.rootState));
          } catch (e) {
            console.warn('[AffineCanvas] rootDoc restore failed:', e);
          }

          // Load the doc so BlockSuite connects to the subdoc
          try { doc.load(); } catch { /* may already be loaded */ }

          // Apply spaceDoc state (restores actual blocks)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const spaceDoc = (doc as any).spaceDoc;
          if (spaceDoc) {
            try {
              applyUpdate(spaceDoc, b64ToBytes(savedState.spaceState));
            } catch (e) {
              console.warn('[AffineCanvas] spaceDoc restore failed:', e);
            }
          }
        } else {
          // ── FRESH PATH ───────────────────────────────────────────────
          doc = createEmptyDoc().init();
        }

        docRef.current = doc;
        if (destroyed) return;
        onDocReady?.(doc);

        // 2. Mount the BlockSuite editor element
        const el = document.createElement('affine-editor-container') as HTMLElement & {
          doc: BSDoc;
          mode: string;
        };
        el.doc = doc;
        el.mode = mode === 'edgeless' ? 'edgeless' : 'page';
        el.style.cssText = 'width:100%;height:100%;display:block;position:relative;';

        if (onSelectionChange) {
          el.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (sel?.toString().trim()) onSelectionChange(sel.toString().trim());
          });
        }

        editorElRef.current = el;
        container.appendChild(el);
      })();

      return () => {
        destroyed = true;
        const el = editorElRef.current;
        if (el) {
          try { el.remove(); } catch { /* ignore */ }
          editorElRef.current = null;
        }
        if (container) container.innerHTML = '';
        docRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, mode]);

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
