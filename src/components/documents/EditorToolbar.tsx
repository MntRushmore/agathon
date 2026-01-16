'use client';

import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Sigma,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <div className="border-b p-2 flex gap-1 flex-wrap">
      <Button
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>

      <div className="w-px bg-border mx-1" />

      <Button
        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <div className="w-px bg-border mx-1" />

      <Button
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>

      <Button
        variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="w-px bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          editor.chain().focus().insertContent({
            type: 'mathInline',
            attrs: { latex: '' }
          }).run();
        }}
      >
        <Sigma className="h-4 w-4 mr-1" />
        Inline Math
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          editor.chain().focus().insertContent({
            type: 'mathBlock',
            attrs: { latex: '' }
          }).run();
        }}
      >
        <Sigma className="h-4 w-4 mr-1" />
        Block Math
      </Button>
    </div>
  );
}
