'use client';

import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import MathExtension from '@aarkue/tiptap-math-extension';
import { Table as TiptapTable } from '@tiptap/extension-table';
import { TableRow as TiptapTableRow } from '@tiptap/extension-table-row';
import { TableCell as TiptapTableCell } from '@tiptap/extension-table-cell';
import { TableHeader as TiptapTableHeader } from '@tiptap/extension-table-header';
import { Extension } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, Code, Quote,
  Sparkles, Layers, ClipboardList, ImagePlus, Type, Minus,
  Table, ChevronDown, Sigma, PenTool, LineChart, BarChart3,
  FileText, Link as LinkIcon, Image, AudioLines, Video, Youtube, FileType,
  Bold, Italic, UnderlineIcon, Strikethrough, Link2,
  Volume2, Square as StopIcon, Loader2,
} from 'lucide-react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

// Slash command item type
interface SlashCommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  description?: string;
}

// All available slash commands
const slashCommandItems: SlashCommandItem[] = [
  // Build with Feynman
  { id: 'notes', label: 'Generate notes', icon: Sparkles, category: 'Build with Feynman', description: 'AI-generated study notes' },
  { id: 'practice', label: 'Generate practice problems', icon: ClipboardList, category: 'Build with Feynman', description: 'AI-generated practice problems' },
  { id: 'flashcards', label: 'Generate flashcards', icon: Layers, category: 'Build with Feynman', description: 'AI-generated flashcards' },
  { id: 'generate-image', label: 'Generate image', icon: ImagePlus, category: 'Build with Feynman', description: 'AI-generated diagram' },
  // Basic editing
  { id: 'text', label: 'Text', icon: Type, category: 'Basic editing', description: 'Plain text paragraph' },
  { id: 'h1', label: 'Heading 1', icon: Heading1, category: 'Basic editing', description: 'Large heading' },
  { id: 'h2', label: 'Heading 2', icon: Heading2, category: 'Basic editing', description: 'Medium heading' },
  { id: 'h3', label: 'Heading 3', icon: Heading3, category: 'Basic editing', description: 'Small heading' },
  { id: 'bullet', label: 'Bullet list', icon: List, category: 'Basic editing', description: 'Unordered list' },
  { id: 'numbered', label: 'Numbered list', icon: ListOrdered, category: 'Basic editing', description: 'Ordered list' },
  { id: 'quote', label: 'Quote', icon: Quote, category: 'Basic editing', description: 'Block quote' },
  { id: 'divider', label: 'Divider', icon: Minus, category: 'Basic editing', description: 'Horizontal line' },
  // Advanced editing
  { id: 'table', label: 'Table', icon: Table, category: 'Advanced editing', description: 'Data table' },
  { id: 'details', label: 'Details', icon: ChevronDown, category: 'Advanced editing', description: 'Collapsible section' },
  { id: 'code', label: 'Code block', icon: Code, category: 'Advanced editing', description: 'Code snippet' },
  { id: 'latex', label: 'LaTeX block', icon: Sigma, category: 'Advanced editing', description: 'Math equation' },
  // Interactive editing
  { id: 'whiteboard', label: 'Whiteboard', icon: PenTool, category: 'Interactive editing', description: 'Drawing canvas' },
  { id: 'desmos', label: 'Desmos graph', icon: LineChart, category: 'Interactive editing', description: 'Interactive graph' },
  { id: 'chart', label: 'Chart', icon: BarChart3, category: 'Interactive editing', description: 'Data visualization' },
  // Journals
  { id: 'subjournal', label: 'Subjournal', icon: FileText, category: 'Journals', description: 'Create sub-journal' },
  { id: 'link-journal', label: 'Link to journal', icon: LinkIcon, category: 'Journals', description: 'Link existing journal' },
  // Media
  { id: 'image', label: 'Image', icon: Image, category: 'Media', description: 'Upload image' },
  { id: 'audio', label: 'Audio', icon: AudioLines, category: 'Media', description: 'Upload audio' },
  { id: 'video', label: 'Video', icon: Video, category: 'Media', description: 'Upload video' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, category: 'Media', description: 'Embed YouTube' },
  { id: 'pdf', label: 'PDF', icon: FileType, category: 'Media', description: 'Upload PDF' },
];

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  onSlashCommand?: (commandId: string) => void;
}

// Slash command menu component
interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  selectedIndex: number;
}

interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command, selectedIndex }, ref) => {
    const [localSelectedIndex, setLocalSelectedIndex] = useState(selectedIndex);

    useEffect(() => {
      setLocalSelectedIndex(selectedIndex);
    }, [selectedIndex]);

    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    }, [items, command]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setLocalSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setLocalSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(localSelectedIndex);
          return true;
        }
        return false;
      },
    }), [items.length, localSelectedIndex, selectItem]);

    // Group items by category
    const groupedItems = items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, SlashCommandItem[]>);

    let globalIndex = 0;

    return (
      <div className="bg-[#F7F0E3] rounded-xl shadow-2xl border border-[#CFC0A8] py-2 max-h-[400px] overflow-y-auto min-w-[280px]">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            <div className="px-3 py-1.5 text-xs font-medium text-[#9B8B78] uppercase tracking-wider">
              {category}
            </div>
            {categoryItems.map((item) => {
              const currentIndex = globalIndex++;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => selectItem(currentIndex)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                    currentIndex === localSelectedIndex ? 'bg-[#E8DCC0]' : 'hover:bg-[#F0E4CC]'
                  )}
                >
                  <Icon className={cn(
                    'h-5 w-5 flex-shrink-0',
                    currentIndex === localSelectedIndex ? 'text-[#1A6B8A]' : 'text-[#9B8B78]'
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm font-medium',
                      currentIndex === localSelectedIndex ? 'text-[#1A6B8A]' : 'text-[#5C4B3A]'
                    )}>
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-xs text-[#9B8B78] truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-3 py-4 text-sm text-[#9B8B78] text-center">
            No commands found
          </div>
        )}
      </div>
    );
  }
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className,
  onSlashCommand
}: RichTextEditorProps) {
  // Create slash command extension
  const SlashCommands = Extension.create({
    name: 'slashCommands',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          command: ({ editor, range, props }: { editor: any; range: any; props: SlashCommandItem }) => {
            // Delete the slash command text
            editor.chain().focus().deleteRange(range).run();

            // Handle the command
            const commandId = props.id;

            // Format commands that can be handled directly in the editor
            switch (commandId) {
              case 'h1':
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                break;
              case 'h2':
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                break;
              case 'h3':
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                break;
              case 'bullet':
                editor.chain().focus().toggleBulletList().run();
                break;
              case 'numbered':
                editor.chain().focus().toggleOrderedList().run();
                break;
              case 'quote':
                editor.chain().focus().toggleBlockquote().run();
                break;
              case 'code':
                editor.chain().focus().toggleCodeBlock().run();
                break;
              case 'divider':
                editor.chain().focus().setHorizontalRule().run();
                break;
              case 'table':
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                break;
              default:
                // Pass to parent handler for AI commands and interactive elements
                if (onSlashCommand) {
                  onSlashCommand(commandId);
                }
            }
          },
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
          items: ({ query }: { query: string }) => {
            return slashCommandItems.filter(item =>
              item.label.toLowerCase().includes(query.toLowerCase())
            );
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props: SuggestionProps<SlashCommandItem>) => {
                component = new ReactRenderer(SlashCommandMenu, {
                  props: {
                    ...props,
                    selectedIndex: 0,
                  },
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
                component?.updateProps(props);

                if (!props.clientRect || !popup) return;

                popup[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }

                const ref = component?.ref as SlashCommandMenuRef | null;
                return ref?.onKeyDown?.(props) ?? false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        }),
      ];
    },
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-[#EDE3CC] rounded-lg p-4 my-4 font-mono text-sm overflow-x-auto',
          },
        },
        code: {
          HTMLAttributes: {
            class: 'bg-[#E8DCC0] rounded px-1.5 py-0.5 font-mono text-sm',
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
            class: 'border-l-4 border-[#8DA878] pl-4 my-4 italic text-[#6B5A48]',
          },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#1A6B8A] underline decoration-[#1A6B8A]/40 hover:decoration-[#1A6B8A]',
        },
      }),
      MathExtension.configure({
        evaluation: false,
        katexOptions: {
          throwOnError: false,
        },
      }),
      TiptapTable.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-4',
        },
      }),
      TiptapTableRow.configure({
        HTMLAttributes: {
          class: '',
        },
      }),
      TiptapTableHeader.configure({
        HTMLAttributes: {
          class: 'border border-[#CFC0A8] bg-[#E8DCC0] px-4 py-2 text-left font-semibold',
        },
      }),
      TiptapTableCell.configure({
        HTMLAttributes: {
          class: 'border border-[#CFC0A8] px-4 py-2',
        },
      }),
      SlashCommands,
    ],
    content: parseContentToHTML(content),
    editorProps: {
      attributes: {
        class: cn(
          'prose max-w-none focus:outline-none min-h-[60vh]',
          'prose-headings:font-bold prose-headings:text-[#3A2E1E]',
          'prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4',
          'prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3',
          'prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2',
          'prose-p:text-[#5C4B3A] prose-p:leading-relaxed prose-p:my-3',
          'prose-li:text-[#5C4B3A]',
          'prose-strong:font-semibold prose-strong:text-[#3A2E1E]',
        ),
      },
      handleClick: (view, pos, event) => {
        // Check if clicked on a math node
        const target = event.target as HTMLElement;
        const mathNode = target.closest('.tiptap-math.latex') as HTMLElement;
        if (mathNode) {
          // Find the node at this position
          const { state } = view;
          const $pos = state.doc.resolve(pos);
          const node = $pos.nodeAfter || $pos.nodeBefore;

          if (node && node.type.name === 'inlineMath') {
            const latex = node.attrs.latex || '';
            const isDisplay = node.attrs.display === 'yes';
            const wrapper = isDisplay ? '$$' : '$';

            // Get the position of the math node
            let nodePos = pos;
            if ($pos.nodeBefore && $pos.nodeBefore.type.name === 'inlineMath') {
              nodePos = pos - $pos.nodeBefore.nodeSize;
            }

            // Replace the node with editable text
            const tr = state.tr;
            tr.delete(nodePos, nodePos + node.nodeSize);
            tr.insertText(`${wrapper}${latex}${wrapper}`, nodePos);
            // Position cursor inside the LaTeX, selecting all the LaTeX content
            const cursorPos = nodePos + wrapper.length;
            tr.setSelection(TextSelection.create(tr.doc, cursorPos, cursorPos + latex.length));
            view.dispatch(tr);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
    onSelectionUpdate: ({ editor }) => {
      // Check if there are any $...$ patterns in text nodes that need to be converted
      const { state } = editor;
      const { doc, selection } = state;
      const cursorPos = selection.from;

      // Find text nodes with $...$ patterns
      let foundMatch = false;
      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const text = node.text;
          // Match $...$ but not $$...$$
          const regex = /(?<!\$)\$([^$]+)\$(?!\$)/g;
          let match;
          while ((match = regex.exec(text)) !== null) {
            const matchStart = pos + match.index;
            const matchEnd = matchStart + match[0].length;

            // Only convert if cursor is NOT inside this match
            if (cursorPos < matchStart || cursorPos > matchEnd) {
              // Found a match that needs converting - do it after this iteration
              const latex = match[1];
              foundMatch = true;

              // Use setTimeout to avoid modifying during iteration
              setTimeout(() => {
                const { state: newState } = editor;
                const tr = newState.tr;

                // Verify the text is still there
                const $pos = newState.doc.resolve(matchStart);
                const textNode = $pos.nodeAfter;
                if (textNode?.isText && textNode.text?.includes(match![0])) {
                  // Delete the $...$ text
                  tr.delete(matchStart, matchEnd);
                  // Insert a math node
                  const mathNodeType = newState.schema.nodes.inlineMath;
                  if (mathNodeType) {
                    tr.insert(matchStart, mathNodeType.create({ latex }));
                    editor.view.dispatch(tr);
                  }
                }
              }, 0);
              return false; // Stop searching
            }
          }
        }
      });
    },
  });


  // Bubble menu ref and plugin setup
  const bubbleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor || !bubbleMenuRef.current) return;

    const element = bubbleMenuRef.current;

    const plugin = BubbleMenuPlugin({
      pluginKey: 'bubbleMenu',
      editor,
      element,
      updateDelay: 100,
      shouldShow: ({ editor: ed, state }) => {
        const { selection } = state;
        const { empty } = selection;
        // Don't show for empty selections or code blocks
        if (empty || ed.isActive('codeBlock')) return false;
        return true;
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      editor.unregisterPlugin('bubbleMenu');
    };
  }, [editor]);

  // TTS (ElevenLabs) state
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleReadAloud = useCallback(async () => {
    if (!editor) return;

    // If already playing, stop
    if (ttsPlaying && ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      setTtsPlaying(false);
      return;
    }

    // Get selected text
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    setTtsLoading(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText }),
      });

      if (!res.ok) {
        throw new Error('TTS request failed');
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Clean up previous audio
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        URL.revokeObjectURL(ttsAudioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setTtsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setTtsPlaying(true);
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setTtsLoading(false);
    }
  }, [editor, ttsPlaying]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        URL.revokeObjectURL(ttsAudioRef.current.src);
      }
    };
  }, []);

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
    <div className={cn('relative flex gap-4', className)}>
      {/* Left Sidebar Toolbar - sticky within editor */}
      <div className="sticky top-24 self-start z-40 flex-shrink-0">
        <div className="flex flex-col items-center gap-1 bg-[#F7F0E3] rounded-xl shadow-lg border border-[#CFC0A8] p-1.5">
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('heading', { level: 1 }) && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('heading', { level: 2 }) && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('heading', { level: 3 }) && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </button>
          <div className="w-5 h-px bg-[#CFC0A8] my-1" />
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('bulletList') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('orderedList') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('blockquote') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('codeBlock') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 min-w-0 relative">
      {/* Bubble Menu - floating toolbar on text selection */}
      <div
        ref={bubbleMenuRef}
        className="flex items-center gap-0.5 bg-[#F7F0E3] rounded-xl shadow-xl border border-[#CFC0A8] px-1.5 py-1 z-50"
        style={{ visibility: 'hidden', opacity: 0, transition: 'opacity 0.15s ease', position: 'absolute' }}
      >
        {/* Bold */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            editor.isActive('bold')
              ? 'bg-[#D4E8F0] text-[#1A6B8A]'
              : 'text-[#5C4B3A] hover:bg-[#E8DCC0]'
          )}
          title="Bold"
        >
          <Bold className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {/* Italic */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            editor.isActive('italic')
              ? 'bg-[#D4E8F0] text-[#1A6B8A]'
              : 'text-[#5C4B3A] hover:bg-[#E8DCC0]'
          )}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>

        {/* Underline */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleUnderline().run();
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            editor.isActive('underline')
              ? 'bg-[#D4E8F0] text-[#1A6B8A]'
              : 'text-[#5C4B3A] hover:bg-[#E8DCC0]'
          )}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </button>

        {/* Strikethrough */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleStrike().run();
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            editor.isActive('strike')
              ? 'bg-[#D4E8F0] text-[#1A6B8A]'
              : 'text-[#5C4B3A] hover:bg-[#E8DCC0]'
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        {/* Link */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            editor.isActive('link')
              ? 'bg-[#D4E8F0] text-[#1A6B8A]'
              : 'text-[#5C4B3A] hover:bg-[#E8DCC0]'
          )}
          title="Link"
        >
          <Link2 className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-[#CFC0A8] mx-1" />

        {/* Read Aloud (ElevenLabs TTS) */}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleReadAloud();
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
            ttsPlaying
              ? 'bg-[#D4E8F0] text-[#1A6B8A]'
              : 'text-[#5C4B3A] hover:bg-[#E8DCC0]'
          )}
          title={ttsPlaying ? 'Stop reading' : 'Read aloud'}
          disabled={ttsLoading}
        >
          {ttsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ttsPlaying ? (
            <StopIcon className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">
            {ttsLoading ? 'Loading...' : ttsPlaying ? 'Stop' : 'Read'}
          </span>
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9B8B78;
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
        /* TipTap Math Extension styling */
        .Tiptap-mathematics-editor {
          background: #EDE3CC;
          border-radius: 4px;
          padding: 2px 6px;
          font-family: 'KaTeX_Math', 'Times New Roman', serif;
        }
        .Tiptap-mathematics-render {
          padding: 0 2px;
        }
        .Tiptap-mathematics-editor:focus {
          outline: 2px solid #1A6B8A;
          outline-offset: 1px;
        }
        /* Math nodes - clickable and hoverable */
        .tiptap-math.latex {
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
        }
        .tiptap-math.latex:hover {
          background-color: #E8DCC0;
          box-shadow: 0 0 0 2px #B0A06A;
        }
        .ProseMirror .tiptap-math.latex.ProseMirror-selectednode {
          background-color: #D4C8A0;
          box-shadow: 0 0 0 2px #1A6B8A;
        }
        /* Rendered KaTeX math styling */
        .katex-rendered {
          display: inline-block;
          padding: 0 2px;
        }
        .katex-rendered .katex {
          font-size: 1.1em;
        }
        /* Block/display math styling */
        .katex-display {
          display: block;
          text-align: center;
          margin: 1em 0;
          overflow-x: auto;
        }
        .katex-display .katex {
          font-size: 1.2em;
        }
        /* Block math display */
        .Tiptap-mathematics-render--display {
          display: block;
          text-align: center;
          margin: 1em 0;
        }
        /* Remove tippy.js default styling */
        .tippy-box {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .tippy-content {
          padding: 0 !important;
        }
        .tippy-arrow {
          display: none !important;
        }
        /* Table styling */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          border: 1px solid #CFC0A8;
          padding: 8px 12px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror table th {
          font-weight: 600;
          text-align: left;
          background-color: #E8DCC0;
        }
        .ProseMirror table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: rgba(26, 107, 138, 0.2);
          pointer-events: none;
        }
        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #1A6B8A;
          pointer-events: none;
        }
        .tableWrapper {
          overflow-x: auto;
        }
      `}</style>
      </div>
    </div>
  );
}

// Convert markdown to HTML for TipTap
function parseContentToHTML(markdown: string): string {
  if (!markdown) return '';

  // First, preserve HTML embeds (iframes, divs with embeds, audio, video) - extract and replace with placeholders
  const htmlEmbeds: string[] = [];
  let processed = markdown.replace(/<div class="(youtube-embed|desmos-embed|whiteboard-embed)"[\s\S]*?<\/div>/g, (match) => {
    htmlEmbeds.push(match);
    return `__HTML_EMBED_${htmlEmbeds.length - 1}__`;
  });

  // Preserve standalone HTML elements (audio, video, iframe)
  processed = processed.replace(/<(audio|video|iframe)[^>]*>[\s\S]*?<\/\1>/g, (match) => {
    htmlEmbeds.push(match);
    return `__HTML_EMBED_${htmlEmbeds.length - 1}__`;
  });
  processed = processed.replace(/<(audio|video|iframe)[^>]*\/>/g, (match) => {
    htmlEmbeds.push(match);
    return `__HTML_EMBED_${htmlEmbeds.length - 1}__`;
  });

  // Handle display math ($$...$$) - convert to TipTap math nodes
  const displayMathBlocks: string[] = [];
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
    const escapedLatex = latex.trim().replace(/"/g, '&quot;');
    displayMathBlocks.push(`<p><span data-type="inlineMath" data-latex="${escapedLatex}" data-display="yes"></span></p>`);
    return `__DISPLAY_MATH_${displayMathBlocks.length - 1}__`;
  });

  // Handle code blocks (``` ... ```) - extract and replace with placeholders
  const codeBlocks: string[] = [];
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
    codeBlocks.push(`<pre><code>${code}</code></pre>`);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Handle markdown tables - extract and convert to HTML tables
  const tables: string[] = [];
  processed = processed.replace(/(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/g, (match, headerRow, separator, bodyRows) => {
    const parseRow = (row: string) => row.split('|').slice(1, -1).map(cell => cell.trim());
    const headers = parseRow(headerRow);
    const rows = bodyRows.trim().split('\n').map((r: string) => parseRow(r));

    let tableHtml = '<table><thead><tr>';
    headers.forEach(h => {
      tableHtml += `<th>${h}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    rows.forEach((row: string[]) => {
      tableHtml += '<tr>';
      row.forEach(cell => {
        tableHtml += `<td>${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    tables.push(tableHtml);
    return `__TABLE_${tables.length - 1}__`;
  });

  const lines = processed.split('\n');
  const processedLines: string[] = [];
  let inBulletList = false;
  let inOrderedList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Skip HTML embed placeholders
    if (line.match(/__HTML_EMBED_\d+__/)) {
      const idx = parseInt(line.match(/__HTML_EMBED_(\d+)__/)?.[1] || '0');
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(htmlEmbeds[idx]);
      continue;
    }

    // Skip code block placeholders
    if (line.match(/__CODE_BLOCK_\d+__/)) {
      const idx = parseInt(line.match(/__CODE_BLOCK_(\d+)__/)?.[1] || '0');
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(codeBlocks[idx]);
      continue;
    }

    // Skip display math placeholders
    if (line.match(/__DISPLAY_MATH_\d+__/)) {
      const idx = parseInt(line.match(/__DISPLAY_MATH_(\d+)__/)?.[1] || '0');
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(displayMathBlocks[idx]);
      continue;
    }

    // Skip table placeholders
    if (line.match(/__TABLE_\d+__/)) {
      const idx = parseInt(line.match(/__TABLE_(\d+)__/)?.[1] || '0');
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
      processedLines.push(tables[idx]);
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
      // First restore any display math placeholders that might be inline
      text = text.replace(/__DISPLAY_MATH_(\d+)__/g, (_, idx) => {
        return displayMathBlocks[parseInt(idx)] || '';
      });
      // Convert LaTeX math $...$ to TipTap math nodes
      text = text.replace(/\$([^$]+)\$/g, (_, latex) => {
        const escapedLatex = latex.trim().replace(/"/g, '&quot;');
        return `<span data-type="inlineMath" data-latex="${escapedLatex}"></span>`;
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

  // Preserve HTML embeds (youtube, desmos, whiteboard, audio, video) - extract and protect them
  const htmlEmbeds: string[] = [];
  markdown = markdown.replace(/<div class="(youtube-embed|desmos-embed|whiteboard-embed)"[\s\S]*?<\/div>/g, (match) => {
    htmlEmbeds.push(match);
    return `__PRESERVE_HTML_${htmlEmbeds.length - 1}__`;
  });
  markdown = markdown.replace(/<(audio|video)[^>]*>[\s\S]*?<\/\1>/g, (match) => {
    htmlEmbeds.push(match);
    return `__PRESERVE_HTML_${htmlEmbeds.length - 1}__`;
  });
  markdown = markdown.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/g, (match) => {
    htmlEmbeds.push(match);
    return `__PRESERVE_HTML_${htmlEmbeds.length - 1}__`;
  });

  // Convert TipTap math extension nodes back to $...$ syntax
  // The math extension stores the latex in a data attribute or special structure
  markdown = markdown.replace(/<span[^>]*class="[^"]*Tiptap-mathematics[^"]*"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/span>/g, '$$$1$$');
  markdown = markdown.replace(/<span[^>]*data-latex="([^"]*)"[^>]*class="[^"]*Tiptap-mathematics[^"]*"[^>]*>[\s\S]*?<\/span>/g, '$$$1$$');

  // Convert inline math that was rendered with katex-rendered class
  markdown = markdown.replace(/<span[^>]*class="katex-rendered"[^>]*>[\s\S]*?<\/span>/g, (match) => {
    // Try to extract the original latex - it's usually lost, so we preserve the rendered HTML
    // Best approach is to look for annotation with original tex
    const texMatch = match.match(/<annotation encoding="application\/x-tex">([^<]+)<\/annotation>/);
    if (texMatch) {
      return `$${texMatch[1]}$`;
    }
    return match;
  });

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

  // Extract LaTeX from any remaining KaTeX rendered output before stripping HTML
  // KaTeX includes the original tex in an annotation element
  markdown = markdown.replace(/<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g, '$$$1$$');

  // Clean up - remove remaining HTML tags (but not our preserved ones)
  markdown = markdown.replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
  markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines

  // Restore preserved HTML embeds
  htmlEmbeds.forEach((embed, idx) => {
    markdown = markdown.replace(`__PRESERVE_HTML_${idx}__`, `\n\n${embed}\n\n`);
  });

  return markdown.trim();
}
