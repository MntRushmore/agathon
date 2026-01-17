'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calculator, ArrowLeft } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';

interface MathWhiteboard {
  id: string;
  title: string;
  equations: any[];
  created_at: string;
  updated_at: string;
}

export default function MathWhiteboardsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [whiteboards, setWhiteboards] = useState<MathWhiteboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWhiteboards() {
      if (!user) return;

      const { data, error } = await supabase
        .from('math_whiteboards')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to load math whiteboards:', error);
        toast.error('Failed to load math whiteboards');
        setLoading(false);
        return;
      }

      setWhiteboards(data || []);
      setLoading(false);
    }

    loadWhiteboards();
  }, [user, supabase]);

  const createWhiteboard = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('math_whiteboards')
      .insert([{
        user_id: user.id,
        title: 'Untitled Math Board',
        equations: [],
        strokes: [],
        variables: {},
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create math whiteboard:', error);
      toast.error('Failed to create math whiteboard');
      return;
    }

    router.push(`/math/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
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
          <h1 className="text-2xl md:text-3xl font-bold flex-1">Math Whiteboards</h1>
          <Button
            onClick={createWhiteboard}
            className="min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Board
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : whiteboards.length === 0 ? (
          <Card className="p-8 md:p-12 text-center">
            <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No math boards yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first math whiteboard to start writing equations
            </p>
            <Button
              onClick={createWhiteboard}
              className="min-h-[44px] touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Math Board
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {whiteboards.map((board) => (
              <Card
                key={board.id}
                className="cursor-pointer hover:shadow-lg active:shadow-md active:scale-[0.98] transition-all touch-manipulation"
                onClick={() => router.push(`/math/${board.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg truncate flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    {board.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {board.equations?.length || 0} equation{(board.equations?.length || 0) !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistance(new Date(board.updated_at), new Date(), { addSuffix: true })}
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
