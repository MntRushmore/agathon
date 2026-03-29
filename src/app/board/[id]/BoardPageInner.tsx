'use client';

/**
 * BoardPageInner — Agathon × AFFiNE rewrite.
 *
 * Loads board data from Supabase, initialises a BlockSuite Doc,
 * and renders WorkbenchLayout (AFFiNE-style canvas + Socratic AI panel).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import { createEmptyDoc } from '@blocksuite/presets';

// Use `any` for BSDoc to avoid @blocksuite/store version-mismatch between
// root package and the nested copy inside @blocksuite/block-std.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

// Dynamic import — BlockSuite is DOM-only
const WorkbenchLayout = dynamic(() => import('@/components/agathon/WorkbenchLayout'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#fafafa]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-[#1e6ee8] animate-spin" />
        <p className="text-sm text-[#8a8a8a]">Loading workspace…</p>
      </div>
    </div>
  ),
});

function initFreshDoc(d: BSDoc) {
  const rootId = d.addBlock('affine:page', {});
  d.addBlock('affine:surface', {}, rootId);
  const noteId = d.addBlock('affine:note', {}, rootId);
  d.addBlock('affine:paragraph', {}, noteId);
}

export default function BoardPageInner() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<BSDoc | null>(null);
  const [title, setBoardTitle] = useState('Untitled board');
  const [subject, setSubject] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState<{ id: string; name: string; color: string }[]>([]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load board & init BlockSuite doc ────────────────────────────────────

  useEffect(() => {
    async function loadBoard() {
      try {
        if (id.startsWith('temp-')) {
          const { doc: d } = createEmptyDoc();
          d.load();
          initFreshDoc(d);
          setBoardTitle('Scratch pad');
          setDoc(d);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('whiteboards')
          .select('data, metadata, title, user_id, is_public')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        setBoardTitle(data.title || 'Untitled board');
        setSubject(data.metadata?.subject);

        const { doc: d } = createEmptyDoc();
        d.load();

        if (data.data?.yjsState) {
          try {
            const { applyUpdate } = await import('yjs');
            const state = Uint8Array.from(atob(data.data.yjsState), (c) => c.charCodeAt(0));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            applyUpdate((d as any).spaceDoc ?? (d as any).doc, state);
          } catch (yjsErr) {
            console.warn('Could not restore YJS state, starting fresh:', yjsErr);
            initFreshDoc(d);
          }
        } else {
          initFreshDoc(d);
        }

        setDoc(d);
      } catch (e) {
        console.error('Error loading board:', e);
        setError('Could not load this board. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadBoard();
  }, [id]);

  // ─── Debounced save on doc updates ───────────────────────────────────────

  const persistDoc = useCallback(async (d: BSDoc, boardId: string) => {
    try {
      setIsSaving(true);
      const { encodeStateAsUpdate } = await import('yjs');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update = encodeStateAsUpdate((d as any).spaceDoc ?? (d as any).doc);
      const yjsState = btoa(String.fromCharCode(...update));
      const sb = createClient();
      await sb.from('whiteboards').update({ data: { yjsState } }).eq('id', boardId);
    } catch (e) {
      console.error('Save failed:', e);
      sileo.error({ title: 'Failed to save changes', duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!doc || id.startsWith('temp-')) return;

    const sub = doc.slots.docUpdated?.on(() => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persistDoc(doc, id), 2000);
    });

    return () => {
      sub?.dispose?.();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doc, id, persistDoc]);

  // ─── Realtime presence ────────────────────────────────────────────────────

  useEffect(() => {
    if (id.startsWith('temp-')) return;
    const sb = createClient();
    const channel = sb.channel(`board-presence:${id}`, {
      config: { presence: { key: 'user' } },
    });
    const COLORS = ['#1e6ee8', '#e85d1e', '#1ee87a', '#e8c21e', '#9b1ee8'];
    let myId: string | null = null;
    sb.auth.getUser().then(({ data }) => { myId = data.user?.id ?? null; });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; name: string }>();
        const users = Object.values(state)
          .flat()
          .map((p, i) => ({ id: p.userId, name: p.name || 'User', color: COLORS[i % COLORS.length] }))
          .filter((u) => u.id !== myId);
        setActiveUsers(users);
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [id]);

  // ─── Title update ─────────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────

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
      <div className="flex flex-col items-center justify-center h-screen bg-[#fafafa] gap-4">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => router.push('/')} className="text-sm text-[#1e6ee8] hover:underline">
          ← Back to boards
        </button>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <WorkbenchLayout
      doc={doc}
      title={title}
      subject={subject}
      onBack={() => router.push('/')}
      onTitleChange={handleTitleChange}
      isSaving={isSaving}
      activeUsers={activeUsers}
    />
  );
}
