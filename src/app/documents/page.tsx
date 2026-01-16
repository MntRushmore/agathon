'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';

export default function DocumentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDocuments() {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        toast.error('Failed to load documents');
        return;
      }

      setDocuments(data || []);
      setLoading(false);
    }

    loadDocuments();
  }, [user]);

  const createDocument = async () => {
    const { data, error } = await supabase
      .from('documents')
      .insert([{
        user_id: user!.id,
        title: 'Untitled Document',
        content: {},
      }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create document');
      return;
    }

    router.push(`/documents/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">My Documents</h1>
          <Button
            onClick={createDocument}
            className="min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : documents.length === 0 ? (
          <Card className="p-8 md:p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No documents yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first document to get started
            </p>
            <Button
              onClick={createDocument}
              className="min-h-[44px] touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Document
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:shadow-lg active:shadow-md active:scale-[0.98] transition-all touch-manipulation"
                onClick={() => router.push(`/documents/${doc.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg truncate">
                    {doc.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                    {doc.preview || 'Empty document'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistance(new Date(doc.updated_at), new Date(), { addSuffix: true })}
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
