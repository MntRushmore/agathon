'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, ChevronLeft } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/logo';

interface Journal {
  id: string;
  title: string;
  content: any[];
  created_at: string;
  updated_at: string;
}

export default function JournalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJournals() {
      if (!user) return;

      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load journals:', error);
        toast.error('Failed to load journals');
        setLoading(false);
        return;
      }

      setJournals(data || []);
      setLoading(false);
    }

    loadJournals();
  }, [user, supabase]);

  const createJournal = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('journals')
      .insert([{
        user_id: user.id,
        title: 'New Journal',
        content: [],
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create journal:', error);
      toast.error('Failed to create journal');
      return;
    }

    router.push(`/journal/${data.id}`);
  };

  // Get a preview of the journal content
  const getPreview = (content: any[]): string => {
    if (!content || content.length === 0) return 'Empty journal';
    const firstBlock = content[0];
    if (typeof firstBlock === 'string') return firstBlock.slice(0, 100);
    if (firstBlock?.content) return firstBlock.content.slice(0, 100);
    return 'Empty journal';
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Logo size="md" />
          </div>
          <Button
            onClick={createJournal}
            className="min-h-[44px] touch-manipulation bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Journal
          </Button>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Journals</h1>
          <p className="text-sm text-muted-foreground mt-1">Your study notes and writings</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : journals.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No journals yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first journal to start writing with AI-powered study tools
            </p>
            <Button
              onClick={createJournal}
              className="min-h-[44px] touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Journal
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {journals.map((journal) => (
              <div
                key={journal.id}
                className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-primary/20 active:scale-[0.99] transition-all touch-manipulation"
                onClick={() => router.push(`/journal/${journal.id}`)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-medium text-foreground truncate flex-1">{journal.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {getPreview(journal.content)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistance(new Date(journal.updated_at), new Date(), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
