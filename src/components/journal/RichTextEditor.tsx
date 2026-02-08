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
import { Extension, Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import {
  TextHOne, TextHTwo, TextHThree, ListBullets, ListNumbers, Code, Quotes,
  Sparkle, Stack, ClipboardText, ImageSquare, TextT, Minus,
  Table, CaretDown, MathOperations, PenNib, ChartLine, ChartBar,
  FileText, Link as LinkIcon, Image, Waveform, VideoCamera, YoutubeLogo, FileDoc,
  TextB, TextItalic, TextUnderline, TextStrikethrough, LinkSimple,
  SpeakerHigh, Stop as StopIcon, CircleNotch,
} from '@phosphor-icons/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

// Custom TipTap node: Details (collapsible section)
const DetailsNode = Node.create({
  name: 'details',
  group: 'block',
  defining: true,
  content: 'detailsSummary detailsContent',
  parseHTML() {
    return [{ tag: 'details' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['details', { ...HTMLAttributes, open: 'true' }, 0];
  },
});

const DetailsSummaryNode = Node.create({
  name: 'detailsSummary',
  defining: true,
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'summary' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['summary', HTMLAttributes, 0];
  },
});

const DetailsContentNode = Node.create({
  name: 'detailsContent',
  defining: true,
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-details-content]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-details-content': '' }, 0];
  },
});

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
  { id: 'notes', label: 'Generate notes', icon: Sparkle, category: 'Build with Feynman', description: 'AI-generated study notes' },
  { id: 'practice', label: 'Generate practice problems', icon: ClipboardText, category: 'Build with Feynman', description: 'AI-generated practice problems' },
  { id: 'flashcards', label: 'Generate flashcards', icon: Stack, category: 'Build with Feynman', description: 'AI-generated flashcards' },
  { id: 'generate-image', label: 'Generate image', icon: ImageSquare, category: 'Build with Feynman', description: 'AI-generated diagram' },
  // Advanced editing
  { id: 'table', label: 'Table', icon: Table, category: 'Advanced editing', description: 'Data table' },
  { id: 'details', label: 'Details', icon: CaretDown, category: 'Advanced editing', description: 'Collapsible section' },
  { id: 'code', label: 'Code block', icon: Code, category: 'Advanced editing', description: 'Code snippet' },
  { id: 'latex', label: 'LaTeX block', icon: MathOperations, category: 'Advanced editing', description: 'Math equation' },
  // Interactive editing
  { id: 'whiteboard', label: 'Whiteboard', icon: PenNib, category: 'Interactive editing', description: 'Drawing canvas' },
  { id: 'desmos', label: 'Desmos graph', icon: ChartLine, category: 'Interactive editing', description: 'Interactive graph' },
  { id: 'chart', label: 'Chart', icon: ChartBar, category: 'Interactive editing', description: 'Data visualization' },
  // Journals
  { id: 'subjournal', label: 'Subjournal', icon: FileText, category: 'Journals', description: 'Create sub-journal' },
  { id: 'link-journal', label: 'Link to journal', icon: LinkIcon, category: 'Journals', description: 'Link existing journal' },
  // Media
  { id: 'image', label: 'Image', icon: Image, category: 'Media', description: 'Upload image' },
  { id: 'audio', label: 'Audio', icon: Waveform, category: 'Media', description: 'Upload audio' },
  { id: 'video', label: 'Video', icon: VideoCamera, category: 'Media', description: 'Upload video' },
  { id: 'youtube', label: 'YouTube', icon: YoutubeLogo, category: 'Media', description: 'Embed YouTube' },
  { id: 'pdf', label: 'PDF', icon: FileDoc, category: 'Media', description: 'Upload PDF' },
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
            const commandId = props.id;

            // All block-type commands must be chained with deleteRange in a single
            // transaction to avoid race conditions where the block type command
            // runs before the deletion has settled.
            switch (commandId) {
              case 'text':
                editor.chain().focus().deleteRange(range).clearNodes().run();
                break;
              case 'h1':
                editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
                break;
              case 'h2':
                editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
                break;
              case 'h3':
                editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
                break;
              case 'bullet':
                editor.chain().focus().deleteRange(range).toggleBulletList().run();
                break;
              case 'numbered':
                editor.chain().focus().deleteRange(range).toggleOrderedList().run();
                break;
              case 'quote':
                editor.chain().focus().deleteRange(range).setBlockquote().run();
                break;
              case 'code':
                editor.chain().focus().deleteRange(range).setCodeBlock().run();
                break;
              case 'divider':
                editor.chain().focus().deleteRange(range).setHorizontalRule().run();
                break;
              case 'table':
                editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                break;
              case 'details':
                editor.chain().focus().deleteRange(range).insertContent({
                  type: 'details',
                  content: [
                    { type: 'detailsSummary', content: [{ type: 'text', text: 'Click to expand' }] },
                    { type: 'detailsContent', content: [{ type: 'paragraph' }] },
                  ],
                }).run();
                break;
              case 'latex':
                editor.chain().focus().deleteRange(range).insertContent({
                  type: 'inlineMath',
                  attrs: { latex: 'E = mc^2' },
                }).run();
                break;
              default:
                // For non-editor commands (AI, media, etc.), just delete the slash text
                // and pass to parent handler
                editor.chain().focus().deleteRange(range).run();
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
          HTMLAttributes: { class: '' },
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
          HTMLAttributes: { class: '' },
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
      DetailsNode,
      DetailsSummaryNode,
      DetailsContentNode,
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
            <TextHOne className="h-4 w-4" weight="duotone" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('heading', { level: 2 }) && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Heading 2"
          >
            <TextHTwo className="h-4 w-4" weight="duotone" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('heading', { level: 3 }) && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Heading 3"
          >
            <TextHThree className="h-4 w-4" weight="duotone" />
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
            <ListBullets className="h-4 w-4" weight="duotone" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('orderedList') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Numbered List"
          >
            <ListNumbers className="h-4 w-4" weight="duotone" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('blockquote') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Quote"
          >
            <Quotes className="h-4 w-4" weight="duotone" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCodeBlock().run(); }}
            className={cn(
              'p-2 rounded-lg hover:bg-[#E8DCC0] transition-colors text-[#6B5A48] hover:text-[#3A2E1E]',
              editor.isActive('codeBlock') && 'bg-[#D4E8F0] text-[#1A6B8A]'
            )}
            title="Code Block"
          >
            <Code className="h-4 w-4" weight="duotone" />
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
          <TextB className="h-4 w-4" weight="bold" />
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
          <TextItalic className="h-4 w-4" weight="duotone" />
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
          <TextUnderline className="h-4 w-4" weight="duotone" />
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
          <TextStrikethrough className="h-4 w-4" weight="duotone" />
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
          <LinkSimple className="h-4 w-4" weight="duotone" />
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
            <CircleNotch className="h-4 w-4 animate-spin" />
          ) : ttsPlaying ? (
            <StopIcon className="h-3.5 w-3.5" weight="fill" />
          ) : (
            <SpeakerHigh className="h-4 w-4" weight="duotone" />
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

        /* ==========================================
           Block cards – every non-text block is a
           distinct bordered card (OpenNote-style)
           ========================================== */

        /* Details / collapsible section card */
        .ProseMirror details {
          border: 1.5px solid #CFC0A8;
          border-radius: 10px;
          margin: 1.25em 0;
          overflow: hidden;
          background: #FDFAF3;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .ProseMirror details summary {
          cursor: pointer;
          padding: 10px 14px;
          background: #EDE3CC;
          font-weight: 600;
          color: #3A2E1E;
          user-select: none;
          border-bottom: 1px solid #CFC0A8;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ProseMirror details summary:hover {
          background: #E4D9BD;
        }
        .ProseMirror details summary::marker {
          color: #9B8B78;
        }
        .ProseMirror details div[data-details-content] {
          padding: 12px 14px;
        }

        /* Code block card */
        .ProseMirror pre {
          border: 1.5px solid #CFC0A8;
          border-radius: 10px;
          margin: 1.25em 0;
          padding: 14px 16px;
          background: #EDE3CC;
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          overflow-x: auto;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          position: relative;
        }
        .ProseMirror pre code {
          background: none;
          padding: 0;
          border-radius: 0;
          font-size: inherit;
          color: #3A2E1E;
        }
        .ProseMirror pre::after {
          content: 'Shift+Enter to exit';
          position: absolute;
          bottom: 6px;
          right: 10px;
          font-size: 0.7rem;
          color: #9B8B78;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          pointer-events: none;
        }

        /* Blockquote card */
        .ProseMirror blockquote {
          border: 1.5px solid #8DA878;
          border-left: 4px solid #8DA878;
          border-radius: 10px;
          margin: 1.25em 0;
          padding: 12px 16px;
          background: rgba(141, 168, 120, 0.06);
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .ProseMirror blockquote p {
          color: #5C4B3A;
          font-style: italic;
        }

        /* Table card */
        .ProseMirror .tableWrapper {
          border: 1.5px solid #CFC0A8;
          border-radius: 10px;
          margin: 1.25em 0;
          overflow: hidden;
          background: #FDFAF3;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          min-width: 1em;
          border: 1px solid #CFC0A8;
          padding: 10px 14px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror table th {
          font-weight: 600;
          text-align: left;
          background-color: #EDE3CC;
          color: #3A2E1E;
        }
        .ProseMirror table td {
          background-color: #FDFAF3;
        }
        .ProseMirror table .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: rgba(26, 107, 138, 0.15);
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

        /* Horizontal rule */
        .ProseMirror hr {
          border: none;
          border-top: 2px solid #CFC0A8;
          margin: 1.5em 0;
        }

        /* ==========================================
           Math / LaTeX styling
           ========================================== */
        .math-inline .katex {
          font-size: 1em;
        }
        .Tiptap-mathematics-editor {
          background: #EDE3CC;
          border: 1.5px solid #CFC0A8;
          border-radius: 8px;
          padding: 4px 8px;
          font-family: 'KaTeX_Math', 'Times New Roman', serif;
        }
        .Tiptap-mathematics-render {
          padding: 0 2px;
        }
        .Tiptap-mathematics-editor:focus {
          outline: 2px solid #1A6B8A;
          outline-offset: 1px;
        }
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
        .katex-rendered {
          display: inline-block;
          padding: 0 2px;
        }
        .katex-rendered .katex {
          font-size: 1.1em;
        }
        .katex-display {
          display: block;
          text-align: center;
          margin: 1em 0;
          overflow-x: auto;
        }
        .katex-display .katex {
          font-size: 1.2em;
        }
        .Tiptap-mathematics-render--display {
          display: block;
          text-align: center;
          margin: 1em 0;
        }

        /* ==========================================
           Tippy.js (slash menu popup)
           ========================================== */
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

  // Preserve details/collapsible blocks
  processed = processed.replace(/<details[^>]*>[\s\S]*?<\/details>/g, (match) => {
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
  let inBlockquote = false;

  // Helper function to close open block-level elements
  const closeOpenBlocks = () => {
    if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
    if (inOrderedList) { processedLines.push('</ol>'); inOrderedList = false; }
    if (inBlockquote) { processedLines.push('</blockquote>'); inBlockquote = false; }
  };

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip HTML embed placeholders
    if (line.match(/__HTML_EMBED_\d+__/)) {
      const idx = parseInt(line.match(/__HTML_EMBED_(\d+)__/)?.[1] || '0');
      closeOpenBlocks();
      processedLines.push(htmlEmbeds[idx]);
      continue;
    }

    // Skip code block placeholders
    if (line.match(/__CODE_BLOCK_\d+__/)) {
      const idx = parseInt(line.match(/__CODE_BLOCK_(\d+)__/)?.[1] || '0');
      closeOpenBlocks();
      processedLines.push(codeBlocks[idx]);
      continue;
    }

    // Skip display math placeholders
    if (line.match(/__DISPLAY_MATH_\d+__/)) {
      const idx = parseInt(line.match(/__DISPLAY_MATH_(\d+)__/)?.[1] || '0');
      closeOpenBlocks();
      processedLines.push(displayMathBlocks[idx]);
      continue;
    }

    // Skip table placeholders
    if (line.match(/__TABLE_\d+__/)) {
      const idx = parseInt(line.match(/__TABLE_(\d+)__/)?.[1] || '0');
      closeOpenBlocks();
      processedLines.push(tables[idx]);
      continue;
    }

    // Check for block-level patterns
    const h3Match = line.match(/^### (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h1Match = line.match(/^# (.+)$/);
    const bulletMatch = line.match(/^[-*] (.+)$/);
    const orderedMatch = line.match(/^\d+\. (.+)$/);
    const blockquoteMatch = line.match(/^> (.*)$/);
    const horizontalRuleMatch = line.match(/^(---+|\*\*\*+|___+)\s*$/);

    // Close lists/blockquotes when switching to a different block type
    if (!bulletMatch && inBulletList) {
      processedLines.push('</ul>');
      inBulletList = false;
    }
    if (!orderedMatch && inOrderedList) {
      processedLines.push('</ol>');
      inOrderedList = false;
    }
    if (!blockquoteMatch && inBlockquote) {
      processedLines.push('</blockquote>');
      inBlockquote = false;
    }

    if (horizontalRuleMatch) {
      closeOpenBlocks();
      processedLines.push('<hr>');
    } else if (h3Match) {
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
      processedLines.push(`<li><p>${processInline(bulletMatch[1])}</p></li>`);
    } else if (orderedMatch) {
      if (!inOrderedList) {
        processedLines.push('<ol>');
        inOrderedList = true;
      }
      processedLines.push(`<li><p>${processInline(orderedMatch[1])}</p></li>`);
    } else if (blockquoteMatch) {
      if (!inBlockquote) {
        processedLines.push('<blockquote>');
        inBlockquote = true;
      }
      processedLines.push(`<p>${processInline(blockquoteMatch[1])}</p>`);
    } else if (line.trim()) {
      // Regular paragraph
      processedLines.push(`<p>${processInline(line)}</p>`);
    }
  }

  // Close any remaining open blocks
  if (inBulletList) {
    processedLines.push('</ul>');
  }
  if (inOrderedList) {
    processedLines.push('</ol>');
  }
  if (inBlockquote) {
    processedLines.push('</blockquote>');
  }
  
  return processedLines.join('');
}

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let markdown = html;

  // Preserve HTML embeds (details, youtube, desmos, whiteboard, audio, video) - extract and protect them
  const htmlEmbeds: string[] = [];
  markdown = markdown.replace(/<details[^>]*>[\s\S]*?<\/details>/g, (match) => {
    htmlEmbeds.push(match);
    return `__PRESERVE_HTML_${htmlEmbeds.length - 1}__`;
  });
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
  markdown = markdown.replace(/<span[^>]*class="[^"]*Tiptap-mathematics[^"]*"[^>]*data-latex="([^"]*)"[^>]*>[\s\S]*?<\/span>/g, '$$$1$$');
  markdown = markdown.replace(/<span[^>]*data-latex="([^"]*)"[^>]*class="[^"]*Tiptap-mathematics[^"]*"[^>]*>[\s\S]*?<\/span>/g, '$$$1$$');

  // Convert inline math rendered with katex
  markdown = markdown.replace(/<span[^>]*class="katex-rendered"[^>]*>[\s\S]*?<\/span>/g, (match) => {
    const texMatch = match.match(/<annotation encoding="application\/x-tex">([^<]+)<\/annotation>/);
    if (texMatch) {
      return `$${texMatch[1]}$`;
    }
    return match;
  });

  // Extract LaTeX from KaTeX rendered spans before stripping tags
  markdown = markdown.replace(/<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g, '$$$1$$');

  // Convert code blocks BEFORE inline code (otherwise <pre><code> gets destroyed)
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, '\n```\n$1\n```\n');

  // Convert inline formatting
  markdown = markdown.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**');
  markdown = markdown.replace(/<em>([\s\S]*?)<\/em>/g, '*$1*');
  markdown = markdown.replace(/<code>([\s\S]*?)<\/code>/g, '`$1`');

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, '\n# $1\n');
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n## $1\n');
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n### $1\n');

  // Convert horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/g, '\n---\n');

  // Convert blockquotes - extract content, prefix each line with >
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_, inner) => {
    // Strip <p> tags inside blockquotes and prefix with >
    const content = inner
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1')
      .trim();
    const lines = content.split('\n').filter((l: string) => l.trim());
    return '\n' + lines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n';
  });

  // Convert ordered lists - must process <ol> blocks before <ul> blocks
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (_, inner) => {
    let idx = 0;
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_m: string, content: string) => {
      idx++;
      // Strip inner <p> tags that TipTap wraps list item content with
      const cleanContent = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1').trim();
      return `${idx}. ${cleanContent}\n`;
    });
    return '\n' + items.replace(/<[^>]+>/g, '');
  });

  // Convert unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (_, inner) => {
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_m: string, content: string) => {
      // Strip inner <p> tags that TipTap wraps list item content with
      const cleanContent = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1').trim();
      return `- ${cleanContent}\n`;
    });
    return '\n' + items.replace(/<[^>]+>/g, '');
  });

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n');

  // Clean up - remove remaining HTML tags (but not our preserved ones)
  markdown = markdown.replace(/<[^>]+>/g, '');
  markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines

  // Restore preserved HTML embeds
  htmlEmbeds.forEach((embed, idx) => {
    markdown = markdown.replace(`__PRESERVE_HTML_${idx}__`, `\n\n${embed}\n\n`);
  });

  return markdown.trim();
}
