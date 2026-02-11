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
} from '@phosphor-icons/react';
import {
  Dialog, DialogPanel, DialogTitle, DialogBackdrop,
  Switch,
  RadioGroup, Radio,
  TabGroup, TabList, Tab, TabPanels, TabPanel,
} from '@headlessui/react';
import { debounce } from 'lodash';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/journal/RichTextEditor';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';

// Simple markdown renderer for chat messages with DOMPurify sanitization
function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers (order matters - check longer patterns first)
    .replace(/^###### (.+)$/gm, '<h6 class="font-semibold text-[13px] mt-2 mb-0.5 text-foreground">$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5 class="font-semibold text-[13px] mt-2 mb-0.5 text-foreground">$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4 class="font-semibold text-[13px] mt-2.5 mb-0.5 text-foreground">$1</h4>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-[14px] mt-2.5 mb-0.5 text-foreground">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-[15px] mt-3 mb-1 text-foreground">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-[16px] mt-3 mb-1 text-foreground">$1</h2>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[12px] font-mono text-foreground/80">$1</code>')
    // Unordered lists
    .replace(/^\* (.+)$/gm, '<li class="ml-3 list-disc text-foreground/80">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc text-foreground/80">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-3 list-decimal text-foreground/80">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="mt-1.5">')
    .replace(/\n/g, '<br />');

  // Wrap in paragraph
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  // Sanitize output to prevent XSS
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'li', 'ul', 'ol'],
    ALLOWED_ATTR: ['class'],
  });
}

// Dynamically import tldraw to avoid SSR issues
const InlineWhiteboard = dynamic(
  () => import('@/components/journal/InlineWhiteboard').then(mod => mod.InlineWhiteboard),
  { ssr: false, loading: () => <div className="h-[400px] bg-muted animate-pulse" /> }
);

const InlineDesmos = dynamic(
  () => import('@/components/journal/InlineDesmos').then(mod => mod.InlineDesmos),
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

// Component that renders content with embedded whiteboards and Desmos graphs
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
}) {
  // Extract placeholders from content for rendering embedded components
  const whiteboardMatches = [...content.matchAll(/\[WHITEBOARD:([^\]]+)\]/g)];
  const desmosMatches = [...content.matchAll(/\[DESMOS:([^:\]]+):([^\]]*)\]/g)];

  // Remove placeholders from the content for the editor (they'll be rendered separately)
  const editorContent = content
    .replace(/\n*\[WHITEBOARD:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[DESMOS:[^\]]+\]\n*/g, '\n')
    .trim();

  return (
    <div className="space-y-6">
      {/* Main editor for text content */}
      <RichTextEditor
        content={editorContent}
        onChange={(newContent) => {
          // Preserve the embedded placeholders when content changes
          let fullContent = newContent;

          // Re-add whiteboard placeholders at the end
          whiteboardMatches.forEach(match => {
            if (!fullContent.includes(match[0])) {
              fullContent += `\n\n${match[0]}`;
            }
          });

          // Re-add desmos placeholders at the end (just the placeholder, no label)
          desmosMatches.forEach(match => {
            if (!fullContent.includes(match[0])) {
              fullContent += `\n\n${match[0]}`;
            }
          });

          onChange(fullContent);
        }}
        placeholder={placeholder}
        onSlashCommand={onSlashCommand}
      />

      {/* Render embedded whiteboards */}
      {whiteboardMatches.map((match) => {
        const id = match[1];
        const wb = embeddedWhiteboards.find(w => w.id === id);
        return (
          <div key={`wb-${id}`} className="my-4 group relative">
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
      })}

      {/* Render embedded Desmos graphs */}
      {desmosMatches.map((match) => {
        const id = match[1];
        const expression = match[2];
        return (
          <div key={`desmos-${id}`} className="my-4 group relative">
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
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Topic prompt modal state
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');

  // Command input state
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
  const [showChartModal, setShowChartModal] = useState(false);
  const [chartData, setChartData] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

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
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Pending content blocks for diff-style accept/deny
  const [pendingBlocks, setPendingBlocks] = useState<Array<{ id: string; content: string; status: 'pending' | 'accepted' | 'denied' }>>([]);

  // Function to detect if user is asking to create/make notes
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

  // Function to parse AI response into content blocks (by headers or paragraphs)
  const parseContentIntoBlocks = (content: string): Array<{ id: string; content: string; status: 'pending' | 'accepted' | 'denied' }> => {
    // Split by headers (## or ###) to create logical sections
    const sections = content.split(/(?=^#{1,3}\s)/m).filter(s => s.trim());

    if (sections.length <= 1) {
      // If no headers, split by double newlines to create paragraph blocks
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

  // Cycling placeholder texts
  const placeholderTexts = [
    'Ask to look something up',
    'Ask to find similar examples',
    'Ask to explain a concept',
    'Ask to create practice problems',
    'Ask to simplify this topic',
  ];

  // Cycle through placeholders
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [placeholderTexts.length]);

  // Embedded content state (whiteboards, desmos graphs, etc.)
  const [embeddedWhiteboards, setEmbeddedWhiteboards] = useState<{ id: string; data?: string }[]>([]);
  const [embeddedDesmos, setEmbeddedDesmos] = useState<{ id: string; expression: string }[]>([]);

  // Inline input state for quick actions (practice problems, flashcards, etc.)
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
        toast.error('Failed to load journal');
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

  // Save on changes
  useEffect(() => {
    if (journal && !loading) {
      saveJournal(title, content);
    }
  }, [title, content, journal, loading, saveJournal]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  // Generate AI content
  const generateAIContent = async (type: string, customTopic?: string) => {
    setIsGenerating(true);
    const typeLabels: Record<string, string> = {
      notes: 'notes',
      flashcards: 'flashcards',
      practice: 'practice problems',
      image: 'image',
    };
    const typeLabel = typeLabels[type] || 'content';
    const toastId = toast.loading(`Generating ${typeLabel}...`);

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

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();

      // Set the generated content
      const newContent = content ? content + '\n\n' + data.content : data.content;
      setContent(newContent);

      toast.success(`${typeLabel} generated!`, { id: toastId });
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content', { id: toastId });
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
      // Update the title to the topic (except for image generation)
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
      case 'Agathon Method':
        return 'What topic would you like Agathon to teach you about?';
      case 'Flashcards':
        return 'What topic would you like to create flashcards for?';
      case 'Practice Problems':
        return 'What topic would you like practice problems for?';
      case 'Notes':
        return 'What topic would you like notes on?';
      case 'Image':
        return 'What would you like to generate an image of?';
      default:
        return 'What topic would you like to explore?';
    }
  };

  // Handle inline input for quick actions (practice problems, flashcards)
  const handleInlineInputSubmit = async () => {
    if (!activeInlineInput || !inlineInputValue.trim()) return;

    const topic = inlineInputValue.trim();

    if (activeInlineInput === 'Flashcards') {
      // Handle flashcards specially - show loading state and parse response
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
        toast.error('Failed to generate flashcards');
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

  // Helper to clean markdown from text
  const cleanMarkdown = (text: string): string => {
    return text
      .replace(/^#+\s*/gm, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove inline code
      .replace(/^[-•]\s*/gm, '') // Remove list markers
      .replace(/^\d+\.\s*/gm, '') // Remove numbered list markers
      .replace(/Card\s*\d+\s*:?\s*/gi, '') // Remove "Card X:" prefix
      .replace(/Front\s*:?\s*/gi, '') // Remove "Front:" prefix
      .replace(/Back\s*:?\s*/gi, '') // Remove "Back:" prefix
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
  };

  // Parse flashcards from AI response
  const parseFlashcardsFromResponse = (responseContent: string): Array<{ question: string; answer: string }> => {
    const parsedCards: Array<{ question: string; answer: string }> = [];

    // Primary approach: Split by card headers (### Card N) and extract Front/Back from each
    const cardSections = responseContent.split(/###?\s*Card\s*\d+\s*/i).filter(s => s.trim());
    if (cardSections.length > 0) {
      for (const section of cardSections) {
        const frontMatch = section.match(/\*\*Front[:\s]*\*\*\s*(.+)/i);
        const backMatch = section.match(/\*\*Back[:\s]*\*\*\s*(.+)/i);
        if (frontMatch && backMatch) {
          const question = cleanMarkdown(frontMatch[1]);
          const answer = cleanMarkdown(backMatch[1]);
          if (question && answer) {
            parsedCards.push({ question, answer });
          }
        }
      }
    }

    // Format 2: **Q:** ... **A:** ...
    if (parsedCards.length === 0) {
      let match;
      const qaPattern = /\*\*Q(?:uestion)?[:\s]*\*\*\s*([\s\S]+?)\s*\*\*A(?:nswer)?[:\s]*\*\*\s*([\s\S]+?)(?=\*\*Q|\n\n\*\*|\n\n##|$)/gi;
      while ((match = qaPattern.exec(responseContent)) !== null) {
        const question = cleanMarkdown(match[1]);
        const answer = cleanMarkdown(match[2]);
        if (question && answer) {
          parsedCards.push({ question, answer });
        }
      }
    }

    // Format 3: **Front:** ... **Back:** ... (without card headers)
    if (parsedCards.length === 0) {
      let match;
      const frontBackPattern = /\*\*Front[:\s]*\*\*\s*([\s\S]+?)\s*\*\*Back[:\s]*\*\*\s*([\s\S]+?)(?=\*\*Front|$)/gi;
      while ((match = frontBackPattern.exec(responseContent)) !== null) {
        const question = cleanMarkdown(match[1]);
        const answer = cleanMarkdown(match[2]);
        if (question && answer) {
          parsedCards.push({ question, answer });
        }
      }
    }

    // Format 4: Numbered questions with answers on next line
    if (parsedCards.length === 0) {
      let match;
      const numberedPattern = /\d+\.\s*\*?\*?(.+?\?)\*?\*?\s*\n+\s*[-•]?\s*(.+?)(?=\n\d+\.|$)/g;
      while ((match = numberedPattern.exec(responseContent)) !== null) {
        const question = cleanMarkdown(match[1]);
        const answer = cleanMarkdown(match[2].split('\n')[0]);
        if (question && answer) {
          parsedCards.push({ question, answer });
        }
      }
    }

    // Fallback: Split by double newlines and alternate Q/A
    if (parsedCards.length === 0) {
      const lines = responseContent.split(/\n\n+/).filter(l => l.trim());
      for (let i = 0; i < lines.length - 1; i += 2) {
        const question = cleanMarkdown(lines[i]);
        const answer = cleanMarkdown(lines[i + 1] || '');
        if (question && answer) {
          parsedCards.push({ question, answer });
        }
      }
    }

    return parsedCards.slice(0, 20); // Limit to 20 flashcards
  };

  // Flashcard navigation functions
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

  // Proactive AI - analyze content and provide suggestions
  const analyzeContentForSuggestions = useCallback(
    debounce(async (currentContent: string) => {
      if (!proactiveAIEnabled || !currentContent || currentContent.length < 50) {
        setProactiveSuggestion(null);
        return;
      }

      // Don't re-analyze if content hasn't changed significantly
      if (currentContent === lastAnalyzedContent.current) return;

      // Only analyze every ~200 characters of change
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
            content: currentContent.slice(-1500), // Last 1500 chars for context
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
    }, 3000), // 3 second debounce
    [proactiveAIEnabled, title]
  );

  // Effect to trigger proactive analysis when content changes
  useEffect(() => {
    if (proactiveAIEnabled && content) {
      analyzeContentForSuggestions(content);
    }
  }, [content, proactiveAIEnabled, analyzeContentForSuggestions]);

  // Click outside to close proactive dropdown
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

  // Apply proactive suggestion to content
  const handleApplySuggestion = () => {
    if (!proactiveSuggestion) return;
    const newContent = content ? content + '\n\n' + proactiveSuggestion : proactiveSuggestion;
    setContent(newContent);
    setProactiveSuggestion(null);
    toast.success('Suggestion applied!');
  };

  // Dismiss proactive suggestion
  const handleDismissSuggestion = () => {
    setProactiveSuggestion(null);
  };

  // Open inline input for an action
  const handleOpenInlineInput = (action: string) => {
    setActiveInlineInput(action);
    setInlineInputValue('');
    setFlashcards([]); // Clear any existing flashcards when opening input
    // Focus the input after it renders
    setTimeout(() => inlineInputRef.current?.focus(), 100);
  };

  // Get all flat commands for navigation
  const getAllCommands = () => {
    const filtered = slashFilter.toLowerCase();
    return slashCommands.flatMap(cat =>
      cat.items.filter(item =>
        item.label.toLowerCase().includes(filtered)
      )
    );
  };

  // Handle command input changes
  const handleCommandInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommandInput(value);

    // Check for slash command
    if (value.startsWith('/')) {
      setSlashFilter(value.slice(1));
      setShowSlashMenu(true);
      setSelectedCommandIndex(0);
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  };

  // Handle keyboard navigation in slash menu
  const handleCommandKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSlashMenu) {
      if (e.key === 'Enter' && commandInput.trim()) {
        // Add as plain text content
        const newContent = content ? content + '\n\n' + commandInput : commandInput;
        setContent(newContent);
        setCommandInput('');
      }
      return;
    }

    const allCommands = getAllCommands();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCommandIndex(prev =>
        prev < allCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCommandIndex(prev =>
        prev > 0 ? prev - 1 : allCommands.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedCommand = allCommands[selectedCommandIndex];
      if (selectedCommand) {
        executeCommand(selectedCommand.id);
      }
    } else if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setCommandInput('');
    }
  };

  // Execute a slash command
  const executeCommand = async (commandId: string) => {
    setShowSlashMenu(false);
    setCommandInput('');

    const aiCommands = ['notes', 'practice', 'flashcards', 'generate-image'];
    const formatCommands = ['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'quote', 'divider', 'code', 'latex', 'table', 'details'];

    if (aiCommands.includes(commandId)) {
      // For flashcards and practice problems, use inline input instead of modal
      if (commandId === 'flashcards') {
        handleOpenInlineInput('Flashcards');
        return;
      }
      if (commandId === 'practice') {
        handleOpenInlineInput('Practice Problems');
        return;
      }
      // For other AI commands, show the topic modal
      const actionMap: Record<string, string> = {
        'notes': 'Notes',
        'generate-image': 'Image',
      };
      handleQuickAction(actionMap[commandId] || 'Notes');
    } else if (formatCommands.includes(commandId)) {
      // Insert formatting into content
      let insertText = '';
      switch (commandId) {
        case 'h1':
          insertText = '# ';
          break;
        case 'h2':
          insertText = '## ';
          break;
        case 'h3':
          insertText = '### ';
          break;
        case 'bullet':
          insertText = '- ';
          break;
        case 'numbered':
          insertText = '1. ';
          break;
        case 'quote':
          insertText = '> ';
          break;
        case 'divider':
          insertText = '\n---\n';
          break;
        case 'code':
          insertText = '```\n\n```';
          break;
        case 'latex':
          insertText = '$$\n\n$$';
          break;
        case 'table':
          insertText = '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n';
          break;
        case 'details':
          insertText = '\n<details>\n<summary>Click to expand</summary>\n\nHidden content goes here...\n\n</details>\n';
          break;
        default:
          insertText = '';
      }
      const newContent = content ? content + '\n\n' + insertText : insertText;
      setContent(newContent);
    } else {
      // Handle other commands
      switch (commandId) {
        case 'whiteboard':
          handleWhiteboardInsert();
          break;
        case 'desmos':
          handleDesmosInsert();
          break;
        case 'chart':
          setChartData('');
          setChartType('bar');
          setShowChartModal(true);
          break;
        case 'subjournal':
          handleCreateSubjournal();
          break;
        case 'link-journal':
          setJournalSearchQuery('');
          setSearchedJournals([]);
          setShowJournalLinkModal(true);
          searchJournals('');
          break;
        case 'video-library':
          toast.info('Video Library - Browse your saved educational videos', { duration: 3000 });
          // For now, just show a message. Full implementation would need a video library system
          break;
        case 'image':
          imageInputRef.current?.click();
          break;
        case 'audio':
          audioInputRef.current?.click();
          break;
        case 'video':
          videoInputRef.current?.click();
          break;
        case 'youtube':
          setYoutubeUrl('');
          setShowYoutubeModal(true);
          break;
        case 'pdf':
          pdfInputRef.current?.click();
          break;
        default:
          toast.info('This feature is coming soon!');
      }
    }
  };

  // Handle whiteboard insertion - adds an inline whiteboard
  const handleWhiteboardInsert = async () => {
    const whiteboardId = `wb-${Date.now()}`;

    // Add to embedded whiteboards
    setEmbeddedWhiteboards(prev => [...prev, { id: whiteboardId }]);

    // Add a placeholder in the content
    const whiteboardPlaceholder = `\n\n[WHITEBOARD:${whiteboardId}]\n`;
    const newContent = content ? content + whiteboardPlaceholder : whiteboardPlaceholder;
    setContent(newContent);
    toast.success('Whiteboard added!');
  };

  // Handle Desmos insertion - adds an inline Desmos graph directly
  const handleDesmosInsert = () => {
    const desmosId = `desmos-${Date.now()}`;

    // Add a placeholder in the content (no need for separate state - rendered from content)
    const desmosPlaceholder = `[DESMOS:${desmosId}:]`;

    // Check if this exact placeholder already exists (prevent duplicates)
    if (content.includes(desmosPlaceholder)) {
      return;
    }

    const newContent = content ? content + `\n\n${desmosPlaceholder}\n` : `${desmosPlaceholder}\n`;
    setContent(newContent);
    toast.success('Graph added! Type equations directly in the calculator.');
  };

  // Handle subjournal creation
  const handleCreateSubjournal = async () => {
    if (!user || !journal) return;

    const toastId = toast.loading('Creating subjournal...');
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
      toast.success('Subjournal created!', { id: toastId });
    } catch (error) {
      console.error('Failed to create subjournal:', error);
      toast.error('Failed to create subjournal', { id: toastId });
    }
  };

  // Search journals for linking
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

      if (query.trim()) {
        queryBuilder = queryBuilder.ilike('title', `%${query}%`);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      setSearchedJournals(data || []);
    } catch (error) {
      console.error('Failed to search journals:', error);
    }
  };

  // Handle journal link insertion
  const handleJournalLink = (linkedJournal: JournalData) => {
    const journalLink = `\n\nhttps://agathon.app/journal/${linkedJournal.id}\n`;
    const newContent = content ? content + journalLink : journalLink;
    setContent(newContent);
    setShowJournalLinkModal(false);
    toast.success('Journal linked!');
  };

  // Handle YouTube embed
  const handleYoutubeEmbed = () => {
    if (!youtubeUrl.trim()) return;

    // Extract video ID from various YouTube URL formats
    const videoIdMatch = youtubeUrl.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );

    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1];
      // Embed as an iframe for inline playback
      const embedCode = `\n\n<div class="youtube-embed" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:12px;margin:16px 0;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:12px;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n`;
      const newContent = content ? content + embedCode : embedCode;
      setContent(newContent);
      setShowYoutubeModal(false);
      setYoutubeUrl('');
      toast.success('YouTube video embedded!');
    } else {
      toast.error('Invalid YouTube URL');
    }
  };

  // Handle Desmos graph embed
  const handleDesmosEmbed = () => {
    if (!desmosExpression.trim()) return;

    const desmosId = `desmos-${Date.now()}`;
    const desmosPlaceholder = `[DESMOS:${desmosId}:${desmosExpression}]`;

    // Check if this exact placeholder already exists (prevent duplicates)
    if (content.includes(desmosPlaceholder)) {
      return;
    }

    const newContent = content ? content + `\n\n${desmosPlaceholder}\n` : `${desmosPlaceholder}\n`;
    setContent(newContent);
    setShowDesmosModal(false);
    setDesmosExpression('');
    toast.success('Desmos graph added!');
  };

  // Handle chart creation
  const handleChartCreate = () => {
    if (!chartData.trim()) return;

    // Parse simple CSV-like data: "Label1,Value1;Label2,Value2"
    const chartEmoji = chartType === 'bar' ? '📊' : chartType === 'line' ? '📈' : '🥧';
    const chartBlock = `\n\n${chartEmoji} **${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart**\n\n\`\`\`chart\ntype: ${chartType}\ndata: ${chartData}\n\`\`\`\n`;
    const newContent = content ? content + chartBlock : chartBlock;
    setContent(newContent);
    setShowChartModal(false);
    setChartData('');
    toast.success('Chart added!');
  };

  // Handle file upload (converts to base64 and embeds)
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, fileType: 'image' | 'audio' | 'video' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB for images, 10MB for others)
    const maxSize = fileType === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${fileType === 'image' ? '5MB' : '10MB'}`);
      return;
    }

    const toastId = toast.loading(`Uploading ${fileType}...`);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        let embedCode = '';

        switch (fileType) {
          case 'image':
            embedCode = `\n\n![${file.name}](${base64})\n`;
            break;
          case 'audio':
            embedCode = `\n\n🎵 **Audio: ${file.name}**\n<audio controls src="${base64}"></audio>\n`;
            break;
          case 'video':
            embedCode = `\n\n🎬 **Video: ${file.name}**\n<video controls width="100%" src="${base64}"></video>\n`;
            break;
          case 'pdf':
            embedCode = `\n\n📄 **PDF: ${file.name}**\n[View PDF](${base64})\n`;
            break;
        }

        const newContent = content ? content + embedCode : embedCode;
        setContent(newContent);
        toast.success(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded!`, { id: toastId });
      };
      reader.onerror = () => {
        toast.error(`Failed to upload ${fileType}`, { id: toastId });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(`Failed to upload ${fileType}:`, error);
      toast.error(`Failed to upload ${fileType}`, { id: toastId });
    }

    // Reset the input
    e.target.value = '';
  };

  // Check if user is asking for flashcards
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

  // Handle chat message - send to AI and show in chat panel
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput.trim();
    const isNotes = isNotesRequest(userMessage);
    const isFlashcards = isFlashcardRequest(userMessage);
    setChatInput('');
    setIsChatting(true);

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // If it's a flashcard request, use the flashcard flow
    if (isFlashcards) {
      // Extract topic from the message (remove "flashcard" related words)
      const topic = userMessage
        .replace(/\b(create|make|generate|give me|need|flashcards?|study with|on|about|for)\b/gi, '')
        .trim() || content?.slice(0, 200) || 'the topic';

      setFlashcardTopic(topic);
      setIsGeneratingFlashcards(true);
      setFlashcards([]);
      setCurrentFlashcardIndex(0);
      setIsFlashcardFlipped(false);
      setSearchExpanded(false); // Close chat to show flashcards

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

        // Add confirmation to chat
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `I've created ${parsedFlashcards.length} flashcards for you! You can see them below.`
        }]);
      } catch (error) {
        console.error('Flashcard generation error:', error);
        toast.error('Failed to generate flashcards');
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

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      if (isNotes) {
        // For notes requests, parse into blocks and show diff-style UI in document
        const blocks = parseContentIntoBlocks(data.content);
        setPendingBlocks(blocks);
        // Add a simple confirmation to chat
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `I've generated ${blocks.length} section${blocks.length > 1 ? 's' : ''} of notes. You can review and accept/deny each section in the document below.`
        }]);
        // Close the chat panel to show the pending blocks
        setSearchExpanded(false);
      } else {
        // For regular chat, just add response to chat panel
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);

        // Check if the response looks like generated notes/content that could be added
        const looksLikeNotes = data.content.includes('#') || data.content.length > 200;
        if (looksLikeNotes) {
          setPendingContent(data.content);
          setPendingMessageIndex(chatMessages.length + 1); // Index of the new assistant message
        }
      }

      // Scroll to bottom of chat
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

  // Accept pending content and add to document
  const handleAcceptContent = () => {
    if (!pendingContent || pendingMessageIndex === null) return;
    const newContent = content ? content + '\n\n' + pendingContent : pendingContent;
    setContent(newContent);
    // Mark the message as written
    setChatMessages(prev => prev.map((msg, idx) =>
      idx === pendingMessageIndex ? { ...msg, written: true } : msg
    ));
    setPendingContent(null);
    setPendingMessageIndex(null);
    toast.success('Content added to journal!');
  };

  // Reapply content (re-add content from a written message)
  const handleReapplyContent = (messageContent: string, messageIndex: number) => {
    const newContent = content ? content + '\n\n' + messageContent : messageContent;
    setContent(newContent);
    toast.success('Content reapplied to journal!');
  };

  // Copy message content to clipboard
  const handleCopyMessage = async (messageContent: string) => {
    try {
      await navigator.clipboard.writeText(messageContent);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // Dismiss pending content
  const handleDismissContent = () => {
    setPendingContent(null);
    setPendingMessageIndex(null);
  };

  // Clear chat
  const handleClearChat = () => {
    setChatMessages([]);
    setPendingContent(null);
    setPendingMessageIndex(null);
  };

  // Accept a single pending block
  const handleAcceptBlock = (blockId: string) => {
    const block = pendingBlocks.find(b => b.id === blockId);
    if (!block) return;

    // Add block content to document
    const newContent = content ? content + '\n\n' + block.content : block.content;
    setContent(newContent);

    // Remove the block from pending
    setPendingBlocks(prev => prev.filter(b => b.id !== blockId));
    toast.success('Section added!');
  };

  // Deny a single pending block
  const handleDenyBlock = (blockId: string) => {
    // Remove the block from pending
    setPendingBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  // Accept all pending blocks
  const handleAcceptAllBlocks = () => {
    const pendingOnly = pendingBlocks.filter(b => b.status === 'pending');
    if (pendingOnly.length === 0) return;

    // Add all pending content to document
    const combinedContent = pendingOnly.map(b => b.content).join('\n\n');
    const newContent = content ? content + '\n\n' + combinedContent : combinedContent;
    setContent(newContent);

    // Clear all pending blocks to remove the UI
    setPendingBlocks([]);
    toast.success('All sections added!');
  };

  // Deny all pending blocks
  const handleDenyAllBlocks = () => {
    // Clear all pending blocks to remove the UI
    setPendingBlocks([]);
  };

  // Clear pending blocks (dismiss the diff UI)
  const handleClearPendingBlocks = () => {
    setPendingBlocks([]);
  };

  // Close slash menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSlashMenu(false);
    if (showSlashMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSlashMenu]);

  // Ref for the chat bar container
  const chatBarRef = useRef<HTMLDivElement>(null);

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatBarRef.current && !chatBarRef.current.contains(event.target as Node)) {
        setSearchExpanded(false);
      }
    };

    if (searchExpanded) {
      // Use setTimeout to avoid immediate close on the same click that opens it
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [searchExpanded]);

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
    <div className="min-h-screen bg-background flex">
      <JournalSidebar
        activeJournalId={params.id as string}
        onCollapseChange={setSidebarCollapsed}
      />
      <div className={cn(
        "flex-1 transition-all duration-300 ease-out min-h-screen",
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
                  if (e.key === 'Enter' && topicInput.trim()) {
                    handleTopicSubmit();
                  }
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

      {/* Header controls */}
      <header className="flex items-center justify-between px-5 py-3 relative z-[60] border-b border-border">
        {/* Left - Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/journal')}
            className="p-2 hover:bg-muted transition-colors text-foreground"
            title="Back to journals"
          >
            <CaretLeft weight="bold" className="h-5 w-5" />
          </button>
        </div>

        {/* Center - Chat/Command bar */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
          <div className="relative" ref={chatBarRef}>
            {/* Main chat bar */}
            <div className="flex flex-col">
              <div
                onClick={() => {
                  if (!searchExpanded) {
                    setSearchExpanded(true);
                  }
                }}
                className={cn(
                  'flex items-center gap-3 bg-foreground/10 border border-border px-3 py-2 cursor-pointer',
                  'transition-all duration-300 ease-out',
                  searchExpanded
                    ? 'min-w-[600px] bg-card shadow-lg border-b-0'
                    : 'min-w-[420px] hover:bg-foreground/15'
                )}
              >
                {searchExpanded ? (
                  <>
                    {isChatting ? (
                      <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 bg-foreground/10 flex items-center justify-center flex-shrink-0">
                        <Plus weight="bold" className="h-4 w-4 text-foreground" />
                      </div>
                    )}
                    <input
                      ref={commandInputRef}
                      type="text"
                      autoFocus
                      value={showSlashMenu ? commandInput : chatInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith('/')) {
                          setCommandInput(value);
                          setChatInput('');
                          setSlashFilter(value.slice(1));
                          setShowSlashMenu(true);
                          setSelectedCommandIndex(0);
                        } else {
                          setChatInput(value);
                          setCommandInput('');
                          setShowSlashMenu(false);
                          setSlashFilter('');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (showSlashMenu) {
                          handleCommandKeyDown(e);
                        } else if (e.key === 'Enter' && chatInput.trim() && !isChatting) {
                          e.preventDefault();
                          handleChatSubmit();
                        } else if (e.key === 'Escape') {
                          setSearchExpanded(false);
                          setChatInput('');
                          setCommandInput('');
                          setChatMessages([]);
                          setPendingContent(null);
                        }
                      }}
                      placeholder='Ask anything or type "/" for commands...'
                      className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground focus:ring-0"
                      disabled={isChatting}
                    />
                    {chatInput.trim() && !showSlashMenu && (
                      <button
                        onClick={handleChatSubmit}
                        disabled={isChatting}
                        className="w-7 h-7 bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors disabled:opacity-50"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    )}
                    {chatMessages.length > 0 && !chatInput.trim() && (
                      <button
                        onClick={() => {
                          setSearchExpanded(false);
                          setChatInput('');
                          setCommandInput('');
                          setChatMessages([]);
                          setPendingContent(null);
                        }}
                        className="p-1.5 hover:bg-foreground/10 transition-colors"
                      >
                        <X className="h-4 w-4 text-foreground" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 bg-foreground/10 flex items-center justify-center flex-shrink-0">
                      <Sparkle weight="duotone" className="h-4 w-4 text-foreground" />
                    </div>
                    <span className="flex-1 text-muted-foreground text-sm transition-opacity duration-500">
                      {placeholderTexts[placeholderIndex]}
                    </span>
                    <div className="w-7 h-7 bg-foreground text-background flex items-center justify-center flex-shrink-0">
                      <ArrowUp className="h-4 w-4" />
                    </div>
                  </>
                )}
              </div>
              {/* Chat label below the bar */}
              {!searchExpanded && (
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <span className="text-muted-foreground text-xs font-medium">Chat with Agathon</span>
                </div>
              )}
            </div>

            {/* Chat conversation panel */}
            {searchExpanded && !showSlashMenu && (
              <div className="absolute top-full left-0 right-0 bg-card border border-t-0 border-border shadow-xl overflow-hidden z-[100]">
                {/* Chat messages */}
                <div
                  ref={chatContainerRef}
                  className="max-h-[350px] overflow-y-auto px-4 py-3 space-y-3"
                >
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 bg-foreground/10 flex items-center justify-center mx-auto mb-3">
                        <Sparkle weight="duotone" className="h-5 w-5 text-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">No messages yet</p>
                      <p className="text-xs text-muted-foreground/60">Ask a question or type &quot;/&quot; for commands</p>
                    </div>
                  ) : null}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx}>
                      {msg.role === 'user' ? (
                        <div className="flex justify-end mb-2">
                          <div className="bg-muted text-foreground px-4 py-1.5 text-sm border border-border">
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
                              {/* Action buttons for assistant messages */}
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
                                      Reapply changes
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
                  ))}
                  {isChatting && (
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 bg-foreground flex items-center justify-center flex-shrink-0">
                        <div className="h-3 w-3 border border-background/30 border-t-background animate-spin" />
                      </div>
                      <div className="text-[13px] text-muted-foreground">
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear chat button at the bottom */}
                <div className="border-t border-border px-4 py-2 flex justify-end bg-muted/50">
                  <button
                    onClick={handleClearChat}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
                  >
                    <X className="h-3 w-3" />
                    Clear chat
                  </button>
                </div>
              </div>
            )}

            {/* Slash Command Menu */}
            {showSlashMenu && searchExpanded && (
              <div className="absolute top-full left-0 right-0 z-[100] bg-card border border-t-0 border-border shadow-2xl py-2 max-h-[420px] overflow-y-auto">
                {slashCommands.map((category, catIndex) => {
                  const filteredItems = category.items.filter(item =>
                    item.label.toLowerCase().includes(slashFilter.toLowerCase())
                  );

                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={category.category} className={catIndex > 0 ? 'mt-1' : ''}>
                      <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {category.category}
                      </div>
                      {filteredItems.map((item) => {
                        const globalIndex = allCommands.findIndex(c => c.id === item.id);
                        const isSelected = globalIndex === selectedCommandIndex;
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            onClick={() => executeCommand(item.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                              isSelected ? 'bg-accent text-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span className={cn(
                              'text-sm',
                              isSelected && 'font-medium'
                            )}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-0.5">
          {/* Proactive AI Lightbulb Button with Dropdown */}
          <div className="relative" ref={proactiveDropdownRef}>
            <button
              className={cn(
                "p-2 transition-colors",
                proactiveAIEnabled
                  ? "bg-accent text-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={() => setShowProactiveDropdown(!showProactiveDropdown)}
            >
              <Lightbulb weight="duotone" className="h-5 w-5" />
              {isGeneratingSuggestion && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-foreground animate-pulse" />
              )}
            </button>
            {showProactiveDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border shadow-lg p-4 z-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb weight="duotone" className="h-4 w-4 text-foreground" />
                    <span className="font-medium text-foreground text-sm">Proactive AI Mode</span>
                  </div>
                  <Switch
                    checked={proactiveAIEnabled}
                    onChange={setProactiveAIEnabled}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors",
                      proactiveAIEnabled ? "bg-[#1A6B8A]" : "bg-[#B8A898]"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4 h-4 bg-[#F7F0E3] rounded-full shadow transition-transform",
                        proactiveAIEnabled ? "translate-x-0" : "translate-x-5"
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
            onClick={() => toast.info('Timer feature coming soon!')}
          >
            <Timer weight="duotone" className="h-5 w-5" />
          </button>
          <button
            className="p-2 hover:bg-muted transition-colors text-muted-foreground"
            onClick={() => toast.info('More options coming soon!')}
          >
            <DotsThree weight="duotone" className="h-5 w-5" />
          </button>
          <button
            onClick={() => toast.info('Sharing is coming soon!')}
            className="ml-2 bg-foreground hover:bg-foreground/90 text-background text-xs font-medium px-4 py-2 transition-colors"
          >
            Share
          </button>
        </div>
      </header>

      {/* Main Content Area */}
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
        {/* Start with section - only show when empty */}
        {isEmpty && !activeInlineInput && !isGeneratingFlashcards && flashcards.length === 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Start with</p>
            <div className="grid grid-cols-3 gap-px bg-border border border-border">
              <button
                onClick={() => handleQuickAction('Agathon Method')}
                disabled={isGenerating}
                className="bg-card hover:bg-accent p-4 text-left transition-colors disabled:opacity-50 group"
              >
                <Sparkle weight="duotone" className="h-5 w-5 text-muted-foreground group-hover:text-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Ask Agathon</p>
                <p className="text-xs text-muted-foreground mt-0.5">Generate study notes</p>
              </button>
              <button
                onClick={() => handleOpenInlineInput('Flashcards')}
                disabled={isGenerating}
                className="bg-card hover:bg-accent p-4 text-left transition-colors disabled:opacity-50 group"
              >
                <Stack weight="duotone" className="h-5 w-5 text-muted-foreground group-hover:text-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Flashcards</p>
                <p className="text-xs text-muted-foreground mt-0.5">Study with spaced repetition</p>
              </button>
              <button
                onClick={() => handleOpenInlineInput('Practice Problems')}
                disabled={isGenerating}
                className="bg-card hover:bg-accent p-4 text-left transition-colors disabled:opacity-50 group"
              >
                <ClipboardText weight="duotone" className="h-5 w-5 text-muted-foreground group-hover:text-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Practice</p>
                <p className="text-xs text-muted-foreground mt-0.5">Generate practice problems</p>
              </button>
            </div>
          </div>
        )}

        {/* Inline Input for Practice Problems / Flashcards */}
        {activeInlineInput && !isGeneratingFlashcards && flashcards.length === 0 && (
          <div className="mb-8 space-y-4">
            {/* Tabs for quick action selection */}
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

            {/* Inline input */}
            <div className="flex items-center gap-2 bg-muted px-4 py-3 border border-border">
              <input
                ref={inlineInputRef}
                type="text"
                value={inlineInputValue}
                onChange={(e) => setInlineInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inlineInputValue.trim()) {
                    handleInlineInputSubmit();
                  } else if (e.key === 'Escape') {
                    setActiveInlineInput(null);
                    setInlineInputValue('');
                  }
                }}
                placeholder={activeInlineInput === 'Practice Problems' ? 'What topic for practice problems?' : 'What topic for flashcards?'}
                className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground focus:ring-0"
                disabled={isGenerating}
              />
              {/* Count selector */}
              {(activeInlineInput === 'Practice Problems' || activeInlineInput === 'Flashcards') && (
                <div className="flex items-center gap-1 bg-card px-2 py-1 border border-border">
                  <select
                    value={activeInlineInput === 'Flashcards' ? flashcardCount : practiceCount}
                    onChange={(e) => {
                      if (activeInlineInput === 'Flashcards') {
                        setFlashcardCount(Number(e.target.value));
                      } else {
                        setPracticeCount(Number(e.target.value));
                      }
                    }}
                    className="bg-transparent border-none outline-none text-sm text-foreground focus:ring-0 pr-1"
                  >
                    {[5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
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

            {/* Flashcard */}
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

            {/* Flashcard Controls */}
            <div className="flex items-center justify-center gap-px bg-border border border-border w-fit mx-auto">
              <button
                onClick={handleShuffleFlashcards}
                className="p-2.5 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Shuffle"
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                onClick={handlePrevFlashcard}
                className="p-2.5 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Previous"
              >
                <CaretLeft weight="bold" className="h-4 w-4" />
              </button>
              <span className="px-4 py-2.5 bg-card text-sm text-foreground font-medium tabular-nums min-w-[80px] text-center">
                {currentFlashcardIndex + 1} / {flashcards.length}
              </span>
              <button
                onClick={handleNextFlashcard}
                className="p-2.5 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Next"
              >
                <CaretRight weight="bold" className="h-4 w-4" />
              </button>
              <button
                onClick={handleDeleteFlashcards}
                className="p-2.5 bg-card text-red-600 dark:text-red-400 hover:bg-muted transition-colors"
                title="Delete flashcards"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Pending Blocks - Diff-style Accept/Deny UI */}
        {pendingBlocks.length > 0 && (
          <div className="mb-8 space-y-2">
            {/* Header with Accept All / Deny All */}
            <div className="flex items-center justify-between bg-muted px-4 py-3 border border-border">
              <div className="flex items-center gap-2">
                <Sparkle weight="duotone" className="h-4 w-4 text-foreground" />
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

            {/* Individual blocks */}
            {pendingBlocks.map((block) => (
              <div
                key={block.id}
                className={cn(
                  'relative border overflow-hidden transition-all duration-300',
                  block.status === 'pending'
                    ? 'bg-card border-border'
                    : block.status === 'accepted'
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 opacity-60'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 opacity-40 line-through'
                )}
              >
                {/* Left accent bar */}
                <div
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-1',
                    block.status === 'pending'
                      ? 'bg-foreground'
                      : block.status === 'accepted'
                      ? 'bg-green-600'
                      : 'bg-red-600'
                  )}
                />

                <div className="pl-4 pr-3 py-3">
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
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

                    {/* Content preview */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-sm leading-relaxed',
                          block.status === 'denied' ? 'text-muted-foreground' : 'text-foreground/80'
                        )}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content.slice(0, 300) + (block.content.length > 300 ? '...' : '')) }}
                      />
                    </div>

                    {/* Accept/Deny buttons */}
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

                    {block.status === 'accepted' && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">Added</span>
                    )}
                    {block.status === 'denied' && (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium flex-shrink-0">Removed</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WYSIWYG Rich Text Editor with Embedded Components */}
        <div className="relative min-h-[60vh] pb-20">
          <ContentWithEmbeds
            content={content}
            onChange={setContent}
            placeholder="Start writing or click a button above to generate notes... Type '/' for commands."
            embeddedWhiteboards={embeddedWhiteboards}
            embeddedDesmos={embeddedDesmos}
            onWhiteboardSave={(id, data) => {
              setEmbeddedWhiteboards(prev =>
                prev.map(wb => wb.id === id ? { ...wb, data } : wb)
              );
            }}
            onDeleteWhiteboard={(id) => {
              // Remove from embedded whiteboards
              setEmbeddedWhiteboards(prev => prev.filter(wb => wb.id !== id));
              // Remove placeholder from content
              setContent(prev => prev.replace(new RegExp(`\\n*\\[WHITEBOARD:${id}\\]\\n*`, 'g'), '\n'));
              toast.success('Whiteboard deleted');
            }}
            onDeleteDesmos={(id) => {
              // Remove placeholder from content
              setContent(prev => prev.replace(new RegExp(`\\n*\\[DESMOS:${id}:[^\\]]*\\]\\n*`, 'g'), '\n'));
              toast.success('Graph deleted');
            }}
            onSlashCommand={executeCommand}
          />

          {/* Proactive AI Suggestion Display */}
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

      {/* Footer */}
      <footer className="fixed bottom-0 right-0 px-6 py-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {isSaving ? (
            'Saving...'
          ) : lastSaved ? (
            `Last saved ${formatDistance(lastSaved, new Date(), { addSuffix: true })}`
          ) : (
            ''
          )}
        </span>
      </footer>

      {/* YouTube Embed Modal */}
      <Dialog open={showYoutubeModal} onClose={() => setShowYoutubeModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <YoutubeLogo weight="duotone" className="h-5 w-5 text-muted-foreground" />
                  Embed YouTube Video
                </DialogTitle>
                <button onClick={() => setShowYoutubeModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Paste a YouTube video URL to embed it in your journal.
              </p>
              <input
                type="text"
                autoFocus
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && youtubeUrl.trim()) handleYoutubeEmbed();
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
              />
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowYoutubeModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleYoutubeEmbed} disabled={!youtubeUrl.trim()} className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Embed
              </button>
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
              <button onClick={() => setShowJournalLinkModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
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
              <p className="text-sm text-muted-foreground mb-4">
                Enter a math expression to graph (e.g., y=x^2, sin(x), etc.)
              </p>
              <input
                type="text"
                autoFocus
                value={desmosExpression}
                onChange={(e) => setDesmosExpression(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && desmosExpression.trim()) handleDesmosEmbed();
                }}
                placeholder="y = x^2"
                className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all font-mono"
              />
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowDesmosModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleDesmosEmbed} disabled={!desmosExpression.trim()} className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Add Graph
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Chart Modal */}
      <Dialog open={showChartModal} onClose={() => setShowChartModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <ChartBar className="h-5 w-5 text-muted-foreground" />
                  Create Chart
                </DialogTitle>
                <button
                  onClick={() => setShowChartModal(false)}
                  className="p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground/80 mb-2 block">Chart Type</label>
                  <RadioGroup value={chartType} onChange={setChartType} className="flex gap-2">
                    {(['bar', 'line', 'pie'] as const).map((type) => (
                      <Radio
                        key={type}
                        value={type}
                        className={cn(
                          'flex-1 px-3 py-2 text-sm font-medium transition-colors cursor-pointer text-center',
                          'data-[checked]:bg-foreground data-[checked]:text-background',
                          'bg-muted text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {type === 'bar' ? 'Bar' : type === 'line' ? 'Line' : 'Pie'}
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground/80 mb-2 block">Data</label>
                  <textarea
                    value={chartData}
                    onChange={(e) => setChartData(e.target.value)}
                    placeholder="Label1,10;Label2,20;Label3,30"
                    rows={3}
                    className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Format: Label,Value separated by semicolons</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button
                onClick={() => setShowChartModal(false)}
                className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChartCreate}
                disabled={!chartData.trim()}
                className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Chart
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'image')}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'audio')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'video')}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'pdf')}
      />
      </div>
    </div>
  );
}
