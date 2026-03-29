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
  // The canvas creates the BlockSuite doc AFTER effects are loaded so schemas
  // are registered before any BlockModel class identity checks run.
  const [savedYjsState, setSavedYjsState] = useState<string | undefined>();
  const [title, setBoardTitle] = useState('Untitled board');
  const [subject, setSubject] = useState<string | undefined>();
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
        if (data.data?.yjsState) setSavedYjsState(data.data.yjsState);
      } catch (e) {
        console.error('Error loading board:', e);
        setError('Could not load this board.');
      } finally {
        setLoading(false);
      }
    }
    loadBoard();
  }, [id]);

  // Save doc state when canvas reports a new doc instance
  const persistDoc = useCallback(async (d: BSDoc) => {
    if (id.startsWith('temp-') || !d) return;
    try {
      setIsSaving(true);
      const { encodeStateAsUpdate } = await import('yjs');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yjsDoc = (d as any).spaceDoc ?? (d as any).doc ?? d;
      const update = encodeStateAsUpdate(yjsDoc);
      const yjsState = btoa(String.fromCharCode(...update));
      const sb = createClient();
      await sb.from('whiteboards').update({ data: { yjsState } }).eq('id', id);
    } catch (e) {
      console.error('Save failed:', e);
      sileo.error({ title: 'Failed to save changes', duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  }, [id]);

  // Debounced auto-save when doc updates.
  // blockUpdated fires on doc.slots for any block add/update/delete.
  // collection.slots.docUpdated fires at the collection level — use whichever is available.
  useEffect(() => {
    if (!doc || id.startsWith('temp-')) return;

    const schedSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistDoc(doc), 2000);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = doc as any;
    // Prefer doc-level blockUpdated (fires on every edit), fall back to collection-level
    const sub =
      d.slots?.blockUpdated?.on(schedSave) ??
      d.collection?.slots?.docUpdated?.on(schedSave);

    return () => {
      sub?.dispose?.();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doc, id, persistDoc]);

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

  return (
    <WorkbenchLayout
      key={id}
      boardId={id}
      savedYjsState={savedYjsState}
      title={title}
      subject={subject}
      onBack={() => router.push('/')}
      onTitleChange={handleTitleChange}
      onDocReady={setDoc}
      isSaving={isSaving}
      activeUsers={activeUsers}
    />
  );
}
