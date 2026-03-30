'use client';
// TODO: M23 — Wrap RichTextEditor in <ComponentErrorBoundary>

import { useEffect, useState, useCallback, useRef, useMemo, KeyboardEvent, ChangeEvent } from 'react';
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
  ShareNetwork,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import {
  Dialog, DialogPanel, DialogTitle, DialogBackdrop,
  Switch,
  TabGroup, TabList, Tab, TabPanels, TabPanel,
} from '@headlessui/react';
import { DesignUpgradeBanner } from '@/components/ui/design-upgrade-banner';
import { debounce } from 'lodash';
import { formatDistance } from 'date-fns';
import { sileo } from 'sileo';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/journal/RichTextEditor';
import { JournalSidebar } from '@/components/journal/JournalSidebar';
import { JournalRightPanel, type RightPanelTab } from '@/components/journal/JournalRightPanel';
import { decodeChartData, encodeChartData, DEFAULT_CHART_DATA, type ChartConfig } from '@/components/journal/InlineChart';
import { decodeDatabaseData, encodeDatabaseData, DEFAULT_DATABASE_CONFIG, type DatabaseConfig } from '@/components/journal/InlineDatabase';
import { ShareDialog } from '@/components/ui/share-dialog';
import { DocPropertiesPanel, type DocProperties } from '@/components/ui/doc-properties-panel';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Render LaTeX expressions within text (both block $$ and inline $)
function renderLatex(text: string): string {
  // First handle block math $$...$$
  let result = text.replace(/\$\$([^$]+?)\$\$/g, (_match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return _match;
    }
  });

  // Then handle inline math $...$
  result = result.replace(/\$([^$\n]+?)\$/g, (_match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return _match;
    }
  });

  return result;
}

// Simple markdown renderer for chat messages with DOMPurify sanitization and LaTeX support
function renderMarkdown(text: string): string {
  // Render LaTeX before HTML escaping (KaTeX output is safe HTML)
  let html = renderLatex(text);

  // Escape HTML but preserve KaTeX output (which uses <span> tags)
  // We split on KaTeX spans, escape non-KaTeX parts, and rejoin
  const katexParts = html.split(new RegExp('(<span class="katex.*?<\\/span>)', 's'));
  html = katexParts.map((part, i) => {
    // Odd indices are KaTeX HTML — leave them as-is
    if (i % 2 === 1) return part;
    // Even indices are regular text — escape HTML
    return part
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }).join('');

  html = html
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

  // Sanitize output to prevent XSS — allow KaTeX tags
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['span', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext', 'annotation', 'mover', 'munder', 'mtable', 'mtr', 'mtd', 'mspace', 'mpadded', 'menclose', 'svg', 'line', 'path'],
    ADD_ATTR: ['class', 'style', 'aria-hidden', 'encoding', 'xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width', 'd', 'fill'],
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'li', 'ul', 'ol', 'span', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt', 'mtext', 'annotation', 'mover', 'munder', 'mtable', 'mtr', 'mtd', 'mspace', 'mpadded', 'menclose', 'svg', 'line', 'path'],
    ALLOWED_ATTR: ['class', 'style', 'aria-hidden', 'encoding', 'xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width', 'd', 'fill'],
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

const InlineChart = dynamic(
  () => import('@/components/journal/InlineChart').then(mod => mod.InlineChart),
 { ssr: false, loading: () => <div className="h-[400px] bg-muted animate-pulse" /> }
);

const InlineDatabase = dynamic(
  () => import('@/components/journal/InlineDatabase').then(mod => mod.InlineDatabase),
  { ssr: false, loading: () => <div className="h-[200px] bg-muted animate-pulse rounded-2xl" /> }
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

// ── Bookmark Card ─────────────────────────────────────────────────────────────
function BookmarkCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<{ title: string; description: string; image: string; favicon: string; hostname: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/journal/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(r => r.json())
      .then(data => { if (data.title) setMeta(data); else setError(true); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground animate-pulse my-2 no-underline"
      >
        <div className="h-4 w-4 rounded bg-muted" />
        <span className="truncate">{url}</span>
      </a>
    );
  }

  if (error || !meta) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 text-sm text-blue-600 hover:underline my-2"
      >
        <ArrowSquareOut className="h-4 w-4 shrink-0" />
        <span className="truncate">{url}</span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex gap-3 p-3 rounded-xl border border-border bg-white hover:shadow-md transition-shadow my-3 no-underline group"
      style={{ boxShadow: 'var(--affine-shadow-card)' }}
    >
      {meta.image && (
        <img src={meta.image} alt="" className="h-16 w-24 object-cover rounded-lg shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <img src={meta.favicon} alt="" className="h-4 w-4 rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-xs text-muted-foreground truncate">{meta.hostname}</span>
        </div>
        <p className="font-medium text-sm text-foreground truncate leading-snug">{meta.title}</p>
        {meta.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meta.description}</p>}
      </div>
      <ArrowSquareOut className="h-4 w-4 text-muted-foreground shrink-0 self-start mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
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
  onChartSave,
  onDeleteChart,
  onDatabaseSave,
  onDeleteDatabase,
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
  onDatabaseSave?: (id: string, data: DatabaseConfig) => void;
  onDeleteDatabase?: (id: string) => void;
}) {
  // Extract placeholders from content for rendering embedded components
  const whiteboardMatches = [...content.matchAll(/\[WHITEBOARD:([^\]]+)\]/g)];
  const desmosMatches = [...content.matchAll(/\[DESMOS:([^:\]]+):([^\]]*)\]/g)];
  const chartMatches = [...content.matchAll(/\[CHART:([^:\]]+):([^\]]*)\]/g)];
  const databaseMatches = [...content.matchAll(/\[DATABASE:([^:\]]+):([^\]]*)\]/g)];
  const bookmarkMatches = [...content.matchAll(/\[BOOKMARK:([^\]]+)\]/g)];

  // Build a unified, position-ordered list of all embeds
  const allEmbeds: { type: 'whiteboard' | 'desmos' | 'chart' | 'database' | 'bookmark'; match: RegExpExecArray | RegExpMatchArray; position: number }[] = [];
  whiteboardMatches.forEach(m => allEmbeds.push({ type: 'whiteboard', match: m, position: m.index ?? 0 }));
  desmosMatches.forEach(m => allEmbeds.push({ type: 'desmos', match: m, position: m.index ?? 0 }));
  chartMatches.forEach(m => allEmbeds.push({ type: 'chart', match: m, position: m.index ?? 0 }));
  databaseMatches.forEach(m => allEmbeds.push({ type: 'database', match: m, position: m.index ?? 0 }));
  bookmarkMatches.forEach(m => allEmbeds.push({ type: 'bookmark', match: m, position: m.index ?? 0 }));
  allEmbeds.sort((a, b) => a.position - b.position);

  // Remove placeholders from the content for the editor (they'll be rendered separately)
  const editorContent = content
    .replace(/\n*\[WHITEBOARD:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[DESMOS:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[CHART:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[DATABASE:[^\]]+\]\n*/g, '\n')
    .replace(/\n*\[BOOKMARK:[^\]]+\]\n*/g, '\n')
    .trim();

  // Check if there are any embeds — shrink editor min-height when embeds exist
  const hasEmbeds = allEmbeds.length > 0;

  return (
 <div className={hasEmbeds ? 'space-y-4' : 'space-y-6'}>
      {/* Main editor for text content */}
      <RichTextEditor
        content={editorContent}
        onChange={(newContent) => {
          // Preserve the embedded placeholders when content changes
          let fullContent = newContent;

          // Re-add all embed placeholders at the end (in original order)
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

      {/* Render all embeds in content order */}
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

        if (type === 'database') {
          const id = match[1];
          const encodedData = match[2];
          const dbConfig = decodeDatabaseData(encodedData);
          return (
            <div key={`database-${id}`} className="my-2">
              <InlineDatabase
                id={id}
                initialData={dbConfig}
                onSave={(dbId, data) => onDatabaseSave?.(dbId, data)}
                onDelete={(dbId) => onDeleteDatabase?.(dbId)}
              />
            </div>
          );
        }

        if (type === 'bookmark') {
          const bookmarkUrl = match[1];
          return (
            <div key={`bookmark-${bookmarkUrl}`} className="my-2">
              <BookmarkCard url={bookmarkUrl} />
            </div>
          );
        }

        // chart
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
      { id: 'database', icon: Table, label: 'Database', color: 'text-muted-foreground' },
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
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('ai');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [linkedWhiteboardId, setLinkedWhiteboardId] = useState<string | undefined>();
  const [docProperties, setDocProperties] = useState<DocProperties>({});

  // Find in page state
  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const findMatches = useMemo(() => {
    if (!findQuery.trim() || !content) return [];
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) matches.push(m.index);
    return matches;
  }, [findQuery, content]);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+F → open find bar
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && findOpen) {
        setFindOpen(false);
        setFindQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [findOpen]);

  // Sync properties from journal data when loaded
  const handlePropertiesChange = useCallback((updated: Partial<DocProperties>) => {
    setDocProperties((prev) => ({ ...prev, ...updated }));
  }, []);

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
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [translateLang, setTranslateLang] = useState('Spanish');
  const [showToneModal, setShowToneModal] = useState(false);
  const [toneChoice, setToneChoice] = useState('Friendly');
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkUrlInput, setBookmarkUrlInput] = useState('');
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
  const transcribeAudioRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; written?: boolean }>>([]);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [pendingMessageIndex, setPendingMessageIndex] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const hasAutoTitled = useRef(false);
  const journalRef = useRef<typeof journal>(null);

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [embeddedDatabases, setEmbeddedDatabases] = useState<{ id: string }[]>([]);

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
        sileo.error({ title: 'Failed to load journal' });
        router.push('/journal');
        return;
      }

      setJournal(data);
      journalRef.current = data;
      setTitle(data.title);

      // Load linked whiteboard — check metadata first, then search whiteboards that link back
      if (data.metadata?.linked_whiteboard_id) {
        setLinkedWhiteboardId(data.metadata.linked_whiteboard_id);
      } else {
        // Legacy: find a whiteboard whose metadata.linked_journal_id points to this journal
        const { data: boards } = await supabase
          .from('whiteboards')
          .select('id, metadata')
          .eq('user_id', user.id);
        const match = boards?.find((b: any) => b.metadata?.linked_journal_id === params.id);
        if (match) {
          setLinkedWhiteboardId(match.id);
          // Back-fill so future loads are instant
          await supabase
            .from('journals')
            .update({ metadata: { ...(data.metadata ?? {}), linked_whiteboard_id: match.id } })
            .eq('id', params.id);
        }
      }

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

  // Auto-save with debounce — stable ref pattern so debounce is never recreated
  const saveJournal = useRef(
    debounce(async (newTitle: string, newContent: string, journalId: string) => {
      setIsSaving(true);
      const { error } = await supabase
        .from('journals')
        .update({
          title: newTitle,
          content: [{ type: 'text', content: newContent }],
          updated_at: new Date().toISOString(),
        })
        .eq('id', journalId);
      if (error) {
        console.error('Failed to save journal:', error);
      } else {
        setLastSaved(new Date());
      }
      setIsSaving(false);
    }, 1000)
  ).current;

  // Save on changes — only re-runs when title/content change, not on journal object identity change
  useEffect(() => {
    const id = journalRef.current?.id;
    if (id && !loading) {
      saveJournal(title, content, id);
    }
  }, [title, content, loading, saveJournal]);

  // Auto-generate title from content when title is still default
  useEffect(() => {
    if (hasAutoTitled.current) return;
    if (title !== 'New Journal') {
      hasAutoTitled.current = true;
      return;
    }
    // Strip out embedded blocks like [WHITEBOARD:...], [DESMOS:...], etc.
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
        // Silently fail — user can still type their own title
      }
    };

    generateTitle();
  }, [content, title]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    hasAutoTitled.current = true;
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

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();

      // Set the generated content
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
  // Use a ref for title so the debounce is stable and never recreated
  const titleRef = useRef(title);
  useEffect(() => { titleRef.current = title; }, [title]);
  const proactiveAIEnabledRef = useRef(proactiveAIEnabled);
  useEffect(() => { proactiveAIEnabledRef.current = proactiveAIEnabled; }, [proactiveAIEnabled]);

  const analyzeContentForSuggestions = useRef(
    debounce(async (currentContent: string) => {
      if (!proactiveAIEnabledRef.current || !currentContent || currentContent.length < 50) {
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
            topic: titleRef.current || 'Study notes',
          }),
        });
        if (!response.ok) throw new Error('Failed to get suggestion');
        const data = await response.json();
        if (data.content && data.content.trim()) setProactiveSuggestion(data.content);
      } catch (error) {
        console.error('Proactive AI error:', error);
      } finally {
        setIsGeneratingSuggestion(false);
      }
    }, 3000)
  ).current;

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
    sileo.success({ title: 'Suggestion applied!' });
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

  // ── Export: Markdown + PDF (ported from AFFiNE's export system) ─────────────
  const exportMarkdown = () => {
    // Strip embedded block placeholders, keep plain text + markdown
    const clean = content
      .replace(/\[WHITEBOARD:[^\]]*\]/g, '*[Whiteboard embedded]*')
      .replace(/\[DESMOS:[^\]]*\]/g, '*[Desmos graph embedded]*')
      .replace(/\[CHART:[^\]]*\]/g, '*[Chart embedded]*')
      .replace(/\[YOUTUBE:[^\]]*\]/g, '*[YouTube video embedded]*')
      .replace(/\[DATABASE:[^\]]*\]/g, '*[Database embedded]*')
      .replace(/\[JOURNAL_LINK:[^\]]*\]/g, '*[Journal link]*');
    const md = `# ${title}\n\n${clean}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'journal'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    sileo.success({ title: 'Exported as Markdown' });
  };

  const exportPDF = () => {
    // Build a printable HTML page and open the print dialog
    const clean = content
      .replace(/\[WHITEBOARD:[^\]]*\]/g, '<p><em>[Whiteboard embedded]</em></p>')
      .replace(/\[DESMOS:[^\]]*\]/g, '<p><em>[Desmos graph embedded]</em></p>')
      .replace(/\[CHART:[^\]]*\]/g, '<p><em>[Chart embedded]</em></p>')
      .replace(/\[YOUTUBE:[^\]]*\]/g, '<p><em>[YouTube video embedded]</em></p>')
      .replace(/\[DATABASE:[^\]]*\]/g, '<p><em>[Database embedded]</em></p>')
      .replace(/\[JOURNAL_LINK:[^\]]*\]/g, '<p><em>[Journal link]</em></p>');

    // Convert basic markdown to HTML for the print view
    const html = clean
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/!\[([^\]]*)\]\((data:image[^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />')
      .replace(/\n/g, '<br/>');

    const printWindow = window.open('', '_blank');
    if (!printWindow) { sileo.error({ title: 'Allow popups to export PDF' }); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.7; }
        h1 { font-size: 2em; margin-bottom: 8px; } h2 { font-size: 1.4em; } h3 { font-size: 1.15em; }
        img { max-width: 100%; border-radius: 8px; }
        pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
        li { margin: 4px 0; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <h1>${title}</h1>
      <p style="color:#888;font-size:13px;margin-bottom:32px">${new Date().toLocaleDateString()}</p>
      <p>${html}</p>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
    sileo.success({ title: 'PDF export opened' });
  };

  // ── Presentation Mode ────────────────────────────────────────────────────────
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationSlide, setPresentationSlide] = useState(0);

  const presentationSlides = useMemo(() => {
    if (!content) return [];
    // Split on ## or # headings — each heading starts a new slide
    const parts = content.split(/\n(?=#{1,2} )/);
    return parts.map(part => {
      const lines = part.trim().split('\n');
      const heading = lines[0]?.replace(/^#{1,2} /, '') || 'Slide';
      const body = lines.slice(1).join('\n').trim();
      return { heading, body };
    }).filter(s => s.heading || s.body);
  }, [content]);

  const openPresentation = () => {
    if (presentationSlides.length === 0) {
      sileo.info({ title: 'Add headings (## Section) to create slides!' });
      return;
    }
    setPresentationSlide(0);
    setPresentationOpen(true);
  };

  // Keyboard navigation for presentation
  useEffect(() => {
    if (!presentationOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setPresentationSlide(i => Math.min(presentationSlides.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setPresentationSlide(i => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        setPresentationOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentationOpen, presentationSlides.length]);

  // ── AI Text Actions (ported from AFFiNE's action system) ────────────────────
  const handleAITextAction = async (
    action: string,
    opts?: { lang?: string; tone?: string }
  ) => {
    // Use selected text if available, fall back to full content
    const selectedText = window.getSelection()?.toString().trim() || '';
    const text = selectedText || content;
    if (!text.trim()) {
      sileo.info({ title: 'Add some content first!' });
      return;
    }

    const toastId = sileo.show({ title: `Running: ${action.replace(/([A-Z])/g, ' $1').toLowerCase()}…` });
    try {
      const res = await fetch('/api/journal/ai-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text, ...opts }),
      });
      if (!res.ok) throw new Error('AI action failed');

      // Stream the response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            result += parsed.choices?.[0]?.delta?.content ?? '';
          } catch { /* skip */ }
        }
      }

      if (!result.trim()) throw new Error('Empty response');

      // Replace selection or append to content
      if (selectedText) {
        setContent(prev => prev.replace(selectedText, result.trim()));
      } else {
        setContent(prev => prev ? prev + '\n\n' + result.trim() : result.trim());
      }

      sileo.dismiss(toastId);
      sileo.success({ title: 'Done!' });
    } catch (err) {
      sileo.dismiss(toastId);
      sileo.error({ title: 'AI action failed' });
      console.error('[ai-action]', err);
    }
  };

  // ── Image AI actions (explainImage, generateCaption) ────────────────────────
  const handleImageAIAction = async (action: 'explainImage' | 'generateCaption') => {
    // Extract the first base64 image from content
    const imgMatch = content.match(/!\[[^\]]*\]\((data:image\/[^)]+)\)/);
    if (!imgMatch) {
      sileo.info({ title: 'No image found in this journal. Upload an image first.' });
      return;
    }
    const imageBase64 = imgMatch[1];
    const toastId = sileo.show({ title: action === 'explainImage' ? 'Explaining image…' : 'Generating caption…' });
    try {
      const res = await fetch('/api/journal/ai-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, imageBase64 }),
      });
      if (!res.ok) throw new Error('Image AI action failed');
      const { result } = await res.json();
      if (!result?.trim()) throw new Error('Empty response');
      const prefix = action === 'explainImage' ? '\n\n**Image Explanation:**\n' : '\n\n*Caption:* ';
      setContent(prev => prev + prefix + result.trim());
      sileo.dismiss(toastId);
      sileo.success({ title: 'Done!' });
    } catch (err) {
      sileo.dismiss(toastId);
      sileo.error({ title: 'Image AI action failed' });
      console.error('[image-ai]', err);
    }
  };

  // ── Audio transcription ──────────────────────────────────────────────────────
  const handleAudioTranscribe = () => {
    transcribeAudioRef.current?.click();
  };

  const handleTranscribeFile = async (file: File) => {
    const toastId = sileo.show({ title: 'Transcribing audio…' });
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const res = await fetch('/api/journal/transcribe', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Transcription failed');
      const { transcript } = await res.json();
      if (!transcript?.trim()) throw new Error('Empty transcript');
      const header = `\n\n**Transcription of ${file.name}:**\n\n`;
      setContent(prev => prev + header + transcript.trim());
      sileo.dismiss(toastId);
      sileo.success({ title: 'Transcription added!' });
    } catch (err) {
      sileo.dismiss(toastId);
      sileo.error({ title: 'Transcription failed' });
      console.error('[transcribe]', err);
    }
  };

  // ── Mind map generation ──────────────────────────────────────────────────────
  const handleMindmap = async () => {
    const text = window.getSelection()?.toString().trim() || content;
    if (!text.trim()) {
      sileo.info({ title: 'Add some content first!' });
      return;
    }
    const toastId = sileo.show({ title: 'Generating mind map…' });
    try {
      const res = await fetch('/api/journal/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 3000) }),
      });
      if (!res.ok) throw new Error('Mind map generation failed');
      const { mindmap } = await res.json();

      // Render mind map as a simple ASCII/text representation in the journal
      const renderMindmapText = (mm: { root: { text: string }; children: Array<{ text: string; children?: Array<{ text: string }> }> }) => {
        let out = `## 🗺 Mind Map: ${mm.root.text}\n\n`;
        for (const branch of mm.children) {
          out += `**${branch.text}**\n`;
          for (const leaf of (branch.children || [])) {
            out += `  - ${leaf.text}\n`;
          }
          out += '\n';
        }
        return out.trim();
      };

      const mindmapText = renderMindmapText(mindmap);
      setContent(prev => prev ? prev + '\n\n' + mindmapText : mindmapText);
      sileo.dismiss(toastId);
      sileo.success({ title: 'Mind map generated!' });
    } catch (err) {
      sileo.dismiss(toastId);
      sileo.error({ title: 'Failed to generate mind map' });
      console.error('[mindmap]', err);
    }
  };

  // Execute a slash command
  const executeCommand = async (commandId: string) => {
    setShowSlashMenu(false);
    setCommandInput('');

    const aiCommands = ['notes', 'practice', 'flashcards', 'generate-image'];
    const formatCommands = ['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'quote', 'divider', 'code', 'latex', 'table', 'details', 'callout', 'callout-warning', 'callout-tip', 'mermaid', 'bookmark'];

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
        case 'callout':
          insertText = '\n:::info\n💡 **Note:** Write your callout content here.\n:::\n';
          break;
        case 'callout-warning':
          insertText = '\n:::warning\n⚠️ **Warning:** Write your warning here.\n:::\n';
          break;
        case 'callout-tip':
          insertText = '\n:::tip\n✅ **Tip:** Write your tip here.\n:::\n';
          break;
        case 'mermaid': {
          insertText = '\n```mermaid\nflowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Result 1]\n  B -->|No| D[Result 2]\n```\n';
          break;
        }
        case 'bookmark': {
          setBookmarkUrlInput('');
          setShowBookmarkModal(true);
          return; // modal handles the content insertion
        }
        default:
          insertText = '';
      }
      setContent(prev => prev ? prev + '\n\n' + insertText : insertText);
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
          handleChartInsert();
          break;
        case 'database':
          handleDatabaseInsert();
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
          sileo.info({ title: 'Video Library - Browse your saved educational videos', duration: 3000 });
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
        // ── AFFiNE AI text actions ─────────────────────────────
        case 'ai-continue':     handleAITextAction('continueWriting'); break;
        case 'ai-improve':      handleAITextAction('improveWriting'); break;
        case 'ai-summarize':    handleAITextAction('summary'); break;
        case 'ai-explain':      handleAITextAction('explain'); break;
        case 'ai-fix-grammar':  handleAITextAction('fixGrammar'); break;
        case 'ai-fix-spelling': handleAITextAction('fixSpelling'); break;
        case 'ai-make-longer':  handleAITextAction('makeLonger'); break;
        case 'ai-make-shorter': handleAITextAction('makeShorter'); break;
        case 'ai-headings':     handleAITextAction('createHeadings'); break;
        case 'ai-find-actions': handleAITextAction('findActions'); break;
        case 'ai-mindmap':      handleMindmap(); break;
        case 'ai-translate': {
          setTranslateLang('Spanish');
          setShowTranslateModal(true);
          break;
        }
        case 'ai-tone': {
          setToneChoice('Friendly');
          setShowToneModal(true);
          break;
        }
        case 'ai-brainstorm':    handleAITextAction('brainstorm'); break;
        case 'ai-outline':       handleAITextAction('writeOutline'); break;
        case 'ai-write-article': handleAITextAction('writeArticle'); break;
        case 'ai-write-blog':    handleAITextAction('writeBlog'); break;
        case 'ai-explain-code':  handleAITextAction('explainCode'); break;
        case 'ai-check-code':    handleAITextAction('checkCodeErrors'); break;
        case 'ai-transcribe':    handleAudioTranscribe(); break;
        case 'ai-explain-image': handleImageAIAction('explainImage'); break;
        case 'ai-caption':       handleImageAIAction('generateCaption'); break;
        default:
          sileo.info({ title: 'This feature is coming soon!' });
      }
    }
  };

  // Handle whiteboard insertion - adds an inline whiteboard
  const handleWhiteboardInsert = async () => {
    const whiteboardId = `wb-${Date.now()}`;

    // Add to embedded whiteboards
    setEmbeddedWhiteboards(prev => [...prev, { id: whiteboardId }]);

    // Add a placeholder in the content (use functional setState to avoid stale closures)
    const whiteboardPlaceholder = `\n\n[WHITEBOARD:${whiteboardId}]\n`;
    setContent(prev => prev ? prev + whiteboardPlaceholder : whiteboardPlaceholder);
    sileo.success({ title: 'Whiteboard added!' });
  };

  // Handle Desmos insertion - adds an inline Desmos graph directly
  const handleDesmosInsert = () => {
    const desmosId = `desmos-${Date.now()}`;

    // Add a placeholder in the content (use functional setState to avoid stale closures)
    const desmosPlaceholder = `[DESMOS:${desmosId}:]`;
    setContent(prev => {
      if (prev.includes(desmosPlaceholder)) return prev;
      return prev ? prev + `\n\n${desmosPlaceholder}\n` : `${desmosPlaceholder}\n`;
    });
    sileo.success({ title: 'Graph added! Type equations directly in the calculator.' });
  };

  // Handle subjournal creation
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

  // Search journals for linking
  const searchJournals = useCallback(debounce(async (query: string) => {
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
  }, 300), [user, journal?.id, supabase]);

  // Handle journal link insertion
  const handleJournalLink = (linkedJournal: JournalData) => {
    const journalLink = `\n\nhttps://agathon.app/journal/${linkedJournal.id}\n`;
    const newContent = content ? content + journalLink : journalLink;
    setContent(newContent);
    setShowJournalLinkModal(false);
    sileo.success({ title: 'Journal linked!' });
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
      sileo.success({ title: 'YouTube video embedded!' });
    } else {
      sileo.error({ title: 'Invalid YouTube URL' });
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
    sileo.success({ title: 'Desmos graph added!' });
  };

  // Handle chart insertion - adds an inline chart
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

  const handleDatabaseInsert = () => {
    const dbId = `db-${Date.now()}`;
    const encodedData = encodeDatabaseData(DEFAULT_DATABASE_CONFIG);
    const dbPlaceholder = `[DATABASE:${dbId}:${encodedData}]`;
    setEmbeddedDatabases(prev => [...prev, { id: dbId }]);
    setContent(prev => {
      if (prev.includes(dbPlaceholder)) return prev;
      return prev ? prev + `\n\n${dbPlaceholder}\n` : `${dbPlaceholder}\n`;
    });
    sileo.success({ title: 'Database added!' });
  };

  // Handle file upload (converts to base64 and embeds)
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, fileType: 'image' | 'audio' | 'video' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB for images, 10MB for others)
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
    sileo.success({ title: 'Content added to journal!' });
  };

  // Reapply content (re-add content from a written message)
  const handleReapplyContent = (messageContent: string, messageIndex: number) => {
    const newContent = content ? content + '\n\n' + messageContent : messageContent;
    setContent(newContent);
    sileo.success({ title: 'Content reapplied to journal!' });
  };

  // Copy message content to clipboard
  const handleCopyMessage = async (messageContent: string) => {
    try {
      await navigator.clipboard.writeText(messageContent);
      sileo.success({ title: 'Copied to clipboard!' });
    } catch (error) {
      sileo.error({ title: 'Failed to copy' });
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
    sileo.success({ title: 'Section added!' });
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
    sileo.success({ title: 'All sections added!' });
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
 <div className="min-h-screen bg-background flex flex-col">
      <DesignUpgradeBanner />
      <div className="flex flex-1">
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
 <header className="flex items-center justify-between px-5 py-3 relative z-[60] border-b border-border bg-background/95 backdrop-blur-sm">
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

        {/* Centre - Journal ↔ Whiteboard switcher + right panel tabs */}
        <div className="flex items-center gap-2">
          {/* Mode switcher */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background text-foreground shadow-sm"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Journal
            </button>
            <button
              onClick={() => router.push(linkedWhiteboardId ? `/board/${linkedWhiteboardId}` : '/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={18} height={18} rx={2}/><line x1={3} y1={9} x2={21} y2={9}/><line x1={9} y1={21} x2={9} y2={9}/></svg>
              Whiteboard
            </button>
          </div>
          <div className="w-px h-5 bg-border" />
        </div>

        {/* Right panel tab icons */}
        <div className="flex items-center gap-0.5">
          {([
            { tab: 'ai' as RightPanelTab,    icon: <Sparkle weight="fill" className="h-4 w-4" />,       title: 'AI Assistant' },
            { tab: 'toc' as RightPanelTab,   icon: <ListBullets className="h-4 w-4" />,                 title: 'Table of Contents' },
            { tab: 'cal' as RightPanelTab,   icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={18} rx={2}/><line x1={16} y1={2} x2={16} y2={6}/><line x1={8} y1={2} x2={8} y2={6}/><line x1={3} y1={10} x2={21} y2={10}/></svg>, title: 'Calendar' },
            { tab: 'tpl' as RightPanelTab,   icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/></svg>, title: 'Templates' },
            { tab: 'frame' as RightPanelTab, icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>, title: 'Frame Navigator' },
            { tab: 'chat' as RightPanelTab,  icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, title: 'Comments' },
          ]).map(({ tab, icon, title }) => (
            <button
              key={tab}
              title={title}
              onClick={() => {
                if (isAIPanelOpen && rightPanelTab === tab) {
                  setIsAIPanelOpen(false);
                } else {
                  setRightPanelTab(tab);
                  setIsAIPanelOpen(true);
                }
              }}
              className={cn(
                'p-2 transition-colors rounded-lg',
                isAIPanelOpen && rightPanelTab === tab
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {icon}
            </button>
          ))}
          {/* Sidebar toggle */}
          <div className="w-px h-5 bg-border mx-1" />
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
 <Timer weight="duotone" className="h-5 w-5" />
          </button>
          {/* Export dropdown */}
          <div className="relative group">
            <button
              className="p-2 hover:bg-muted transition-colors text-muted-foreground rounded-lg"
              title="Export"
            >
              <ArrowSquareOut weight="duotone" className="h-5 w-5" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[150px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={exportMarkdown}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <FileText weight="duotone" className="h-4 w-4 text-muted-foreground" />
                Export Markdown
              </button>
              <button
                onClick={exportPDF}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
              >
                <FileDoc weight="duotone" className="h-4 w-4 text-muted-foreground" />
                Export PDF
              </button>
            </div>
          </div>
          <button
            className="p-2 hover:bg-muted transition-colors text-muted-foreground rounded-lg"
            onClick={openPresentation}
            title="Presentation mode"
          >
            <FilmSlate weight="duotone" className="h-5 w-5" />
          </button>
          <button
            className="p-2 hover:bg-muted transition-colors text-muted-foreground rounded-lg"
            onClick={() => setIsShareOpen(true)}
            title="Share"
          >
            <ShareNetwork weight="duotone" className="h-5 w-5" />
          </button>
          <button
            className="p-2 hover:bg-muted transition-colors text-muted-foreground rounded-lg"
            onClick={() => setIsPropertiesOpen(true)}
            title="Document properties"
          >
            <SlidersHorizontal weight="duotone" className="h-5 w-5" />
          </button>
          {/* Ask Agathon button */}
          <button
            onClick={() => setIsAIPanelOpen(true)}
 className="ml-2 flex items-center gap-2 bg-[#1e6ee8] hover:bg-[#1a5fcf] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-[0_2px_12px_rgba(30,110,232,0.3)]"
          >
 <Sparkle weight="fill" className="h-3.5 w-3.5" />
            Ask Agathon
          </button>
        </div>
      </header>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        journalId={journal?.id}
        journalTitle={title}
        content={content}
      />

      {/* Document Properties Panel */}
      <DocPropertiesPanel
        open={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        properties={{
          ...docProperties,
          createdAt: journal?.created_at,
          updatedAt: journal?.updated_at,
          wordCount: wordCount,
        }}
        onChange={handlePropertiesChange}
      />

      {/* Presentation Mode */}
      {presentationOpen && presentationSlides.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col" onClick={() => setPresentationOpen(false)}>
          <div className="absolute top-4 right-4 flex gap-2 z-10" onClick={e => e.stopPropagation()}>
            <span className="text-white/60 text-sm self-center">{presentationSlide + 1} / {presentationSlides.length}</span>
            <button
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={() => setPresentationSlide(i => Math.max(0, i - 1))}
              disabled={presentationSlide === 0}
            ><CaretLeft className="h-5 w-5" /></button>
            <button
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={() => setPresentationSlide(i => Math.min(presentationSlides.length - 1, i + 1))}
              disabled={presentationSlide === presentationSlides.length - 1}
            ><CaretRight className="h-5 w-5" /></button>
            <button
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={() => setPresentationOpen(false)}
            ><X className="h-5 w-5" /></button>
          </div>

          {/* Slide content */}
          <div
            className="flex-1 flex flex-col items-center justify-center px-16 py-20"
            onClick={e => { e.stopPropagation(); setPresentationSlide(i => Math.min(presentationSlides.length - 1, i + 1)); }}
          >
            <h1 className="text-5xl font-bold text-white mb-8 text-center leading-tight max-w-4xl">
              {presentationSlides[presentationSlide].heading}
            </h1>
            {presentationSlides[presentationSlide].body && (
              <div className="text-xl text-white/80 text-center max-w-3xl whitespace-pre-wrap leading-relaxed">
                {presentationSlides[presentationSlide].body
                  .replace(/^[*-] /gm, '• ')
                  .replace(/\*\*(.+?)\*\*/g, '$1')
                  .replace(/\*(.+?)\*/g, '$1')
                  .replace(/#{1,3} /g, '')}
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 pb-8">
            {presentationSlides.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setPresentationSlide(i); }}
                className={`h-2 rounded-full transition-all ${i === presentationSlide ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Find in Page Bar */}
      {findOpen && (
        <div className="fixed top-16 right-4 z-[90] bg-white rounded-xl shadow-lg border border-border flex items-center gap-2 px-3 py-2" style={{ border: 'var(--affine-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          <MagnifyingGlass className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={e => { setFindQuery(e.target.value); setFindIndex(0); }}
            placeholder="Find in page…"
            className="text-sm outline-none w-48 bg-transparent"
            onKeyDown={e => {
              if (e.key === 'Enter') setFindIndex(i => (i + 1) % Math.max(findMatches.length, 1));
              if (e.key === 'Escape') { setFindOpen(false); setFindQuery(''); }
            }}
          />
          {findQuery.trim() && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {findMatches.length > 0 ? `${findIndex + 1}/${findMatches.length}` : '0 results'}
            </span>
          )}
          <div className="flex gap-0.5">
            <button onClick={() => setFindIndex(i => (i - 1 + Math.max(findMatches.length, 1)) % Math.max(findMatches.length, 1))} className="p-1 hover:bg-muted rounded" disabled={findMatches.length === 0}>
              <CaretUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setFindIndex(i => (i + 1) % Math.max(findMatches.length, 1))} className="p-1 hover:bg-muted rounded" disabled={findMatches.length === 0}>
              <CaretDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={() => { setFindOpen(false); setFindQuery(''); }} className="p-1 hover:bg-muted rounded ml-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* AFFiNE-style right panel — AI, ToC, Calendar, Templates */}
      <JournalRightPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        activeTab={rightPanelTab}
        onTabChange={(tab) => { setRightPanelTab(tab); if (!isAIPanelOpen) setIsAIPanelOpen(true); }}
        chatMessages={chatMessages}
        isChatting={isChatting}
        onSendMessage={(msg) => { setChatInput(msg); setTimeout(() => handleChatSubmit(), 0); }}
        onClearChat={handleClearChat}
        pendingMessageIndex={pendingMessageIndex}
        onAcceptContent={handleAcceptContent}
        onDismissContent={handleDismissContent}
        onReapplyContent={handleReapplyContent}
        onCopyMessage={handleCopyMessage}
        renderMarkdown={renderMarkdown}
        showSlashMenu={showSlashMenu}
        commandInput={commandInput}
        chatInput={chatInput}
        onCommandInputChange={(v) => {
          setCommandInput(v);
          setChatInput('');
          setSlashFilter(v.slice(1));
          setShowSlashMenu(true);
          setSearchExpanded(true);
          setSelectedCommandIndex(0);
        }}
        onChatInputChange={(v) => {
          setChatInput(v);
          setCommandInput('');
          setShowSlashMenu(false);
          setSlashFilter('');
        }}
        onChatKeyDown={(e) => {
          if (showSlashMenu) {
            handleCommandKeyDown(e as unknown as KeyboardEvent<HTMLInputElement>);
          } else if (e.key === 'Enter' && chatInput.trim() && !isChatting) {
            e.preventDefault();
            handleChatSubmit();
          }
        }}
        onSubmitChat={handleChatSubmit}
        content={content}
        journalId={journal?.id}
        journalTitle={title}
      />

      {/* DEAD CODE STUB — kept to satisfy closing braces below */}
      {false && (
 <div className="fixed inset-y-0 right-0 z-[80] flex">
 <div
            className="absolute inset-0 -left-[9999px]"
          />
 <div className="relative w-[360px] bg-card border-l border-border flex flex-col shadow-2xl">
            {/* Panel header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 bg-[#1e6ee8] rounded-lg flex items-center justify-center">
 <Sparkle className="h-3.5 w-3.5 text-white" weight="fill" />
                </div>
 <span className="font-semibold text-sm text-foreground">Ask Agathon</span>
              </div>
              <button
                onClick={() => setIsAIPanelOpen(false)}
 className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
              >
 <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat messages */}
 <div
              ref={chatContainerRef}
 className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {chatMessages.length === 0 && (
 <div className="flex flex-col items-center justify-center h-full py-12 text-center">
 <div className="w-12 h-12 bg-[#eef3fd] rounded-2xl flex items-center justify-center mb-4">
 <Sparkle className="h-6 w-6 text-[#1e6ee8]" weight="fill" />
                  </div>
 <p className="text-[15px] font-semibold text-foreground mb-1">Ask me anything</p>
 <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[220px]">
                    I can explain concepts, generate notes, create flashcards, and more.
                  </p>
 <div className="mt-6 w-full space-y-2">
                    {[
                      'Explain this topic in simple terms',
                      'Generate notes from my content',
                      'Create practice problems',
                      'What should I study next?',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => { setChatInput(suggestion); }}
 className="w-full text-left px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors border border-border/50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'user' ? (
 <div className="flex justify-end">
 <div className="bg-[#1e6ee8] text-white px-3.5 py-2 rounded-2xl rounded-br-sm text-sm max-w-[240px] leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
 <div className="flex gap-2.5">
 <div className="w-6 h-6 bg-[#1e6ee8] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
 <Sparkle className="h-3 w-3 text-white" weight="fill" />
                      </div>
 <div className="flex-1 min-w-0">
 <div
 className="text-[13px] text-foreground/85 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
 <div className="flex items-center gap-2 mt-2">
                            {msg.written ? (
                              <>
 <span className="inline-flex items-center gap-1 text-[11px] text-[#1e6ee8] font-medium">
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
 className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#1e6ee8] text-white rounded-lg hover:bg-[#1a5fcf] transition-colors font-medium"
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
                              title="Copy"
                            >
 <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              ))}
              {isChatting && (
 <div className="flex gap-2.5">
 <div className="w-6 h-6 bg-[#1e6ee8] rounded-lg flex items-center justify-center flex-shrink-0">
 <div className="h-3 w-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  </div>
 <div className="text-[13px] text-muted-foreground">Thinking...</div>
                </div>
              )}
            </div>

            {/* Slash Command Menu (inside panel) */}
            {showSlashMenu && searchExpanded && (
 <div className="mx-4 mb-2 bg-card border border-border shadow-xl rounded-xl py-2 max-h-[300px] overflow-y-auto">
                {slashCommands.map((category, catIndex) => {
                  const filteredItems = category.items.filter(item =>
                    item.label.toLowerCase().includes(slashFilter.toLowerCase())
                  );
                  if (filteredItems.length === 0) return null;
                  return (
 <div key={category.category} className={catIndex > 0 ? 'mt-1' : ''}>
 <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                              'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                              isSelected ? 'bg-accent text-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
 <Icon className="h-4 w-4" />
 <span className={cn('text-sm', isSelected && 'font-medium')}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input area */}
 <div className="px-4 py-3 border-t border-border flex-shrink-0" ref={chatBarRef}>
              {chatMessages.length > 0 && (
                <button
                  onClick={() => { handleClearChat(); }}
 className="mb-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear conversation
                </button>
              )}
 <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border border-border focus-within:border-[#1e6ee8]/40 transition-colors">
                <input
                  ref={commandInputRef}
                  type="text"
                  value={showSlashMenu ? commandInput : chatInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.startsWith('/')) {
                      setCommandInput(value);
                      setChatInput('');
                      setSlashFilter(value.slice(1));
                      setShowSlashMenu(true);
                      setSearchExpanded(true);
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
                    }
                  }}
                  placeholder='Ask anything or "/" for commands…'
 className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground focus:ring-0"
                  disabled={isChatting}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim() || isChatting}
 className="w-7 h-7 bg-[#1e6ee8] text-white rounded-lg flex items-center justify-center hover:bg-[#1a5fcf] transition-colors disabled:opacity-30"
                >
 <ArrowUp className="h-4 w-4" />
                </button>
              </div>
 <p className="mt-2 text-[11px] text-muted-foreground/60 text-center">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
 <main className={cn("px-8 py-10 max-w-3xl mx-auto transition-all duration-300", isAIPanelOpen ? "mr-[360px]" : "")}>

        {/* Large serif title */}
 <div className="mb-8">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
 className="text-[2rem] font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 focus:ring-0 w-full tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
            placeholder="Untitled"
          />
 <div className="h-px bg-border mt-4" />
          {/* Metadata row */}
 <div className="flex items-center gap-3 mt-2.5">
            {journal && (
 <span className="text-xs text-muted-foreground">
                {new Date(journal.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            {content.trim() && (
              <>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-muted-foreground">
                  {wordCount} words
                </span>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-muted-foreground">
                  {Math.max(1, Math.ceil(wordCount / 200))} min read
                </span>
              </>
            )}
            {isSaving && (
              <>
 <span className="text-muted-foreground/40">·</span>
 <span className="text-xs text-muted-foreground/60">Saving…</span>
              </>
            )}
          </div>
        </div>
        {/* Start with section - only show when empty */}
        {isEmpty && !activeInlineInput && !isGeneratingFlashcards && flashcards.length === 0 && (
 <div className="mb-10">
 <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Start with</p>
 <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => { setIsAIPanelOpen(true); }}
                disabled={isGenerating}
 className="bg-card border border-border hover:border-[#1e6ee8]/40 hover:bg-[#f0f6ff] p-4 text-left rounded-xl transition-all duration-150 disabled:opacity-50 group shadow-sm"
              >
 <div className="w-8 h-8 bg-[#eef3fd] rounded-lg flex items-center justify-center mb-3">
 <Sparkle weight="fill" className="h-4 w-4 text-[#1e6ee8]" />
                </div>
 <p className="text-sm font-semibold text-foreground">Ask Agathon</p>
 <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Generate notes with AI</p>
              </button>
              <button
                onClick={() => handleOpenInlineInput('Flashcards')}
                disabled={isGenerating}
 className="bg-card border border-border hover:border-[#1e6ee8]/40 hover:bg-[#f0f6ff] p-4 text-left rounded-xl transition-all duration-150 disabled:opacity-50 group shadow-sm"
              >
 <div className="w-8 h-8 bg-[#eef3fd] rounded-lg flex items-center justify-center mb-3">
 <Stack weight="fill" className="h-4 w-4 text-[#1e6ee8]" />
                </div>
 <p className="text-sm font-semibold text-foreground">Flashcards</p>
 <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Spaced repetition study</p>
              </button>
              <button
                onClick={() => handleOpenInlineInput('Practice Problems')}
                disabled={isGenerating}
 className="bg-card border border-border hover:border-[#1e6ee8]/40 hover:bg-[#f0f6ff] p-4 text-left rounded-xl transition-all duration-150 disabled:opacity-50 group shadow-sm"
              >
 <div className="w-8 h-8 bg-[#eef3fd] rounded-lg flex items-center justify-center mb-3">
 <ClipboardText weight="fill" className="h-4 w-4 text-[#1e6ee8]" />
                </div>
 <p className="text-sm font-semibold text-foreground">Practice</p>
 <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">AI practice problems</p>
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
 className="p-2.5 bg-card text-red-600 hover:bg-muted transition-colors"
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
                    ? 'bg-green-50  border-green-200  opacity-60'
                    : 'bg-red-50  border-red-200  opacity-40 line-through'
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
 <span className="text-xs text-green-600 font-medium flex-shrink-0">Added</span>
                    )}
                    {block.status === 'denied' && (
 <span className="text-xs text-red-600 font-medium flex-shrink-0">Removed</span>
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
              sileo.success({ title: 'Whiteboard deleted' });
            }}
            onDeleteDesmos={(id) => {
              // Remove placeholder from content
              setContent(prev => prev.replace(new RegExp(`\\n*\\[DESMOS:${id}:[^\\]]*\\]\\n*`, 'g'), '\n'));
              sileo.success({ title: 'Graph deleted' });
            }}
            onChartSave={(id, data) => {
              // Update the chart placeholder with new encoded data
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
            onDatabaseSave={(id, data) => {
              setContent(prev => {
                const regex = new RegExp(`\\[DATABASE:${id}:[^\\]]*\\]`);
                return prev.replace(regex, `[DATABASE:${id}:${encodeDatabaseData(data)}]`);
              });
            }}
            onDeleteDatabase={(id) => {
              setEmbeddedDatabases(prev => prev.filter(d => d.id !== id));
              setContent(prev => prev.replace(new RegExp(`\\n*\\[DATABASE:${id}:[^\\]]*\\]\\n*`, 'g'), '\n'));
              sileo.success({ title: 'Database deleted' });
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

      {/* Bookmark URL Modal */}
      <Dialog open={showBookmarkModal} onClose={() => setShowBookmarkModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Link className="h-5 w-5 text-muted-foreground" />
                  Add Bookmark Card
                </DialogTitle>
                <button onClick={() => setShowBookmarkModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Paste any URL to create a rich link preview card.</p>
              <input
                type="url"
                autoFocus
                value={bookmarkUrlInput}
                onChange={(e) => setBookmarkUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && bookmarkUrlInput.trim()) {
                    setContent(prev => prev ? prev + `\n\n[BOOKMARK:${bookmarkUrlInput.trim()}]\n` : `[BOOKMARK:${bookmarkUrlInput.trim()}]\n`);
                    setShowBookmarkModal(false);
                  }
                }}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
              />
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowBookmarkModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={() => {
                  if (bookmarkUrlInput.trim()) {
                    setContent(prev => prev ? prev + `\n\n[BOOKMARK:${bookmarkUrlInput.trim()}]\n` : `[BOOKMARK:${bookmarkUrlInput.trim()}]\n`);
                    setShowBookmarkModal(false);
                  }
                }}
                disabled={!bookmarkUrlInput.trim()}
                className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >Add Bookmark</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Translate Modal */}
      <Dialog open={showTranslateModal} onClose={() => setShowTranslateModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground">Translate</DialogTitle>
                <button onClick={() => setShowTranslateModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-3">Choose target language:</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Korean', 'Portuguese', 'Italian', 'Russian'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setTranslateLang(lang)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${translateLang === lang ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                  >{lang}</button>
                ))}
              </div>
              <input
                type="text"
                value={translateLang}
                onChange={(e) => setTranslateLang(e.target.value)}
                placeholder="Or type a language…"
                className="w-full px-4 py-2.5 border border-border bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all text-sm"
              />
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowTranslateModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={() => { handleAITextAction('translate', { lang: translateLang }); setShowTranslateModal(false); }}
                disabled={!translateLang.trim()}
                className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >Translate</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Change Tone Modal */}
      <Dialog open={showToneModal} onClose={() => setShowToneModal(false)} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-card border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DialogTitle className="text-lg font-semibold text-foreground">Change Tone</DialogTitle>
                <button onClick={() => setShowToneModal(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'Professional', desc: 'Formal and precise' },
                  { id: 'Informal', desc: 'Casual and conversational' },
                  { id: 'Friendly', desc: 'Warm and approachable' },
                  { id: 'Critical', desc: 'Analytical and rigorous' },
                  { id: 'Humorous', desc: 'Light-hearted and witty' },
                ].map(({ id, desc }) => (
                  <button
                    key={id}
                    onClick={() => setToneChoice(id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors text-left ${toneChoice === id ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}
                  >
                    <span className="font-medium text-sm">{id}</span>
                    <span className={`text-xs ${toneChoice === id ? 'text-background/70' : 'text-muted-foreground'}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 p-4 bg-muted border-t border-border">
              <button onClick={() => setShowToneModal(false)} className="flex-1 px-4 py-2.5 text-muted-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={() => { handleAITextAction('changeTone', { tone: toneChoice }); setShowToneModal(false); }}
                className="flex-1 px-4 py-2.5 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
              >Apply Tone</button>
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
        ref={transcribeAudioRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleTranscribeFile(file);
          e.target.value = '';
        }}
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
    </div>
  );
}
