'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { Node, mergeAttributes } from '@tiptap/core';

// Custom Math extension for inline LaTeX
const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = HTMLAttributes.latex || '';
    let html = '';
    try {
      html = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      html = latex;
    }
    return ['span', mergeAttributes({ 'data-math': '', class: 'math-inline' }), ['span', { dangerouslySetInnerHTML: { __html: html } }]];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'math-inline inline-block mx-0.5';
      dom.setAttribute('data-math', '');
      
      try {
        dom.innerHTML = katex.renderToString(node.attrs.latex, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        dom.textContent = node.attrs.latex;
      }
      
      return { dom };
    };
  },
});

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
      MathInline,
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
  
  let html = markdown;
  
  // Convert headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Convert bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert LaTeX math $...$
  html = html.replace(/\$([^$]+)\$/g, (_, latex) => {
    try {
      const rendered = katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      return `<span class="math-inline">${rendered}</span>`;
    } catch {
      return `$${latex}$`;
    }
  });
  
  // Convert bullet lists
  const bulletListRegex = /^- (.+)$/gm;
  let inBulletList = false;
  const lines = html.split('\n');
  const processedLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^- (.+)$/);
    
    if (bulletMatch) {
      if (!inBulletList) {
        processedLines.push('<ul>');
        inBulletList = true;
      }
      processedLines.push(`<li>${bulletMatch[1]}</li>`);
    } else {
      if (inBulletList) {
        processedLines.push('</ul>');
        inBulletList = false;
      }
      // Wrap non-empty, non-HTML lines in paragraphs
      if (line.trim() && !line.startsWith('<')) {
        processedLines.push(`<p>${line}</p>`);
      } else if (line.trim()) {
        processedLines.push(line);
      }
    }
  }
  
  if (inBulletList) {
    processedLines.push('</ul>');
  }
  
  return processedLines.join('\n');
}

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>([^<]+)<\/h1>/g, '# $1');
  markdown = markdown.replace(/<h2[^>]*>([^<]+)<\/h2>/g, '## $1');
  markdown = markdown.replace(/<h3[^>]*>([^<]+)<\/h3>/g, '### $1');
  
  // Convert bold
  markdown = markdown.replace(/<strong>([^<]+)<\/strong>/g, '**$1**');
  
  // Convert italic
  markdown = markdown.replace(/<em>([^<]+)<\/em>/g, '*$1*');
  
  // Convert inline code
  markdown = markdown.replace(/<code>([^<]+)<\/code>/g, '`$1`');
  
  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>/g, '');
  markdown = markdown.replace(/<\/ul>/g, '');
  markdown = markdown.replace(/<li>([^<]+)<\/li>/g, '- $1');
  
  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>/g, '');
  markdown = markdown.replace(/<\/p>/g, '\n');
  
  // Clean up
  markdown = markdown.replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
  markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  
  return markdown.trim();
}
