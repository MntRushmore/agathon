'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { MathInline, MathBlock } from '@/lib/tiptap/math-extension';
import { EditorToolbar } from './EditorToolbar';
import { useCallback, useEffect } from 'react';

interface DocumentEditorProps {
  content: any;
  onChange: (content: any) => void;
  editable?: boolean;
}

export function DocumentEditor({ content, onChange, editable = true }: DocumentEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start typing or insert an equation...',
      }),
      Typography,
      MathInline,
      MathBlock,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg">
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-6 focus:outline-none min-h-[500px]"
      />
    </div>
  );
}
