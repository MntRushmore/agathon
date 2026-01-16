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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Documents</h1>
          <Button onClick={createDocument}>
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : documents.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No documents yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first document to get started
            </p>
            <Button onClick={createDocument}>
              <Plus className="h-4 w-4 mr-2" />
              Create Document
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/documents/${doc.id}`)}
              >
                <CardHeader>
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
