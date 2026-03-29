'use client';

/**
 * AffineCanvas — owns the full BlockSuite doc + editor lifecycle.
 *
 * Critical ordering:
 *   1. Load effects (registers all custom elements + block schemas)
 *   2. createEmptyDoc().init()  — schemas must already be registered
 *   3. Optionally restore YJS state
 *   4. Mount edgeless-editor / page-editor element
 *
 * This ordering prevents "SuperClass is not a subclass of BlockModel" which
 * happens when the doc is created before schemas are registered.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

export type CanvasMode = 'page' | 'edgeless';

export interface AffineCanvasHandle {
  getTextContent(): string;
}

interface AffineCanvasProps {
  boardId: string;
  savedYjsState?: string;
  mode?: CanvasMode;
  className?: string;
  onDocReady?: (doc: BSDoc) => void;
  onSelectionChange?: (text: string) => void;
}

// Load effects exactly once — this registers all block schemas + custom elements.
// IMPORTANT: the effects modules export a function; we must CALL it, not just import it.
let effectsPromise: Promise<void> | null = null;
function loadEffects(): Promise<void> {
  if (!effectsPromise) {
    effectsPromise = (async () => {
      const { effects: blocksEffects } = await import('@blocksuite/blocks/effects');
      blocksEffects();
      const { effects: presetsEffects } = await import('@blocksuite/presets/effects');
      presetsEffects();
    })();
  }
  return effectsPromise;
}

const AffineCanvas = forwardRef<AffineCanvasHandle, AffineCanvasProps>(
  ({ boardId, savedYjsState, mode = 'edgeless', className, onDocReady, onSelectionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const docRef = useRef<BSDoc>(null);

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
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      let destroyed = false;

      (async () => {
        // Step 1: register all block schemas + custom elements
        await loadEffects();
        if (destroyed) return;

        // Step 2: create doc (schemas are now registered — no version mismatch)
        const { createEmptyDoc } = await import('@blocksuite/presets');
        const doc = createEmptyDoc().init();
        docRef.current = doc;

        // Step 3: restore saved YJS state if present
        if (savedYjsState) {
          try {
            const { applyUpdate } = await import('yjs');
            const bytes = Uint8Array.from(atob(savedYjsState), (c) => c.charCodeAt(0));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const yjsDoc = (doc as any).spaceDoc ?? (doc as any).doc;
            if (yjsDoc) applyUpdate(yjsDoc, bytes);
          } catch (e) {
            console.warn('[AffineCanvas] YJS restore failed, using fresh doc:', e);
          }
        }

        if (destroyed) return;
        onDocReady?.(doc);

        // Step 4: mount the native BlockSuite editor element
        // Use affine-editor-container (higher-level) which properly handles mode switching
        // and uses signals for reactivity — more reliable than edgeless-editor directly
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

        container.appendChild(el);
      })();

      return () => {
        destroyed = true;
        container.innerHTML = '';
        docRef.current = null;
      };
    // boardId as dep so switching boards remounts cleanly
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
