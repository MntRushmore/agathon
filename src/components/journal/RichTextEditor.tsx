'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import MathExtension from '@aarkue/tiptap-math-extension';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { Heading1, Heading2, Heading3, List, ListOrdered, Code, Quote } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = 'Start writing...',
  className 
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-[#F5F2EB] rounded-lg p-4 my-4 font-mono text-sm overflow-x-auto',
          },
        },
        code: {
          HTMLAttributes: {
            class: 'bg-gray-100 rounded px-1.5 py-0.5 font-mono text-sm',
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc ml-6 my-2 space-y-1',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal ml-6 my-2 space-y-1',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-green-300 pl-4 my-4 italic text-gray-600',
          },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      MathExtension.configure({
        evaluation: false,
        katexOptions: {
          throwOnError: false,
        },
      }),
    ],
    content: parseContentToHTML(content),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-gray max-w-none focus:outline-none min-h-[60vh]',
          'prose-headings:font-bold prose-headings:text-gray-900',
          'prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4',
          'prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3',
          'prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2',
          'prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-3',
          'prose-li:text-gray-700',
          'prose-strong:font-semibold prose-strong:text-gray-900',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  });

  // Fixed left toolbar state - must be before any early returns
  const [showToolbar, setShowToolbar] = useState(false);

  // Update editor content when prop changes externally
  useEffect(() => {
    if (editor && content) {
      const currentHTML = editor.getHTML();
      const newHTML = parseContentToHTML(content);
      // Only update if content is significantly different
      if (currentHTML !== newHTML && !editor.isFocused) {
        editor.commands.setContent(newHTML);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      {/* Fixed Left Sidebar Toolbar */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40">
        <div className="flex flex-col items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('heading', { level: 1 }) && 'bg-green-50 text-green-600'
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('heading', { level: 2 }) && 'bg-green-50 text-green-600'
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('heading', { level: 3 }) && 'bg-green-50 text-green-600'
            )}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>
          <div className="w-5 h-px bg-gray-200 my-1" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('bulletList') && 'bg-green-50 text-green-600'
            )}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('orderedList') && 'bg-green-50 text-green-600'
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('blockquote') && 'bg-green-50 text-green-600'
            )}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900',
              editor.isActive('codeBlock') && 'bg-green-50 text-green-600'
            )}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .math-inline .katex {
          font-size: 1em;
        }
      `}</style>
    </div>
  );
}

// Convert markdown to HTML for TipTap
function parseContentToHTML(markdown: string): string {
  if (!markdown) return '';
  
  // First, handle code blocks (``` ... ```) - extract and replace with placeholders
  const codeBlocks: string[] = [];
  let processed = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
    codeBlocks.push(`<pre><code>${code}</code></pre>`);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  
  const lines = processed.split('\n');
  const processedLines: string[] = [];
  let inBulletList = false;
  let inOrderedList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip code block placeholders
    if (line.match(/__CODE_BLOCK_\d+__/)) {
      const idx = parseInt(line.match(/__CODE_BLOCK_(\d+)__/)?.[1] || '0');
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(codeBlocks[idx]);
      continue;
    }
    
    // Check for headings/lists FIRST (on original line structure)
    const h3Match = line.match(/^### (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h1Match = line.match(/^# (.+)$/);
    const bulletMatch = line.match(/^[-*] (.+)$/);
    const orderedMatch = line.match(/^\d+\. (.+)$/);
    
    // Helper function to process inline formatting
    const processInline = (text: string): string => {
      // Render LaTeX math $...$ using KaTeX
      text = text.replace(/\$([^$\n]+)\$/g, (_, latex) => {
        try {
          const rendered = katex.renderToString(latex.trim(), {
            displayMode: false,
            throwOnError: false,
          });
          return `<span class="katex-rendered">${rendered}</span>`;
        } catch {
          return `$${latex}$`;
        }
      });
      // Convert bold (before italic)
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Convert italic
      text = text.replace(/(?<![*\w])\*([^*]+)\*(?![*\w])/g, '<em>$1</em>');
      // Convert inline code
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      return text;
    };
    
    // Close any open lists if we're switching types
    if (!bulletMatch && inBulletList) {
      processedLines.push('</ul>');
      inBulletList = false;
    }
    if (!orderedMatch && inOrderedList) {
      processedLines.push('</ol>');
      inOrderedList = false;
    }
    
    if (h3Match) {
      processedLines.push(`<h3>${processInline(h3Match[1])}</h3>`);
    } else if (h2Match) {
      processedLines.push(`<h2>${processInline(h2Match[1])}</h2>`);
    } else if (h1Match) {
      processedLines.push(`<h1>${processInline(h1Match[1])}</h1>`);
    } else if (bulletMatch) {
      if (!inBulletList) {
        processedLines.push('<ul>');
        inBulletList = true;
      }
      processedLines.push(`<li>${processInline(bulletMatch[1])}</li>`);
    } else if (orderedMatch) {
      if (!inOrderedList) {
        processedLines.push('<ol>');
        inOrderedList = true;
      }
      processedLines.push(`<li>${processInline(orderedMatch[1])}</li>`);
    } else if (line.trim()) {
      // Regular paragraph
      processedLines.push(`<p>${processInline(line)}</p>`);
    }
  }
  
  // Close any remaining open lists
  if (inBulletList) {
    processedLines.push('</ul>');
  }
  if (inOrderedList) {
    processedLines.push('</ol>');
  }
  
  return processedLines.join('');
}

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // Convert headings (add newline before for proper spacing)
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, '\n# $1\n');
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n## $1\n');
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n### $1\n');
  
  // Convert bold
  markdown = markdown.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**');
  
  // Convert italic
  markdown = markdown.replace(/<em>([\s\S]*?)<\/em>/g, '*$1*');
  
  // Convert inline code
  markdown = markdown.replace(/<code>([\s\S]*?)<\/code>/g, '`$1`');
  
  // Convert ordered lists with numbering
  let listItemIndex = 0;
  markdown = markdown.replace(/<ol[^>]*>/g, () => { listItemIndex = 0; return '\n'; });
  markdown = markdown.replace(/<\/ol>/g, '\n');
  markdown = markdown.replace(/<li>([\s\S]*?)<\/li>/g, (match, content) => {
    // Check if we're in an ordered list context (crude check)
    listItemIndex++;
    return `- ${content}\n`;
  });
  
  // Convert unordered lists
  markdown = markdown.replace(/<ul[^>]*>/g, '\n');
  markdown = markdown.replace(/<\/ul>/g, '\n');
  
  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n');
  
  // Clean up
  markdown = markdown.replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
  markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  
  return markdown.trim();
}
