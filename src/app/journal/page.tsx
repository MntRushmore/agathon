'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, BookOpen, ArrowLeft } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';

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
    <div className="min-h-screen bg-[#FAF9F6] p-4 md:p-8 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold flex-1">Journals</h1>
          <Button
            onClick={createJournal}
            className="min-h-[44px] min-w-[44px] touch-manipulation bg-[#16A34A] hover:bg-[#15803d]"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Journal
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : journals.length === 0 ? (
          <Card className="p-8 md:p-12 text-center bg-white border-gray-200">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">No journals yet</h2>
            <p className="text-gray-500 mb-6">
              Create your first journal to start writing with AI-powered study tools
            </p>
            <Button
              onClick={createJournal}
              className="min-h-[44px] touch-manipulation bg-[#16A34A] hover:bg-[#15803d]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Journal
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {journals.map((journal) => (
              <Card
                key={journal.id}
                className="cursor-pointer hover:shadow-lg active:shadow-md active:scale-[0.98] transition-all touch-manipulation bg-white border-gray-200"
                onClick={() => router.push(`/journal/${journal.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg truncate flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-[#16A34A]" />
                    {journal.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                    {getPreview(journal.content)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Updated {formatDistance(new Date(journal.updated_at), new Date(), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
