'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { MathStepEditor } from '@/components/documents/MathStepEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';

function extractPreview(content: any): string {
  try {
    if (Array.isArray(content)) {
      return content.map(step => step.latex).join(' ').slice(0, 200);
    }
    return '';
  } catch {
    return '';
  }
}

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [document, setDocument] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load document
  useEffect(() => {
    async function loadDocument() {
      if (!user) return;

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        toast.error('Failed to load document');
        return;
      }

      setDocument(data);
      setTitle(data.title);
      setContent(Array.isArray(data.content) ? data.content : [{ id: '1', latex: '' }]);
      setLoading(false);
    }

    loadDocument();
  }, [params.id, user]);

  // Auto-save with debounce
  const saveDocument = useCallback(
    debounce(async (newTitle: string, newContent: any) => {
      if (!document) return;

      setSaving(true);
      const { error } = await supabase
        .from('documents')
        .update({
          title: newTitle,
          content: newContent,
          preview: extractPreview(newContent),
        })
        .eq('id', document.id);

      if (error) {
        toast.error('Failed to save');
      }
      setSaving(false);
    }, 1000),
    [document, supabase]
  );

  const handleContentChange = (newContent: any) => {
    setContent(newContent);
    saveDocument(title, newContent);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    saveDocument(newTitle, content);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/documents')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-xl font-semibold border-none shadow-none flex-1"
            placeholder="Untitled Document"
          />

          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-sm text-muted-foreground">Saving...</span>
            )}
            <Button variant="ghost" size="icon">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="px-6 py-8">
        <MathStepEditor
          content={content}
          onChange={handleContentChange}
          editable={true}
        />
      </div>
    </div>
  );
}
