'use client';

import { useEffect, useState, useCallback, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import {
  Lightbulb,
  Timer,
  DotsThree,
  CircleNotch,
  Plus,
  Sparkle,
  Stack,
  ClipboardText,
  Square,
  TextT,
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  ImageSquare,
  Quotes,
  Minus,
  Table,
  CaretDown,
  CaretUp,
  Code,
  MathOperations,
  PenNib,
  ChartLine,
  ChartBar,
  FileText,
  Link,
  Image,
  Waveform,
  VideoCamera,
  YoutubeLogo,
  FileDoc,
  FilmSlate,
  X,
  MagnifyingGlass,
  ArrowSquareOut,
  PaperPlaneTilt,
  Copy,
  ArrowsClockwise,
  Check,
  ArrowUp,
  Shuffle,
  Trash,
  CaretLeft,
  CaretRight,
  ChatCircle,
} from '@phosphor-icons/react';
import {
  Dialog, DialogPanel, DialogTitle, DialogBackdrop,
  Switch,
  TabGroup, TabList, Tab, TabPanels, TabPanel,
} from '@headlessui/react';
import { debounce } from 'lodash';
import { formatDistance } from 'date-fns';
import { sileo } from 'sileo';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/journal/RichTextEditor';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { decodeChartData, encodeChartData, DEFAULT_CHART_DATA, type ChartConfig } from '@/components/journal/InlineChart';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import { ArrowLeft } from 'lucide-react';

// Simple markdown renderer for chat messages with DOMPurify sanitization
function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^###### (.+)$/gm, '<h6 class="font-semibold text-[13px] mt-2 mb-0.5 text-foreground">$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5 class="font-semibold text-[13px] mt-2 mb-0.5 text-foreground">$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4 class="font-semibold text-[13px] mt-2.5 mb-0.5 text-foreground">$1</h4>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-[14px] mt-2.5 mb-0.5 text-foreground">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-[15px] mt-3 mb-1 text-foreground">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-[16px] mt-3 mb-1 text-foreground">$1</h2>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[12px] font-mono text-foreground/80">$1</code>')
    .replace(/^\* (.+)$/gm, '<li class="ml-3 list-disc text-foreground/80">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc text-foreground/80">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal text-foreground/80">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-1.5">')
    .replace(/\n/g, '<br />');

  html = '<p>' + html + '</p>';
  html = html.replace(/<p><\/p>/g, '');

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'li', 'ul', 'ol'],
    ALLOWED_ATTR: ['class'],
  });
}

const InlineWhiteboard = dynamic(
  () => import('@/components/journal/InlineWhiteboard').then(mod => mod.InlineWhiteboard),
  { ssr: false, loading: () => <div className="h-[400px] bg-muted animate-pulse" /> }
);

const InlineDesmos = dynamic(
  () => import('@/components/journal/InlineDesmos').then(mod => mod.InlineDesmos),
  { ssr: false, loading: () => <div className="h-[400px] bg-muted animate-pulse" /> }
);

const InlineChart = dynamic(
  () => import('@/components/journal/InlineChart').then(mod => mod.InlineChart),
  { ssr: false, loading: () => <div className="h-[400px] bg-muted animate-pulse" /> }
);

interface JournalData {
  id: string;
  user_id: string;
  title: string;
  content: any[];
  created_at: string;
  updated_at: string;
}

interface EmbeddedWhiteboard {
  id: string;
  data?: string;
}

interface EmbeddedDesmosGraph {
  id: string;
  expression: string;
}

function ContentWithEmbeds({
  content,
  onChange,
  placeholder,
  embeddedWhiteboards,
  embeddedDesmos,
  onWhiteboardSave,
  onSlashCommand,
  onDeleteWhiteboard,
  onDeleteDesmos,
  onChartSave,
  onDeleteChart,
}: {
  content: string;
  onChange: (content: string) => void;
  placeholder: string;
  embeddedWhiteboards: EmbeddedWhiteboard[];
  embeddedDesmos: EmbeddedDesmosGraph[];
  onWhiteboardSave: (id: string, data: string) => void;
  onSlashCommand?: (commandId: string) => void;
  onDeleteWhiteboard?: (id: string) => void;
  onDeleteDesmos?: (id: string) => void;
  onChartSave?: (id: string, data: ChartConfig) => void;
  onDeleteChart?: (id: string) => void;
}) {
  const whiteboardMatches = [...content.matchAll(/\[WHITEBOARD:([^\]]+)\]/g)];
  const desmosMatches = [...content.matchAll(/\[DESMOS:([^:\]]+):([^\]]*)\]/g)];
  const chartMatches = [...content.matchAll(/\[CHART:([^:\]]+):([^\]]*)\]/g)];

  const allEmbeds: { type: 'whiteboard' | 'desmos' | 'chart'; match: RegExpExecArray | RegExpMatchArray; position: number }[] = [];
  whiteboardMatches.forEach(m => allEmbeds.push({ type: 'whiteboard', match: m, position: m.index ?? 0 }));
  desmosMatches.forEach(m => allEmbeds.push({ type: 'desmos', match: m, position: m.index ?? 0 }));
  chartMatches.forEach(m => allEmbeds.push({ type: 'chart', match: m, position: m.index ?? 0 }));
  allEmbeds.sort((a, b) => a.position - b.position);

  const editorContent = content
    .replace(/\n*\[WHITEBOARD:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[DESMOS:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[CHART:[^\]]+\]\n*/g, '\n')
    .trim();

  const hasEmbeds = allEmbeds.length > 0;

  return (
    <div className={hasEmbeds ? 'space-y-4' : 'space-y-6'}>
      <RichTextEditor
        content={editorContent}
        onChange={(newContent) => {
          let fullContent = newContent;
          allEmbeds.forEach(({ match }) => {
            if (!fullContent.includes(match[0])) {
              fullContent += `\n\n${match[0]}`;
            }
          });
          onChange(fullContent);
        }}
        placeholder={placeholder}
        onSlashCommand={onSlashCommand}
        className={hasEmbeds ? '[&_.ProseMirror]:!min-h-[120px]' : ''}
      />

      {allEmbeds.map(({ type, match }) => {
        if (type === 'whiteboard') {
          const id = match[1];
          const wb = embeddedWhiteboards.find(w => w.id === id);
          return (
            <div key={`wb-${id}`} className="my-2 group relative">
              <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenNib className="h-4 w-4" />
                  <span>Whiteboard</span>
                </div>
                {onDeleteWhiteboard && (
                  <button
                    onClick={() => onDeleteWhiteboard(id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete whiteboard"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <InlineWhiteboard
                id={id}
                initialData={wb?.data}
                onSave={(data) => onWhiteboardSave(id, data)}
                height={400}
              />
            </div>
          );
        }

        if (type === 'desmos') {
          const id = match[1];
          const expression = match[2];
          return (
            <div key={`desmos-${id}`} className="my-2 group relative">
              <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChartLine className="h-4 w-4" />
                  <span>Desmos Graph</span>
                </div>
                {onDeleteDesmos && (
                  <button
                    onClick={() => onDeleteDesmos(id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete graph"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <InlineDesmos
                expression={expression}
                height={400}
              />
            </div>
          );
        }

        const id = match[1];
        const encodedData = match[2];
        const chartConfig = decodeChartData(encodedData);
        return (
          <div key={`chart-${id}`} className="my-2">
            <InlineChart
              id={id}
              initialData={chartConfig}
              onSave={(chartId, data) => onChartSave?.(chartId, data)}
              onDelete={(chartId) => onDeleteChart?.(chartId)}
            />
          </div>
        );
      })}
    </div>
  );
}

// Slash command menu items
const slashCommands = [
  {
    category: 'Build with Agathon',
    items: [
      { id: 'notes', icon: Sparkle, label: 'Generate notes', color: 'text-muted-foreground' },
      { id: 'practice', icon: ClipboardText, label: 'Generate practice problems', color: 'text-muted-foreground' },
      { id: 'flashcards', icon: Stack, label: 'Generate flashcards', color: 'text-muted-foreground' },
      { id: 'generate-image', icon: ImageSquare, label: 'Generate image', color: 'text-muted-foreground' },
    ],
  },
  {
    category: 'Basic editing',
    items: [
      { id: 'text', icon: TextT, label: 'Text', color: 'text-muted-foreground' },
      { id: 'h1', icon: TextHOne, label: 'Heading 1', color: 'text-muted-foreground' },
      { id: 'h2', icon: TextHTwo, label: 'Heading 2', color: 'text-muted-foreground' },
      { id: 'h3', icon: TextHThree, label: 'Heading 3', color: 'text-muted-foreground' },
      { id: 'bullet', icon: ListBullets, label: 'Bullet list', color: 'text-muted-foreground' },
      { id: 'numbered', icon: ListNumbers, label: 'Numbered list', color: 'text-muted-foreground' },
      { id: 'quote', icon: Quotes, label: 'Quote', color: 'text-muted-foreground' },
      { id: 'divider', icon: Minus, label: 'Divider', color: 'text-muted-foreground' },
    ],
  },
  {
    category: 'Advanced editing',
    items: [
      { id: 'table', icon: Table, label: 'Table', color: 'text-muted-foreground' },
      { id: 'details', icon: CaretDown, label: 'Details', color: 'text-muted-foreground' },
      { id: 'code', icon: Code, label: 'Code block', color: 'text-muted-foreground' },
      { id: 'latex', icon: MathOperations, label: 'LaTeX block', color: 'text-muted-foreground' },
    ],
  },
  {
    category: 'Interactive editing',
    items: [
      { id: 'whiteboard', icon: PenNib, label: 'Whiteboard', color: 'text-muted-foreground' },
      { id: 'desmos', icon: ChartLine, label: 'Desmos graph', color: 'text-muted-foreground' },
      { id: 'chart', icon: ChartBar, label: 'Chart', color: 'text-muted-foreground' },
    ],
  },
  {
    category: 'Journals',
    items: [
      { id: 'subjournal', icon: FileText, label: 'Subjournal', color: 'text-muted-foreground' },
      { id: 'link-journal', icon: Link, label: 'Link to existing journal', color: 'text-muted-foreground' },
    ],
  },
  {
    category: 'Media',
    items: [
      { id: 'video-library', icon: FilmSlate, label: 'Add from Video Library', color: 'text-muted-foreground' },
      { id: 'image', icon: Image, label: 'Image', color: 'text-muted-foreground' },
      { id: 'audio', icon: Waveform, label: 'Audio', color: 'text-muted-foreground' },
      { id: 'video', icon: VideoCamera, label: 'Video', color: 'text-muted-foreground' },
      { id: 'youtube', icon: YoutubeLogo, label: 'YouTube', color: 'text-muted-foreground' },
      { id: 'pdf', icon: FileDoc, label: 'PDF', color: 'text-muted-foreground' },
    ],
  },
];

export default function JournalEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [journal, setJournal] = useState<JournalData | null>(null);
  const [title, setTitle] = useState('New Journal');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Chat panel state — replaces the old searchExpanded floating bar
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Topic prompt modal state
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');

  // Command input state (slash menu still lives in main editor)
  const [commandInput, setCommandInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [slashFilter, setSlashFilter] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Modal states for various commands
  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showJournalLinkModal, setShowJournalLinkModal] = useState(false);
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
  const [searchedJournals, setSearchedJournals] = useState<JournalData[]>([]);
  const [showDesmosModal, setShowDesmosModal] = useState(false);
  const [desmosExpression, setDesmosExpression] = useState('');

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; written?: boolean }>>([]);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [pendingMessageIndex, setPendingMessageIndex] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const hasAutoTitled = useRef(false);

  // Pending content blocks for diff-style accept/deny
  const [pendingBlocks, setPendingBlocks] = useState<Array<{ id: string; content: string; status: 'pending' | 'accepted' | 'denied' }>>([]);

  const isNotesRequest = (message: string): boolean => {
    const normalizedMsg = message.toLowerCase().trim();
    const notesPatterns = [
      /\b(create|make|generate|write|give me|give)\b.*\b(notes|summary|outline|study guide)\b/i,
      /\b(notes|summary|outline)\b.*\b(on|about|for)\b/i,
      /^notes?\s+(on|about|for)/i,
      /\bsummarize\b/i,
      /\bexplain\b.*\b(this|the|topic|concept|in detail)\b/i,
    ];
    return notesPatterns.some(pattern => pattern.test(normalizedMsg));
  };

  const parseContentIntoBlocks = (content: string): Array<{ id: string; content: string; status: 'pending' | 'accepted' | 'denied' }> => {
    const sections = content.split(/(?=^#{1,3}\s)/m).filter(s => s.trim());

    if (sections.length <= 1) {
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
      return paragraphs.map((p, idx) => ({
        id: `block-${Date.now()}-${idx}`,
        content: p.trim(),
        status: 'pending' as const
      }));
    }

    return sections.map((section, idx) => ({
      id: `block-${Date.now()}-${idx}`,
      content: section.trim(),
      status: 'pending' as const
    }));
  };

  const placeholderTexts = [
    'Ask anything...',
    'Ask to look something up',
    'Ask to find similar examples',
    'Ask to explain a concept',
    'Ask to create practice problems',
    'Ask to simplify this topic',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [placeholderTexts.length]);

  // Embedded content state
  const [embeddedWhiteboards, setEmbeddedWhiteboards] = useState<{ id: string; data?: string }[]>([]);
  const [embeddedDesmos, setEmbeddedDesmos] = useState<{ id: string; expression: string }[]>([]);

  // Inline input state
  const [activeInlineInput, setActiveInlineInput] = useState<string | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [practiceCount, setPracticeCount] = useState(5);
  const [flashcardCount, setFlashcardCount] = useState(10);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Flashcard state
  const [flashcards, setFlashcards] = useState<Array<{ question: string; answer: string }>>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardTopic, setFlashcardTopic] = useState('');

  // Proactive AI Mode state
  const [proactiveAIEnabled, setProactiveAIEnabled] = useState(false);
  const [showProactiveDropdown, setShowProactiveDropdown] = useState(false);
  const [proactiveSuggestion, setProactiveSuggestion] = useState<string | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const proactiveDropdownRef = useRef<HTMLDivElement>(null);
  const lastAnalyzedContent = useRef<string>('');

  // Load journal
  useEffect(() => {
    async function loadJournal() {
      if (!user || !params.id) return;

      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Failed to load journal:', error);
        sileo.error({ title: 'Failed to load journal' });
        router.push('/journal');
        return;
      }

      setJournal(data);
      setTitle(data.title);
      const textContent = Array.isArray(data.content)
        ? data.content.map((block: any) =>
            typeof block === 'string' ? block : block?.content || ''
          ).join('\n')
        : '';
      setContent(textContent);
      setLastSaved(new Date(data.updated_at));
      setLoading(false);
    }

    loadJournal();
  }, [params.id, user, supabase, router]);

  // Auto-save with debounce
  const saveJournal = useCallback(
    debounce(async (newTitle: string, newContent: string) => {
      if (!journal) return;

      setIsSaving(true);

      const { error } = await supabase
        .from('journals')
        .update({
          title: newTitle,
          content: [{ type: 'text', content: newContent }],
          updated_at: new Date().toISOString(),
        })
        .eq('id', journal.id);

      if (error) {
        console.error('Failed to save journal:', error);
      } else {
        setLastSaved(new Date());
      }

      setIsSaving(false);
    }, 1000),
    [journal, supabase]
  );

  useEffect(() => {
    if (journal && !loading) {
      saveJournal(title, content);
    }
  }, [title, content, journal, loading, saveJournal]);

  // Auto-generate title from content
  useEffect(() => {
    if (hasAutoTitled.current) return;
    if (title !== 'New Journal') {
      hasAutoTitled.current = true;
      return;
    }
    const plainText = content.replace(/\[(?:WHITEBOARD|DESMOS|CHART|IMAGE|AUDIO|VIDEO|PDF|YOUTUBE|JOURNAL_LINK):[^\]]*\]/g, '').trim();
    if (plainText.length < 30) return;

    hasAutoTitled.current = true;

    const generateTitle = async () => {
      try {
        const res = await fetch('/api/journal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chat',
            content: '',
            topic: `Generate a short, concise title (3-6 words, no quotes, no markdown) for a study journal with this content:\n\n${plainText.slice(0, 500)}`,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const generated = (data.content || '').replace(/^["']|["']$/g, '').replace(/^#+\s*/, '').trim();
        if (generated && generated.length > 0 && generated.length < 60) {
          setTitle(generated);
        }
      } catch {
        // Silently fail
      }
    };

    generateTitle();
  }, [content, title]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    hasAutoTitled.current = true;
    setTitle(e.target.value);
  };

  const generateAIContent = async (type: string, customTopic?: string) => {
    setIsGenerating(true);
    const typeLabels: Record<string, string> = {
      notes: 'notes',
      flashcards: 'flashcards',
      practice: 'practice problems',
      image: 'image',
    };
    const typeLabel = typeLabels[type] || 'content';
    const loadingId = sileo.show({ title: `Generating ${typeLabel}...` });

    try {
      const response = await fetch('/api/journal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: content || customTopic || title,
          topic: customTopic || title,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate content');

      const data = await response.json();
      const newContent = content ? content + '\n\n' + data.content : data.content;
      setContent(newContent);

      sileo.dismiss(loadingId);
      sileo.success({ title: `${typeLabel} generated!` });
    } catch (error) {
      console.error('Generation error:', error);
      sileo.dismiss(loadingId);
      sileo.error({ title: 'Failed to generate content' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setPendingAction(action);
    setTopicInput('');
    setShowTopicModal(true);
  };

  const handleTopicSubmit = async () => {
    if (!pendingAction || !topicInput.trim()) return;

    const actionMap: Record<string, string> = {
      'Agathon Method': 'notes',
      'Flashcards': 'flashcards',
      'Practice Problems': 'practice',
      'Notes': 'notes',
      'Image': 'image',
    };

    const commandId = actionMap[pendingAction];
    setShowTopicModal(false);

    if (commandId) {
      if (pendingAction !== 'Image') {
        setTitle(topicInput.trim());
      }
      await generateAIContent(commandId, topicInput.trim());
    }

    setPendingAction(null);
    setTopicInput('');
  };

  const getActionPromptText = (action: string): string => {
    switch (action) {
      case 'Agathon Method': return 'What topic would you like Agathon to teach you about?';
      case 'Flashcards': return 'What topic would you like to create flashcards for?';
      case 'Practice Problems': return 'What topic would you like practice problems for?';
      case 'Notes': return 'What topic would you like notes on?';
      case 'Image': return 'What would you like to generate an image of?';
      default: return 'What topic would you like to explore?';
    }
  };

  const handleInlineInputSubmit = async () => {
    if (!activeInlineInput || !inlineInputValue.trim()) return;

    const topic = inlineInputValue.trim();

    if (activeInlineInput === 'Flashcards') {
      setFlashcardTopic(topic);
      setIsGeneratingFlashcards(true);
      setFlashcards([]);
      setCurrentFlashcardIndex(0);
      setIsFlashcardFlipped(false);

      try {
        const response = await fetch('/api/journal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'flashcards',
            content: topic,
            topic: topic,
            count: flashcardCount,
          }),
        });

        if (!response.ok) throw new Error('Failed to generate flashcards');

        const data = await response.json();
        const parsedFlashcards = parseFlashcardsFromResponse(data.content);
        setFlashcards(parsedFlashcards);
        setTitle(topic);
      } catch (error) {
        console.error('Flashcard generation error:', error);
        sileo.error({ title: 'Failed to generate flashcards' });
        setActiveInlineInput(null);
      } finally {
        setIsGeneratingFlashcards(false);
      }
    } else if (activeInlineInput === 'Practice Problems') {
      setActiveInlineInput(null);
      setInlineInputValue('');
      setTitle(topic);
      await generateAIContent('practice', topic);
    }
  };

  const cleanMarkdown = (text: string): string => {
    return text
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^[-•]\s*/gm, '')
      .replace(/^\d+\.\s*/gm, '')
      .replace(/Card\s*\d+\s*:?\s*/gi, '')
      .replace(/Front\s*:?\s*/gi, '')
      .replace(/Back\s*:?\s*/gi, '')
      .replace(/\n+/g, ' ')
      .trim();
  };

  const parseFlashcardsFromResponse = (responseContent: string): Array<{ question: string; answer: string }> => {
    const parsedCards: Array<{ question: string; answer: string }> = [];

    const cardSections = responseContent.split(/###?\s*Card\s*\d+\s*/i).filter(s => s.trim());
    if (cardSections.length > 0) {
      for (const section of cardSections) {
        const frontMatch = section.match(/\*\*Front[:\s]*\*\*\s*(.+)/i);
        const backMatch = section.match(/\*\*Back[:\s]*\*\*\s*(.+)/i);
        if (frontMatch && backMatch) {
          const question = cleanMarkdown(frontMatch[1]);
          const answer = cleanMarkdown(backMatch[1]);
          if (question && answer) parsedCards.push({ question, answer });
        }
      }
    }

    if (parsedCards.length === 0) {
      let match;
      const qaPattern = /\*\*Q(?:uestion)?[:\s]*\*\*\s*([\s\S]+?)\s*\*\*A(?:nswer)?[:\s]*\*\*\s*([\s\S]+?)(?=\*\*Q|\n\n\*\*|\n\n##|$)/gi;
      while ((match = qaPattern.exec(responseContent)) !== null) {
        const question = cleanMarkdown(match[1]);
        const answer = cleanMarkdown(match[2]);
        if (question && answer) parsedCards.push({ question, answer });
      }
    }

    if (parsedCards.length === 0) {
      let match;
      const frontBackPattern = /\*\*Front[:\s]*\*\*\s*([\s\S]+?)\s*\*\*Back[:\s]*\*\*\s*([\s\S]+?)(?=\*\*Front|$)/gi;
      while ((match = frontBackPattern.exec(responseContent)) !== null) {
        const question = cleanMarkdown(match[1]);
        const answer = cleanMarkdown(match[2]);
        if (question && answer) parsedCards.push({ question, answer });
      }
    }

    if (parsedCards.length === 0) {
      let match;
      const numberedPattern = /\d+\.\s*\*?\*?(.+?\?)\*?\*?\s*\n+\s*[-•]?\s*(.+?)(?=\n\d+\.|$)/g;
      while ((match = numberedPattern.exec(responseContent)) !== null) {
        const question = cleanMarkdown(match[1]);
        const answer = cleanMarkdown(match[2].split('\n')[0]);
        if (question && answer) parsedCards.push({ question, answer });
      }
    }

    if (parsedCards.length === 0) {
      const lines = responseContent.split(/\n\n+/).filter(l => l.trim());
      for (let i = 0; i < lines.length - 1; i += 2) {
        const question = cleanMarkdown(lines[i]);
        const answer = cleanMarkdown(lines[i + 1] || '');
        if (question && answer) parsedCards.push({ question, answer });
      }
    }

    return parsedCards.slice(0, 20);
  };

  const handleNextFlashcard = () => {
    setIsFlashcardFlipped(false);
    setCurrentFlashcardIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrevFlashcard = () => {
    setIsFlashcardFlipped(false);
    setCurrentFlashcardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleShuffleFlashcards = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentFlashcardIndex(0);
    setIsFlashcardFlipped(false);
  };

  const handleDeleteFlashcards = () => {
    setFlashcards([]);
    setActiveInlineInput(null);
    setInlineInputValue('');
    setFlashcardTopic('');
  };

  const analyzeContentForSuggestions = useCallback(
    debounce(async (currentContent: string) => {
      if (!proactiveAIEnabled || !currentContent || currentContent.length < 50) {
        setProactiveSuggestion(null);
        return;
      }

      if (currentContent === lastAnalyzedContent.current) return;

      const contentDiff = Math.abs(currentContent.length - lastAnalyzedContent.current.length);
      if (contentDiff < 100 && lastAnalyzedContent.current.length > 0) return;

      lastAnalyzedContent.current = currentContent;
      setIsGeneratingSuggestion(true);

      try {
        const response = await fetch('/api/journal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'proactive',
            content: currentContent.slice(-1500),
            topic: title || 'Study notes',
          }),
        });

        if (!response.ok) throw new Error('Failed to get suggestion');

        const data = await response.json();
        if (data.content && data.content.trim()) {
          setProactiveSuggestion(data.content);
        }
      } catch (error) {
        console.error('Proactive AI error:', error);
      } finally {
        setIsGeneratingSuggestion(false);
      }
    }, 3000),
    [proactiveAIEnabled, title]
  );

  useEffect(() => {
    if (proactiveAIEnabled && content) {
      analyzeContentForSuggestions(content);
    }
  }, [content, proactiveAIEnabled, analyzeContentForSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (proactiveDropdownRef.current && !proactiveDropdownRef.current.contains(event.target as Node)) {
        setShowProactiveDropdown(false);
      }
    };
    if (showProactiveDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProactiveDropdown]);

  const handleApplySuggestion = () => {
    if (!proactiveSuggestion) return;
    const newContent = content ? content + '\n\n' + proactiveSuggestion : proactiveSuggestion;
    setContent(newContent);
    setProactiveSuggestion(null);
    sileo.success({ title: 'Suggestion applied!' });
  };

  const handleDismissSuggestion = () => {
    setProactiveSuggestion(null);
  };

  const handleOpenInlineInput = (action: string) => {
    setActiveInlineInput(action);
    setInlineInputValue('');
    setFlashcards([]);
    setTimeout(() => inlineInputRef.current?.focus(), 100);
  };

  const getAllCommands = () => {
    const filtered = slashFilter.toLowerCase();
    return slashCommands.flatMap(cat =>
      cat.items.filter(item =>
        item.label.toLowerCase().includes(filtered)
      )
    );
  };

  const handleCommandKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSlashMenu) {
      if (e.key === 'Enter' && commandInput.trim()) {
        const newContent = content ? content + '\n\n' + commandInput : commandInput;
        setContent(newContent);
        setCommandInput('');
      }
      return;
    }

    const allCommands = getAllCommands();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCommandIndex(prev => prev < allCommands.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : allCommands.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedCommand = allCommands[selectedCommandIndex];
      if (selectedCommand) executeCommand(selectedCommand.id);
    } else if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setCommandInput('');
    }
  };

  const executeCommand = async (commandId: string) => {
    setShowSlashMenu(false);
    setCommandInput('');

    const aiCommands = ['notes', 'practice', 'flashcards', 'generate-image'];
    const formatCommands = ['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'quote', 'divider', 'code', 'latex', 'table', 'details'];

    if (aiCommands.includes(commandId)) {
      if (commandId === 'flashcards') { handleOpenInlineInput('Flashcards'); return; }
      if (commandId === 'practice') { handleOpenInlineInput('Practice Problems'); return; }
      const actionMap: Record<string, string> = { 'notes': 'Notes', 'generate-image': 'Image' };
      handleQuickAction(actionMap[commandId] || 'Notes');
    } else if (formatCommands.includes(commandId)) {
      let insertText = '';
      switch (commandId) {
        case 'h1': insertText = '# '; break;
        case 'h2': insertText = '## '; break;
        case 'h3': insertText = '### '; break;
        case 'bullet': insertText = '- '; break;
        case 'numbered': insertText = '1. '; break;
        case 'quote': insertText = '> '; break;
        case 'divider': insertText = '\n---\n'; break;
        case 'code': insertText = '```\n\n```'; break;
        case 'latex': insertText = '$$\n\n$$'; break;
        case 'table': insertText = '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n'; break;
        case 'details': insertText = '\n<details>\n<summary>Click to expand</summary>\n\nHidden content goes here...\n\n</details>\n'; break;
      }
      setContent(prev => prev ? prev + '\n\n' + insertText : insertText);
    } else {
      switch (commandId) {
        case 'whiteboard': handleWhiteboardInsert(); break;
        case 'desmos': handleDesmosInsert(); break;
        case 'chart': handleChartInsert(); break;
        case 'subjournal': handleCreateSubjournal(); break;
        case 'link-journal':
          setJournalSearchQuery('');
          setSearchedJournals([]);
          setShowJournalLinkModal(true);
          searchJournals('');
          break;
        case 'video-library':
          sileo.info({ title: 'Video Library - Browse your saved educational videos', duration: 3000 });
          break;
        case 'image': imageInputRef.current?.click(); break;
        case 'audio': audioInputRef.current?.click(); break;
        case 'video': videoInputRef.current?.click(); break;
        case 'youtube': setYoutubeUrl(''); setShowYoutubeModal(true); break;
        case 'pdf': pdfInputRef.current?.click(); break;
        default: sileo.info({ title: 'This feature is coming soon!' });
      }
    }
  };

  const handleWhiteboardInsert = async () => {
    const whiteboardId = `wb-${Date.now()}`;
    setEmbeddedWhiteboards(prev => [...prev, { id: whiteboardId }]);
    const whiteboardPlaceholder = `\n\n[WHITEBOARD:${whiteboardId}]\n`;
    setContent(prev => prev ? prev + whiteboardPlaceholder : whiteboardPlaceholder);
    sileo.success({ title: 'Whiteboard added!' });
  };

  const handleDesmosInsert = () => {
    const desmosId = `desmos-${Date.now()}`;
    const desmosPlaceholder = `[DESMOS:${desmosId}:]`;
    setContent(prev => {
      if (prev.includes(desmosPlaceholder)) return prev;
      return prev ? prev + `\n\n${desmosPlaceholder}\n` : `${desmosPlaceholder}\n`;
    });
    sileo.success({ title: 'Graph added! Type equations directly in the calculator.' });
  };

  const handleCreateSubjournal = async () => {
    if (!user || !journal) return;

    const loadingId = sileo.show({ title: 'Creating subjournal...' });
    try {
      const { data, error } = await supabase
        .from('journals')
        .insert({
          user_id: user.id,
          title: `Subjournal of ${title}`,
          content: [{ type: 'text', content: '' }],
          parent_id: journal.id,
        })
        .select()
        .single();

      if (error) throw error;

      const subjournalLink = `\n\n[📓 Subjournal: ${data.title}](/journal/${data.id})\n`;
      const newContent = content ? content + subjournalLink : subjournalLink;
      setContent(newContent);
      sileo.dismiss(loadingId);
      sileo.success({ title: 'Subjournal created!' });
    } catch (error) {
      console.error('Failed to create subjournal:', error);
      sileo.dismiss(loadingId);
      sileo.error({ title: 'Failed to create subjournal' });
    }
  };

  const searchJournals = async (query: string) => {
    if (!user) return;

    try {
      let queryBuilder = supabase
        .from('journals')
        .select('*')
        .eq('user_id', user.id)
        .neq('id', journal?.id || '')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (query.trim()) queryBuilder = queryBuilder.ilike('title', `%${query}%`);

      const { data, error } = await queryBuilder;
      if (error) throw error;
      setSearchedJournals(data || []);
    } catch (error) {
      console.error('Failed to search journals:', error);
    }
  };

  const handleJournalLink = (linkedJournal: JournalData) => {
    const journalLink = `\n\nhttps://agathon.app/journal/${linkedJournal.id}\n`;
    const newContent = content ? content + journalLink : journalLink;
    setContent(newContent);
    setShowJournalLinkModal(false);
    sileo.success({ title: 'Journal linked!' });
  };

  const handleYoutubeEmbed = () => {
    if (!youtubeUrl.trim()) return;

    const videoIdMatch = youtubeUrl.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );

    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1];
      const embedCode = `\n\n<div class="youtube-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:12px;margin:16px 0;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:12px;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n`;
      const newContent = content ? content + embedCode : embedCode;
      setContent(newContent);
      setShowYoutubeModal(false);
      setYoutubeUrl('');
      sileo.success({ title: 'YouTube video embedded!' });
    } else {
      sileo.error({ title: 'Invalid YouTube URL' });
    }
  };

  const handleDesmosEmbed = () => {
    if (!desmosExpression.trim()) return;

    const desmosId = `desmos-${Date.now()}`;
    const desmosPlaceholder = `[DESMOS:${desmosId}:${desmosExpression}]`;

    if (content.includes(desmosPlaceholder)) return;

    const newContent = content ? content + `\n\n${desmosPlaceholder}\n` : `${desmosPlaceholder}\n`;
    setContent(newContent);
    setShowDesmosModal(false);
    setDesmosExpression('');
    sileo.success({ title: 'Desmos graph added!' });
  };

  const handleChartInsert = () => {
    const chartId = `chart-${Date.now()}`;
    const encodedData = encodeChartData(DEFAULT_CHART_DATA);
    const chartPlaceholder = `[CHART:${chartId}:${encodedData}]`;
    setContent(prev => {
      if (prev.includes(chartPlaceholder)) return prev;
      return prev ? prev + `\n\n${chartPlaceholder}\n` : `${chartPlaceholder}\n`;
    });
    sileo.success({ title: 'Chart added!' });
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, fileType: 'image' | 'audio' | 'video' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = fileType === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      sileo.error({ title: `File too large. Maximum size is ${fileType === 'image' ? '5MB' : '10MB'}` });
      return;
    }

    const loadingId = sileo.show({ title: `Uploading ${fileType}...` });

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        let embedCode = '';

        switch (fileType) {
          case 'image': embedCode = `\n\n![${file.name}](${base64})\n`; break;
          case 'audio': embedCode = `\n\n🎵 **Audio: ${file.name}**\n<audio controls src="${base64}"></audio>\n`; break;
          case 'video': embedCode = `\n\n🎬 **Video: ${file.name}**\n<video controls width="100%" src="${base64}"></video>\n`; break;
          case 'pdf': embedCode = `\n\n📄 **PDF: ${file.name}**\n[View PDF](${base64})\n`; break;
        }

        const newContent = content ? content + embedCode : embedCode;
        setContent(newContent);
        sileo.dismiss(loadingId);
        sileo.success({ title: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded!` });
      };
      reader.onerror = () => {
        sileo.dismiss(loadingId);
        sileo.error({ title: `Failed to upload ${fileType}` });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(`Failed to upload ${fileType}:`, error);
      sileo.dismiss(loadingId);
      sileo.error({ title: `Failed to upload ${fileType}` });
    }

    e.target.value = '';
  };

  const isFlashcardRequest = (message: string): boolean => {
    const normalizedMsg = message.toLowerCase().trim();
    const flashcardPatterns = [
      /\b(create|make|generate|give me|need)\b.*\bflashcard/i,
      /\bflashcard.*\b(on|about|for)\b/i,
      /^flashcards?\s+(on|about|for)/i,
      /\bstudy\b.*\bflashcard/i,
    ];
    return flashcardPatterns.some(pattern => pattern.test(normalizedMsg));
  };

  // Handle chat message submit
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput.trim();
    const isNotes = isNotesRequest(userMessage);
    const isFlashcards = isFlashcardRequest(userMessage);
    setChatInput('');
    setIsChatting(true);

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Scroll to bottom after message added
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 50);

    if (isFlashcards) {
      const topic = userMessage
        .replace(/\b(create|make|generate|give me|need|flashcards?|study with|on|about|for)\b/gi, '')
        .trim() || content?.slice(0, 200) || 'the topic';

      setFlashcardTopic(topic);
      setIsGeneratingFlashcards(true);
      setFlashcards([]);
      setCurrentFlashcardIndex(0);
      setIsFlashcardFlipped(false);

      try {
        const response = await fetch('/api/journal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'flashcards',
            content: content || topic,
            topic: topic,
            count: flashcardCount,
          }),
        });

        if (!response.ok) throw new Error('Failed to generate flashcards');

        const data = await response.json();
        const parsedFlashcards = parseFlashcardsFromResponse(data.content);
        setFlashcards(parsedFlashcards);

        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `I've created ${parsedFlashcards.length} flashcards for you! You can see them in the editor.`
        }]);
      } catch (error) {
        console.error('Flashcard generation error:', error);
        sileo.error({ title: 'Failed to generate flashcards' });
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I had trouble creating flashcards. Please try again.'
        }]);
      } finally {
        setIsGeneratingFlashcards(false);
        setIsChatting(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/journal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isNotes ? 'notes' : 'chat',
          content: content || '',
          topic: userMessage,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      if (isNotes) {
        const blocks = parseContentIntoBlocks(data.content);
        setPendingBlocks(blocks);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `I've generated ${blocks.length} section${blocks.length > 1 ? 's' : ''} of notes. Review and accept/deny each section in the editor.`
        }]);
      } else {
        const newMsgIndex = chatMessages.length + 1;
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);

        const looksLikeNotes = data.content.includes('#') || data.content.length > 200;
        if (looksLikeNotes) {
          setPendingContent(data.content);
          setPendingMessageIndex(newMsgIndex);
        }
      }

      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleAcceptContent = () => {
    if (!pendingContent || pendingMessageIndex === null) return;
    const newContent = content ? content + '\n\n' + pendingContent : pendingContent;
    setContent(newContent);
    setChatMessages(prev => prev.map((msg, idx) =>
      idx === pendingMessageIndex ? { ...msg, written: true } : msg
    ));
    setPendingContent(null);
    setPendingMessageIndex(null);
    sileo.success({ title: 'Content added to journal!' });
  };

  const handleReapplyContent = (messageContent: string, messageIndex: number) => {
    const newContent = content ? content + '\n\n' + messageContent : messageContent;
    setContent(newContent);
    sileo.success({ title: 'Content reapplied to journal!' });
  };

  const handleCopyMessage = async (messageContent: string) => {
    try {
      await navigator.clipboard.writeText(messageContent);
      sileo.success({ title: 'Copied to clipboard!' });
    } catch (error) {
      sileo.error({ title: 'Failed to copy' });
    }
  };

  const handleDismissContent = () => {
    setPendingContent(null);
    setPendingMessageIndex(null);
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setPendingContent(null);
    setPendingMessageIndex(null);
  };

  const handleAcceptBlock = (blockId: string) => {
    const block = pendingBlocks.find(b => b.id === blockId);
    if (!block) return;
    const newContent = content ? content + '\n\n' + block.content : block.content;
    setContent(newContent);
    setPendingBlocks(prev => prev.filter(b => b.id !== blockId));
    sileo.success({ title: 'Section added!' });
  };

  const handleDenyBlock = (blockId: string) => {
    setPendingBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const handleAcceptAllBlocks = () => {
    const pendingOnly = pendingBlocks.filter(b => b.status === 'pending');
    if (pendingOnly.length === 0) return;
    const combinedContent = pendingOnly.map(b => b.content).join('\n\n');
    const newContent = content ? content + '\n\n' + combinedContent : combinedContent;
    setContent(newContent);
    setPendingBlocks([]);
    sileo.success({ title: 'All sections added!' });
  };

  const handleDenyAllBlocks = () => setPendingBlocks([]);
  const handleClearPendingBlocks = () => setPendingBlocks([]);

  useEffect(() => {
    const handleClickOutside = () => setShowSlashMenu(false);
    if (showSlashMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSlashMenu]);

  // Auto-focus chat input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 150);
    }
  }, [chatPanelOpen]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading journal...</p>
        </div>
      </div>
    );
  }

  const isEmpty = !content || content.trim() === '';
  const allCommands = getAllCommands();

  return (
    <div className="min-h-screen bg-new-background flex p-[20px]">
      <JournalSidebar
        activeJournalId={params.id as string}
        onCollapseChange={setSidebarCollapsed}
      />

      {/* Main editor column */}
      <div className={cn(
        "bg-white shadow-lg rounded-[20px] flex flex-col flex-1 transition-all duration-300 ease-out min-h-screen min-w-0",
        sidebarCollapsed ? "ml-16" : "ml-56"
      )}>

        {/* Topic Prompt Modal */}
        <Dialog open={showTopicModal} onClose={() => { setShowTopicModal(false); setPendingAction(null); setTopicInput(''); }} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6">
                <DialogTitle className="text-lg font-semibold text-foreground mb-2">
                  {pendingAction === 'Agathon Method' && 'Ask Agathon to teach you'}
                  {pendingAction === 'Flashcards' && 'Create flashcards'}
                  {pendingAction === 'Practice Problems' && 'Generate practice problems'}
                  {pendingAction === 'Notes' && 'Create notes'}
                  {pendingAction === 'Image' && 'Generate an image'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mb-4">
                  {getActionPromptText(pendingAction || '')}
                </p>
                <input
                  type="text"
                  autoFocus
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && topicInput.trim()) handleTopicSubmit();
                  }}
                  placeholder="e.g., Addition, Fractions, Photosynthesis..."
                  className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
                />
              </div>
              <div className="flex gap-3 p-4 bg-muted border-t border-border">
                <button
                  onClick={() => { setShowTopicModal(false); setPendingAction(null); setTopicInput(''); }}
                  className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTopicSubmit}
                  disabled={!topicInput.trim()}
                  className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate
                </button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* Header */}
        <header className="fixed flex items-center justify-between px-5 py-3 z-[60] flex-shrink-0 w-[91%] bg-white rounded-[20px]">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/journal')}
              className="text-[.9rem] p-2 bg-new-background rounded-lg transition-colors text-foreground flex items-center gap-2"
              title="Back to journals"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

           {/* Chat toggle button — VS Code style */}
            <button
              className={cn(
                "p-2 font-semibold flex text-[.9rem] text-new-foreground cursor-pointer items-center transition-colors gap-[5px] relative bg-new-background rounded-lg",
                chatPanelOpen
                  ? "bg-new-background text-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={() => setChatPanelOpen(prev => !prev)}
              title="Toggle AI Chat"
            >
              Ask AI
              <ChatCircle  className="h-4 w-4" />
              {chatMessages.length > 0 && !chatPanelOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-foreground rounded-full" />
              )}
            </button>

          {/* Right */}
          <div className="flex items-center gap-0.5 bg-new-background rounded-lg p-1">
            {/* Proactive AI */}
            <div className="relative" ref={proactiveDropdownRef}>
              <button
                className={cn(
                  "p-2 transition-colors",
                  proactiveAIEnabled ? "bg-accent text-foreground" : "hover:bg-muted text-muted-foreground"
                )}
                onClick={() => setShowProactiveDropdown(!showProactiveDropdown)}
              >
                <Lightbulb   className="h-5 w-5" />
                {isGeneratingSuggestion && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-foreground animate-pulse" />
                )}
              </button>
              {showProactiveDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border shadow-lg p-4 z-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb  className="h-4 w-4 text-foreground" />
                      <span className="font-medium text-foreground text-sm">Proactive AI Mode</span>
                    </div>
                    <Switch
                      checked={proactiveAIEnabled}
                      onChange={setProactiveAIEnabled}
                      className={cn(
                        "relative w-10 h-5 rounded-full transition-colors",
                        proactiveAIEnabled ? "bg-[#007ba5]" : "bg-[#c0c4cc]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                          proactiveAIEnabled ? "translate-x-0" : "-translate-x-5"
                        )}
                      />
                    </Switch>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {proactiveAIEnabled
                      ? "AI will suggest helpful additions as you write"
                      : "Enable to get intelligent suggestions while writing"}
                  </p>
                </div>
              )}
            </div>

            <button
              className="p-2 hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => sileo.info({ title: 'Timer feature coming soon!' })}
            >
              <Timer  className="h-5 w-5" />
            </button>

            <button
              className="p-2 hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => sileo.info({ title: 'More options coming soon!' })}
            >
              <DotsThree  className="h-5 w-5" />
            </button>
            <button
              onClick={() => sileo.info({ title: 'Sharing is coming soon!' })}
              className="rounded-md ml-2 bg-foreground hover:bg-foreground/90 text-background text-xs font-medium px-4 py-2 transition-colors"
            >
              Share
            </button>
          </div>
        </header>

        {/* Body: editor + optional chat panel side by side */}
        <div className="flex flex-1 min-h-0 mt-[60px]">

          {/* Editor area */}
          <div className="flex-1 overflow-y-auto min-w-0">
            <main className="px-8 py-8 max-w-3xl mx-auto">

              {/* Large serif title */}
              <div className="mb-8">
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  className="text-3xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0 w-full tracking-tight"
                  style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
                  placeholder="New Journal"
                />
                <div className="h-px bg-border mt-4" />
              </div>

              {/* Start with section */}
              {isEmpty && !activeInlineInput && !isGeneratingFlashcards && flashcards.length === 0 && (
                <div className="mb-8">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Start with</p>
                  <div className="grid grid-cols-3 gap-px bg-border border border-border">
                    <button
                      onClick={() => handleQuickAction('Agathon Method')}
                      disabled={isGenerating}
                      className="bg-card hover:bg-accent p-4 text-left transition-colors disabled:opacity-50 group"
                    >
                      <Sparkle  className="h-5 w-5 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">Ask Agathon</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Generate study notes</p>
                    </button>
                    <button
                      onClick={() => handleOpenInlineInput('Flashcards')}
                      disabled={isGenerating}
                      className="bg-card hover:bg-accent p-4 text-left transition-colors disabled:opacity-50 group"
                    >
                      <Stack  className="h-5 w-5 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">Flashcards</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Study with spaced repetition</p>
                    </button>
                    <button
                      onClick={() => handleOpenInlineInput('Practice Problems')}
                      disabled={isGenerating}
                      className="bg-card hover:bg-accent p-4 text-left transition-colors disabled:opacity-50 group"
                    >
                      <ClipboardText  className="h-5 w-5 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">Practice</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Generate practice problems</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Input for Practice Problems / Flashcards */}
              {activeInlineInput && !isGeneratingFlashcards && flashcards.length === 0 && (
                <div className="mb-8 space-y-4">
                  <div className="flex gap-px bg-border border border-border">
                    <button
                      onClick={() => handleQuickAction('Agathon Method')}
                      disabled={isGenerating}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Ask Agathon
                    </button>
                    <button
                      onClick={() => handleOpenInlineInput('Flashcards')}
                      disabled={isGenerating}
                      className={cn(
                        "flex-1 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
                        activeInlineInput === 'Flashcards'
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Flashcards
                    </button>
                    <button
                      onClick={() => handleOpenInlineInput('Practice Problems')}
                      disabled={isGenerating}
                      className={cn(
                        "flex-1 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
                        activeInlineInput === 'Practice Problems'
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Practice
                    </button>
                  </div>

                  <div className="flex items-center gap-2 bg-muted px-4 py-3 border border-border">
                    <input
                      ref={inlineInputRef}
                      type="text"
                      value={inlineInputValue}
                      onChange={(e) => setInlineInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inlineInputValue.trim()) handleInlineInputSubmit();
                        else if (e.key === 'Escape') { setActiveInlineInput(null); setInlineInputValue(''); }
                      }}
                      placeholder={activeInlineInput === 'Practice Problems' ? 'What topic for practice problems?' : 'What topic for flashcards?'}
                      className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground focus:ring-0"
                      disabled={isGenerating}
                    />
                    {(activeInlineInput === 'Practice Problems' || activeInlineInput === 'Flashcards') && (
                      <div className="flex items-center gap-1 bg-card px-2 py-1 border border-border">
                        <select
                          value={activeInlineInput === 'Flashcards' ? flashcardCount : practiceCount}
                          onChange={(e) => {
                            if (activeInlineInput === 'Flashcards') setFlashcardCount(Number(e.target.value));
                            else setPracticeCount(Number(e.target.value));
                          }}
                          className="bg-transparent border-none outline-none text-sm text-foreground focus:ring-0 pr-1"
                        >
                          {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    )}
                    <button
                      onClick={handleInlineInputSubmit}
                      disabled={!inlineInputValue.trim() || isGenerating}
                      className="w-8 h-8 bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors disabled:opacity-50"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Flashcard Loading State */}
              {isGeneratingFlashcards && (
                <div className="mb-8 space-y-4">
                  <div className="flex gap-px bg-border border border-border">
                    <div className="flex-1 px-4 py-2.5 text-sm font-medium bg-card text-muted-foreground opacity-50">Ask Agathon</div>
                    <div className="flex-1 px-4 py-2.5 text-sm font-medium bg-foreground text-background text-center">Flashcards</div>
                    <div className="flex-1 px-4 py-2.5 text-sm font-medium bg-card text-muted-foreground opacity-50">Practice</div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-card border border-border overflow-hidden">
                      <div className="flex items-center justify-center py-20">
                        <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mr-3" />
                        <span className="text-foreground font-medium">Creating {flashcardCount} flashcards...</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">&quot;{flashcardTopic}&quot;</p>
                  </div>
                </div>
              )}

              {/* Interactive Flashcard Display */}
              {flashcards.length > 0 && !isGeneratingFlashcards && (
                <div className="mb-8 space-y-4">
                  <div className="flex gap-px bg-border border border-border">
                    <button
                      onClick={() => { setFlashcards([]); handleQuickAction('Agathon Method'); }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Ask Agathon
                    </button>
                    <div className="flex-1 px-4 py-2.5 text-sm font-medium bg-foreground text-background text-center">
                      Flashcards
                    </div>
                    <button
                      onClick={() => { setFlashcards([]); handleOpenInlineInput('Practice Problems'); }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Practice
                    </button>
                  </div>

                  <div
                    onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                    className="bg-card border border-border min-h-[320px] flex items-center justify-center cursor-pointer hover:bg-accent transition-all"
                  >
                    <div className="px-12 py-16 text-center max-w-2xl">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                        {isFlashcardFlipped ? 'Answer' : 'Question'} — Click to flip
                      </p>
                      <p className="text-xl font-medium text-foreground leading-relaxed" style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}>
                        {isFlashcardFlipped
                          ? flashcards[currentFlashcardIndex]?.answer
                          : flashcards[currentFlashcardIndex]?.question}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-px bg-border border border-border w-fit mx-auto">
                    <button onClick={handleShuffleFlashcards} className="p-2.5 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Shuffle">
                      <Shuffle className="h-4 w-4" />
                    </button>
                    <button onClick={handlePrevFlashcard} className="p-2.5 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Previous">
                      <CaretLeft weight="bold" className="h-4 w-4" />
                    </button>
                    <span className="px-4 py-2.5 bg-card text-sm text-foreground font-medium tabular-nums min-w-[80px] text-center">
                      {currentFlashcardIndex + 1} / {flashcards.length}
                    </span>
                    <button onClick={handleNextFlashcard} className="p-2.5 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Next">
                      <CaretRight weight="bold" className="h-4 w-4" />
                    </button>
                    <button onClick={handleDeleteFlashcards} className="p-2.5 bg-card text-red-600 dark:text-red-400 hover:bg-muted transition-colors" title="Delete flashcards">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Pending Blocks */}
              {pendingBlocks.length > 0 && (
                <div className="mb-8 space-y-2">
                  <div className="flex items-center justify-between bg-muted px-4 py-3 border border-border">
                    <div className="flex items-center gap-2">
                      <Sparkle  className="h-4 w-4 text-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {pendingBlocks.filter(b => b.status === 'pending').length} section{pendingBlocks.filter(b => b.status === 'pending').length !== 1 ? 's' : ''} to review
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAcceptAllBlocks}
                        disabled={pendingBlocks.filter(b => b.status === 'pending').length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept All
                      </button>
                      <button
                        onClick={handleDenyAllBlocks}
                        disabled={pendingBlocks.filter(b => b.status === 'pending').length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Deny All
                      </button>
                      <button
                        onClick={handleClearPendingBlocks}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Dismiss all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {pendingBlocks.map((block) => (
                    <div
                      key={block.id}
                      className={cn(
                        'relative border overflow-hidden transition-all duration-300',
                        block.status === 'pending' ? 'bg-card border-border'
                          : block.status === 'accepted' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 opacity-60'
                          : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 opacity-40 line-through'
                      )}
                    >
                      <div className={cn(
                        'absolute left-0 top-0 bottom-0 w-1',
                        block.status === 'pending' ? 'bg-foreground'
                          : block.status === 'accepted' ? 'bg-green-600'
                          : 'bg-red-600'
                      )} />
                      <div className="pl-4 pr-3 py-3">
                        <div className="flex items-start gap-3">
                          {block.status === 'pending' && (
                            <div className="w-5 h-5 bg-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Plus className="h-3 w-3 text-background" />
                            </div>
                          )}
                          {block.status === 'accepted' && (
                            <div className="w-5 h-5 bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          {block.status === 'denied' && (
                            <div className="w-5 h-5 bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <X className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                'text-sm leading-relaxed',
                                block.status === 'denied' ? 'text-muted-foreground' : 'text-foreground/80'
                              )}
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content.slice(0, 300) + (block.content.length > 300 ? '...' : '')) }}
                            />
                          </div>
                          {block.status === 'pending' && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleAcceptBlock(block.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
                              >
                                <Check className="h-3 w-3" />
                                Accept
                              </button>
                              <button
                                onClick={() => handleDenyBlock(block.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                              >
                                <X className="h-3 w-3" />
                                Deny
                              </button>
                            </div>
                          )}
                          {block.status === 'accepted' && <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">Added</span>}
                          {block.status === 'denied' && <span className="text-xs text-red-600 dark:text-red-400 font-medium flex-shrink-0">Removed</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* WYSIWYG Rich Text Editor */}
              <div className="relative min-h-[60vh] pb-20">
                <ContentWithEmbeds
                  content={content}
                  onChange={setContent}
                  placeholder="Start writing or click a button above to generate notes... Type '/' for commands."
                  embeddedWhiteboards={embeddedWhiteboards}
                  embeddedDesmos={embeddedDesmos}
                  onWhiteboardSave={(id, data) => {
                    setEmbeddedWhiteboards(prev => prev.map(wb => wb.id === id ? { ...wb, data } : wb));
                  }}
                  onDeleteWhiteboard={(id) => {
                    setEmbeddedWhiteboards(prev => prev.filter(wb => wb.id !== id));
                    setContent(prev => prev.replace(new RegExp(`\\n*\\[WHITEBOARD:${id}\\]\\n*`, 'g'), '\n'));
                    sileo.success({ title: 'Whiteboard deleted' });
                  }}
                  onDeleteDesmos={(id) => {
                    setContent(prev => prev.replace(new RegExp(`\\n*\\[DESMOS:${id}:[^\\]]*\\]\\n*`, 'g'), '\n'));
                    sileo.success({ title: 'Graph deleted' });
                  }}
                  onChartSave={(id, data) => {
                    setContent(prev => {
                      const regex = new RegExp(`\\[CHART:${id}:[^\\]]*\\]`);
                      const newPlaceholder = `[CHART:${id}:${encodeChartData(data)}]`;
                      return prev.replace(regex, newPlaceholder);
                    });
                    sileo.success({ title: 'Chart saved!' });
                  }}
                  onDeleteChart={(id) => {
                    setContent(prev => prev.replace(new RegExp(`\\n*\\[CHART:${id}:[^\\]]*\\]\\n*`, 'g'), '\n'));
                    sileo.success({ title: 'Chart deleted' });
                  }}
                  onSlashCommand={executeCommand}
                />

                {/* Proactive AI Suggestion */}
                {proactiveSuggestion && proactiveAIEnabled && (
                  <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-accent border border-border p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted flex items-center justify-center flex-shrink-0">
                          <Lightbulb className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {proactiveSuggestion}
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={handleApplySuggestion}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium transition-colors hover:bg-foreground/90"
                            >
                              <Check className="h-3 w-3" />
                              Add to notes
                            </button>
                            <button
                              onClick={handleDismissSuggestion}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted text-muted-foreground text-xs font-medium border border-border transition-colors"
                            >
                              <X className="h-3 w-3" />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Proactive AI Generating Indicator */}
                {isGeneratingSuggestion && proactiveAIEnabled && !proactiveSuggestion && (
                  <div className="mt-4 animate-in fade-in duration-200">
                    <div className="bg-accent/50 border border-border px-4 py-3 flex items-center gap-3">
                      <CircleNotch className="h-4 w-4 text-muted-foreground animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking of suggestions...</span>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* ── VS Code-style Chat Panel ── */}
          <div
            className={cn(
              "fixed right-[20px] h-[90vh] flex flex-col border-l border-border bg-card transition-all duration-300 ease-out overflow-hidden flex-shrink-0",
              chatPanelOpen ? "w-[340px]" : "w-0"
            )}
          >
            {chatPanelOpen && (
              <>
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-foreground flex items-center justify-center">
                      <Sparkle className="h-3.5 w-3.5 text-background" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Agathon AI</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {chatMessages.length > 0 && (
                      <button
                        onClick={handleClearChat}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs flex items-center gap-1"
                        title="Clear chat"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setChatPanelOpen(false)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Messages area */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-scroll px-4 py-4 space-y-4 min-h-0"
                >
                  {chatMessages.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
                      <div className="w-12 h-12 bg-muted flex items-center justify-center">
                        <Sparkle  className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Ask Agathon anything</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Ask about concepts, request explanations, generate content, or get study help.
                        </p>
                      </div>
                      {/* Quick suggestion chips */}
                      <div className="flex flex-col gap-1.5 w-full mt-2">
                        {[
                          'Explain this topic simply',
                          'Create practice problems',
                          'Summarize key points',
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => {
                              setChatInput(suggestion);
                              setTimeout(() => chatInputRef.current?.focus(), 50);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-muted-foreground bg-muted hover:bg-accent hover:text-foreground border border-border transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx}>
                        {msg.role === 'user' ? (
                          <div className="flex justify-end">
                            <div className="bg-foreground text-background px-3 py-2 text-sm max-w-[85%] leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2.5">
                              <div className="w-6 h-6 bg-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Sparkle className="h-3 w-3 text-background" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-[13px] text-foreground/80 leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                />
                                {/* Action buttons */}
                                <div className="flex items-center gap-2 mt-2">
                                  {msg.written ? (
                                    <>
                                      <span className="inline-flex items-center gap-1 text-[11px] text-foreground font-medium">
                                        <Check className="h-3 w-3" />
                                        Written!
                                      </span>
                                      <button
                                        onClick={() => handleReapplyContent(msg.content, idx)}
                                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                                      >
                                        <ArrowsClockwise className="h-3 w-3" />
                                        Reapply
                                      </button>
                                    </>
                                  ) : pendingMessageIndex === idx ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={handleAcceptContent}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-foreground text-background hover:bg-foreground/90 transition-colors font-medium"
                                      >
                                        <Check className="h-3 w-3" />
                                        Add to Journal
                                      </button>
                                      <button
                                        onClick={handleDismissContent}
                                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  ) : null}
                                  <button
                                    onClick={() => handleCopyMessage(msg.content)}
                                    className="inline-flex items-center p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors ml-auto"
                                    title="Copy to clipboard"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* Typing indicator */}
                  {isChatting && (
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 bg-foreground flex items-center justify-center flex-shrink-0">
                        <div className="h-3 w-3 border border-background/30 border-t-background animate-spin" />
                      </div>
                      <div className="text-[13px] text-muted-foreground mt-1">
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat input at bottom */}
                <div className="flex-shrink-0 border-t border-border p-3">
                  <div className="flex items-end gap-2 bg-muted border border-border px-3 py-2">
                    <textarea
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        // Auto-resize
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleChatSubmit();
                        }
                      }}
                      placeholder={placeholderTexts[placeholderIndex]}
                      rows={1}
                      disabled={isChatting}
                      className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground focus:ring-0 resize-none leading-relaxed"
                      style={{ minHeight: '24px', maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleChatSubmit}
                      disabled={!chatInput.trim() || isChatting}
                      className="w-7 h-7 bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      {isChatting
                        ? <div className="h-3 w-3 border border-background/30 border-t-background animate-spin" />
                        : <ArrowUp className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                    Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 px-6 py-3 pointer-events-none">
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground tabular-nums">
            {isSaving ? 'Saving...' : lastSaved ? `Last saved ${formatDistance(lastSaved, new Date(), { addSuffix: true })}` : ''}
          </span>
        </div>
      </footer>

      {/* YouTube Embed Modal */}
      <Dialog open={showYoutubeModal} onClose={() => setShowYoutubeModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <YoutubeLogo  className="h-5 w-5 text-muted-foreground" />
                  Embed YouTube Video
                </DialogTitle>
                <button onClick={() => setShowYoutubeModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Paste a YouTube video URL to embed it in your journal.</p>
              <input
                type="text"
                autoFocus
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && youtubeUrl.trim()) handleYoutubeEmbed(); }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
              />
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowYoutubeModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleYoutubeEmbed} disabled={!youtubeUrl.trim()} className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Embed</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Journal Link Modal */}
      <Dialog open={showJournalLinkModal} onClose={() => setShowJournalLinkModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Link className="h-5 w-5 text-muted-foreground" />
                  Link to Journal
                </DialogTitle>
                <button onClick={() => setShowJournalLinkModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="relative mb-4">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={journalSearchQuery}
                  onChange={(e) => { setJournalSearchQuery(e.target.value); searchJournals(e.target.value); }}
                  placeholder="Search journals..."
                  className="w-full pl-10 pr-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchedJournals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No journals found</p>
                ) : (
                  searchedJournals.map((j) => (
                    <button key={j.id} onClick={() => handleJournalLink(j)} className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{j.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDistance(new Date(j.updated_at), new Date(), { addSuffix: true })}</p>
                      </div>
                      <ArrowSquareOut className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowJournalLinkModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Desmos Graph Modal */}
      <Dialog open={showDesmosModal} onClose={() => setShowDesmosModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ChartLine className="h-5 w-5 text-muted-foreground" />
                  Add Desmos Graph
                </DialogTitle>
                <button onClick={() => setShowDesmosModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Enter a math expression to graph (e.g., y=x^2, sin(x), etc.)</p>
              <input
                type="text"
                autoFocus
                value={desmosExpression}
                onChange={(e) => setDesmosExpression(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && desmosExpression.trim()) handleDesmosEmbed(); }}
                placeholder="y = x^2"
                className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all font-mono"
              />
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowDesmosModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDesmosEmbed} disabled={!desmosExpression.trim()} className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Add Graph</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'audio')} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
      <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'pdf')} />
    </div>
  );
}