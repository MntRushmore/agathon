'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Share, Download } from 'lucide-react';
import { debounce } from 'lodash';
import dynamic from 'next/dynamic';
import { Block } from '@/components/math-editor';

// Dynamically import the editor to avoid SSR issues with MathLive
const CorcaEditor = dynamic(
  () => import('@/components/math-editor/CorcaEditor').then(mod => mod.CorcaEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  }
);

interface MathDocumentData {
  id: string;
  user_id: string;
  title: string;
  equations: any[]; // Legacy format
  blocks?: Block[]; // New format
  variables: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export default function MathEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [document, setDocument] = useState<MathDocumentData | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  // Load document
  useEffect(() => {
    async function loadDocument() {
      if (!user || !params.id) return;

      const { data, error } = await supabase
        .from('math_whiteboards')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Failed to load document:', error);
        router.push('/math');
        return;
      }

      // Migrate from old format or load new format
      let loadedBlocks: Block[] = [];

      if (data.blocks && Array.isArray(data.blocks)) {
        // New format
        loadedBlocks = data.blocks;
      } else if (data.equations && Array.isArray(data.equations)) {
        // Migrate from old equation format
        loadedBlocks = data.equations.map((eq: any) => ({
          id: eq.id || crypto.randomUUID(),
          type: 'math' as const,
          content: eq.latex || eq.recognized || '',
        }));
      }

      // Ensure at least one block
      if (loadedBlocks.length === 0) {
        loadedBlocks = [{ id: crypto.randomUUID(), type: 'text', content: '' }];
      }

      setDocument(data);
      setTitle(data.title);
      setBlocks(loadedBlocks);
      setLoading(false);
    }

    loadDocument();
  }, [params.id, user, supabase, router]);

  // Auto-save with debounce
  const saveDocument = useCallback(
    debounce(async (newTitle: string, newBlocks: Block[]) => {
      if (!document) return;

      await supabase
        .from('math_whiteboards')
        .update({
          title: newTitle,
          blocks: newBlocks,
          // Keep equations for backwards compatibility
          equations: newBlocks.filter(b => b.type === 'math').map(b => ({
            id: b.id,
            latex: b.content,
            solution: null,
          })),
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);
    }, 1000),
    [document, supabase]
  );

  // Save on changes
  useEffect(() => {
    if (document && !loading) {
      saveDocument(title, blocks);
    }
  }, [title, blocks, document, loading, saveDocument]);

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  // Handle blocks change
  const handleBlocksChange = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      {/* Top navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/math')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-800" />
          <span className="text-sm text-gray-500">Math Documents</span>
          <span className="text-sm text-gray-400">/</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{title || 'Untitled'}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-500">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="default" size="sm" className="gap-2">
            <Share className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CorcaEditor
          title={title}
          blocks={blocks}
          onTitleChange={handleTitleChange}
          onBlocksChange={handleBlocksChange}
        />
      </div>
    </div>
  );
}
