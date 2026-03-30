'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { sileo } from 'sileo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

const WorkbenchLayout = dynamic(() => import('@/components/agathon/WorkbenchLayout'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#fafafa]">
      <Loader2 className="w-6 h-6 text-[#1e6ee8] animate-spin" />
    </div>
  ),
});

export default function BoardPageInner() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // We store the raw saved YJS state from Supabase and pass it to the canvas.
  // BlockSuite uses a multi-doc YJS architecture: rootDoc (metadata) and
  // spaceDoc (block content) must be saved and restored independently.
  const [savedRootState, setSavedRootState] = useState<string | undefined>();
  const [savedSpaceState, setSavedSpaceState] = useState<string | undefined>();
  const [title, setBoardTitle] = useState('Untitled board');
  const [subject, setSubject] = useState<string | undefined>();
  const [linkedJournalId, setLinkedJournalId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeUsers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [doc, setDoc] = useState<BSDoc | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load board metadata from Supabase — but NOT the doc (canvas does that)
  useEffect(() => {
    async function loadBoard() {
      try {
        if (id.startsWith('temp-')) {
          setBoardTitle('Scratch pad');
          setLoading(false);
          return;
        }
        const sb = createClient();
        const { data, error: fetchError } = await sb
          .from('whiteboards')
          .select('data, metadata, title')
          .eq('id', id)
          .single();
        if (fetchError) throw fetchError;
        setBoardTitle(data.title || 'Untitled board');
        setSubject(data.metadata?.subject);
        setLinkedJournalId(data.metadata?.linked_journal_id);
        if (data.data?.rootState) setSavedRootState(data.data.rootState);
        if (data.data?.spaceState) setSavedSpaceState(data.data.spaceState);
      } catch (e) {
        console.error('Error loading board:', e);
        setError('Could not load this board.');
      } finally {
        setLoading(false);
      }
    }
    loadBoard();
  }, [id]);

  // Save doc state when canvas reports a new doc instance.
  // BlockSuite multi-doc architecture: save rootDoc (metadata/structure) and
  // spaceDoc (block content) independently — they are separate Y.Doc instances.
  const persistDoc = useCallback(async (d: BSDoc) => {
    if (id.startsWith('temp-') || !d) return;
    try {
      setIsSaving(true);
      const { encodeStateAsUpdate } = await import('yjs');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const da = d as any;
      // rootDoc: holds collection metadata, spaces map
      const rootYjsDoc = da.collection?.doc ?? da.rootDoc;
      // spaceDoc: subdoc where all blocks actually live
      const spaceYjsDoc = da.spaceDoc;

      if (!rootYjsDoc || !spaceYjsDoc) {
        console.warn('[persistDoc] Could not find rootDoc or spaceDoc — skipping save', {
          hasCollectionDoc: !!da.collection?.doc,
          hasRootDoc: !!da.rootDoc,
          hasSpaceDoc: !!da.spaceDoc,
        });
        return;
      }

      const encodeToB64 = (yjsDoc: { encode?: unknown }) => {
        const update = encodeStateAsUpdate(yjsDoc as Parameters<typeof encodeStateAsUpdate>[0]);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < update.length; i += chunkSize) {
          binary += String.fromCharCode(...update.subarray(i, i + chunkSize));
        }
        return btoa(binary);
      };

      const rootState = encodeToB64(rootYjsDoc);
      const spaceState = encodeToB64(spaceYjsDoc);

      const sb = createClient();
      const { error } = await sb.from('whiteboards').update({ data: { rootState, spaceState } }).eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error('Save failed:', e);
      sileo.error({ title: 'Failed to save changes', duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  }, [id]);

  // Keep a stable ref so the beforeunload handler can access latest doc without
  // needing to be recreated each time doc changes.
  const docRef = useRef<BSDoc>(null);
  useEffect(() => { docRef.current = doc; }, [doc]);

  // Debounced auto-save when doc updates.
  // BlockSuite exposes updates via yjs observe on the underlying yjsDoc.
  // We also try doc.slots.blockUpdated / collection.slots.docUpdated as fallbacks.
  useEffect(() => {
    if (!doc || id.startsWith('temp-')) return;

    const schedSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistDoc(doc), 2000);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = doc as any;

    // Block content lives in spaceDoc — listen there for changes.
    // Also listen on rootDoc in case collection-level changes happen.
    const rootYjsDoc = d.collection?.doc ?? d.rootDoc;
    const spaceDoc = d.spaceDoc;

    let unobserveRoot: (() => void) | null = null;
    let unobserveSpace: (() => void) | null = null;

    if (rootYjsDoc?.on) {
      rootYjsDoc.on('update', schedSave);
      unobserveRoot = () => rootYjsDoc.off('update', schedSave);
    }

    if (spaceDoc?.on) {
      spaceDoc.on('update', schedSave);
      unobserveSpace = () => spaceDoc.off('update', schedSave);
    }

    return () => {
      unobserveRoot?.();
      unobserveSpace?.();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doc, id, persistDoc]);

  // Force-save on tab/window close so we don't lose the debounce window
  useEffect(() => {
    const handleBeforeUnload = () => {
      const d = docRef.current;
      if (!d || id.startsWith('temp-')) return;
      // Best-effort sync save using sendBeacon — fire and forget
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yjsDoc = (d as any).spaceDoc ?? (d as any).doc ?? d;
        // We can't await here, so schedule immediate flush via persistDoc
        // The timer cleanup in the previous effect already handles the debounce;
        // this is a belt-and-suspenders for hard refreshes.
        persistDoc(d).catch(() => {});
        // Also cancel any pending timer so persistDoc runs immediately
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        void yjsDoc; // reference to avoid lint warning
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id, persistDoc]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    setBoardTitle(newTitle);
    if (id.startsWith('temp-')) return;
    try {
      const sb = createClient();
      await sb.from('whiteboards').update({ title: newTitle }).eq('id', id);
    } catch {
      sileo.error({ title: 'Failed to rename board' });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#1e6ee8] animate-spin" />
          <p className="text-sm text-[#8a8a8a]">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => router.push('/')} className="text-sm text-[#1e6ee8] hover:underline">
          ← Back
        </button>
      </div>
    );
  }

  const savedState = (savedRootState && savedSpaceState)
    ? { rootState: savedRootState, spaceState: savedSpaceState }
    : null;

  return (
    <WorkbenchLayout
      key={id}
      boardId={id}
      savedState={savedState}
      title={title}
      subject={subject}
      linkedJournalId={linkedJournalId}
      onBack={() => router.push('/')}
      onTitleChange={handleTitleChange}
      onDocReady={setDoc}
      isSaving={isSaving}
      activeUsers={activeUsers}
    />
  );
}
