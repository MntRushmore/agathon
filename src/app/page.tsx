"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { getStudentAssignments } from '@/lib/api/assignments';
import { ShareBoardDialog } from '@/components/sharing/ShareBoardDialog';
import { getTimeBasedGreeting, getFriendlyTimestamp } from '@/components/dashboard/study-tips';
import {
  Plus,
  Trash,
  MagnifyingGlass,
  PencilSimple,
  DotsThree,
  ShareNetwork,
  UsersThree,
  BookOpenText,
  CreditCard,
  ShieldCheck,
  CaretLeft,
  CaretRight,
  CaretDown,
  CaretUp,
  FolderOpen,
  House,
  PencilLine,
  GraduationCap,
  Clock,
  Calculator,
  Sparkle,
  Star,
  Copy,
  Funnel,
  GridNine,
  ListBullets,
  Timer,
  Pause,
  Play,
  ArrowCounterClockwise,
  X,
  GearSix,
  Question,
  Lightning,
  FileText,
  Note,
  Books,
  ArrowRight,
  ArrowsClockwise,
  CircleNotch,
  Warning,
  CheckCircle,
  Eye,
  ClockCountdown,
  HighlighterCircle,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { AgoraLandingPage } from "@/components/landing/AgoraLandingPage";
import { TemplateSelectionDialog } from "@/components/board/TemplateSelectionDialog";

type Whiteboard = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  folder_id?: string;
  tags?: string[];
  metadata?: {
    templateId?: string;
    subject?: string;
    gradeLevel?: string;
    instructions?: string;
    defaultMode?: 'off' | 'feedback' | 'suggest' | 'answer';
    boardType?: 'math' | 'notes' | 'diagram' | 'general';
  };
  sharedPermission?: 'view' | 'edit';
};

type Journal = {
  id: string;
  title: string;
  content: any[];
  created_at: string;
  updated_at: string;
};

type RecentItem = {
  id: string;
  title: string;
  updated_at: string;
  type: 'board' | 'journal';
  preview?: string;        // image src for boards
  snippet?: string;        // text excerpt for journals
  boardType?: string;
};

// Feature card color variants - clean modern palette with Agathon blue
type ColorVariant = 'green' | 'blue' | 'purple' | 'amber';

const colorVariants: Record<ColorVariant, { iconBg: string; iconColor: string; hoverBorder: string; accentBg: string; accentBar: string }> = {
  green: {
    iconBg: 'bg-[oklch(0.95_0.04_155)]',
    iconColor: 'text-[oklch(0.45_0.14_155)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_155)]',
    accentBg: 'bg-[oklch(0.95_0.04_155)]',
    accentBar: 'border-l-[oklch(0.55_0.16_155)]',
  },
  blue: {
    iconBg: 'bg-[oklch(0.94_0.03_225)]',
    iconColor: 'text-[oklch(0.52_0.11_225)]',
    hoverBorder: 'group-hover:border-[oklch(0.84_0.04_225)]',
    accentBg: 'bg-[oklch(0.94_0.03_225)]',
    accentBar: 'border-l-[oklch(0.52_0.11_225)]',
  },
  purple: {
    iconBg: 'bg-[oklch(0.95_0.04_285)]',
    iconColor: 'text-[oklch(0.45_0.14_285)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_285)]',
    accentBg: 'bg-[oklch(0.95_0.04_285)]',
    accentBar: 'border-l-[oklch(0.52_0.15_285)]',
  },
  amber: {
    iconBg: 'bg-[oklch(0.96_0.04_80)]',
    iconColor: 'text-[oklch(0.55_0.14_80)]',
    hoverBorder: 'group-hover:border-[oklch(0.88_0.04_80)]',
    accentBg: 'bg-[oklch(0.96_0.04_80)]',
    accentBar: 'border-l-[oklch(0.65_0.15_80)]',
  },
};

// animejs removed — using CSS transitions instead

// Board type icons
const boardTypeIcons: Record<string, React.ReactNode> = {
 math: <Calculator className="w-3.5 h-3.5" weight="duotone" />,
 notes: <FileText className="w-3.5 h-3.5" weight="duotone" />,
 diagram: <GridNine className="w-3.5 h-3.5" weight="duotone" />,
 general: <PencilLine className="w-3.5 h-3.5" weight="duotone" />,
};

function toEmbedUrl(url: string): string {
  if (url.includes('docs.google.com/document')) {
    return url.replace(/\/edit.*$/, '/preview');
  }
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && url.includes('drive.google.com')) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  if (url.includes('docs.google.com/')) {
    return url.replace(/\/edit.*$/, '/preview');
  }
  return url;
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'home' | 'boards' | 'journals'>('home');

  // Greeting state
  const greeting = useMemo(() => getTimeBasedGreeting(), []);

  // MagnifyingGlass and filter state
  const [searchQuery, setMagnifyingGlassQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'recent' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sidebar section states
  const [toolsOpen, setToolsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // refs removed — no longer needed without anime.js

  // Pomodoro timer state
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 minutes
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');
  const [pomodoroPaused, setPomodoroPaused] = useState(false);

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Google Classroom assignments from knowledge base
  const [classroomAssignments, setClassroomAssignments] = useState<any[]>([]);
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomExpired, setClassroomExpired] = useState(false);
  const [classroomCourses, setClassroomCourses] = useState<{ id: string; name: string; assignmentCount: number; url?: string }[]>([]);
  const [classroomCourseFilter, setClassroomCourseFilter] = useState<string | null>(null);
  const [classroomStats, setClassroomStats] = useState<{ total: number; turned_in: number; graded: number; missing: number; upcoming: number }>({ total: 0, turned_in: 0, graded: 0, missing: 0, upcoming: 0 });
  const [classroomSyncing, setClassroomSyncing] = useState(false);

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBoardId, setShareBoardId] = useState<string | null>(null);
  const [shareBoardTitle, setShareBoardTitle] = useState('');

  // Quick capture state
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNoteContent, setQuickNoteContent] = useState('');

  // Usage limits (free plan)
  const [journalCount, setJournalCount] = useState(0);
  const FREE_BOARD_LIMIT = 3;
  const FREE_JOURNAL_LIMIT = 3;


  // Pomodoro timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pomodoroActive && !pomodoroPaused && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime((t) => t - 1);
      }, 1000);
    } else if (pomodoroTime === 0 && pomodoroActive) {
      setPomodoroActive(false);
      setPomodoroPaused(false);
      if (pomodoroMode === 'work') {
        sileo.success({ title: 'Work session complete! Take a 5-minute break.' });
        setPomodoroTime(5 * 60);
        setPomodoroMode('break');
      } else {
        sileo.success({ title: 'Break over! Ready for another session?' });
        setPomodoroTime(25 * 60);
        setPomodoroMode('work');
      }
    }
    return () => clearInterval(interval);
  }, [pomodoroActive, pomodoroPaused, pomodoroTime, pomodoroMode]);

  // Redirect to login if auth required
  useEffect(() => {
    if (searchParams.get('auth') === 'required') {
      router.push('/login');
      sileo.info({ title: 'Please sign in to continue' });
    }
    if (searchParams.get('error') === 'teacher_only') {
      sileo.error({ title: 'Access denied. Only teachers can access the teacher dashboard.' });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchWhiteboards();
      fetchJournals();
      if (profile?.role === 'student' || profile?.role === 'admin') {
        fetchAssignments();
        fetchClassroomAssignments();
        triggerAutoSync();
      }
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  async function fetchJournals() {
    try {
      const { data, count, error } = await supabase
        .from('journals')
        .select('id, title, content, created_at, updated_at', { count: 'exact' })
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setJournals(data || []);
      setJournalCount(count || 0);
    } catch (error) {
      console.error('Error fetching journals:', error);
    }
  }

  async function fetchWhiteboards() {
    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .select('id, title, created_at, updated_at, preview, metadata')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setWhiteboards(data || []);
    } catch (error: any) {
      console.error('Error fetching whiteboards:', error);
      if (error.code !== 'PGRST116') {
        sileo.error({ title: 'Failed to fetch whiteboards' });
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAssignments() {
    try {
      const data = await getStudentAssignments();
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  }

  async function fetchClassroomAssignments(course?: string | null) {
    try {
      const params = new URLSearchParams();
      if (course) params.set('course', course);
      const res = await fetch(`/api/knowledge/assignments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClassroomConnected(data.connected);
        setClassroomExpired(data.expired || false);
        setClassroomAssignments(data.assignments || []);
        setClassroomCourses(data.courses || []);
        setClassroomStats(data.stats || { total: 0, turned_in: 0, graded: 0, missing: 0, upcoming: 0 });
      }
    } catch (error) {
      console.error('Error fetching classroom assignments:', error);
    }
  }

  async function triggerAutoSync() {
    try {
      const res = await fetch('/api/knowledge/auto-sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.reason === 'stale') {
          setClassroomSyncing(true);
          const syncRes = await fetch('/api/knowledge/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (syncRes.ok) {
            await fetchClassroomAssignments(classroomCourseFilter);
          }
          setClassroomSyncing(false);
        }
      }
    } catch {
      setClassroomSyncing(false);
    }
  }

  const isAdmin = profile?.role === 'admin';

  // No stagger animations — content renders immediately

  // Helper to get template metadata
  const getTemplateMetadata = (templateId: string) => {
    const preferredMode = localStorage.getItem('agathon_pref_ai_mode') || 'feedback';
    const templates: Record<string, any> = {
      blank: {
        title: 'Untitled Board',
        templateId: 'blank',
        defaultMode: preferredMode,
        boardType: 'general',
      },
      lined: {
        title: 'Lined Notebook',
        templateId: 'lined',
        defaultMode: preferredMode,
        boardType: 'notes',
        backgroundStyle: 'lined',
      },
      graph: {
        title: 'Graph Paper',
        templateId: 'graph',
        defaultMode: preferredMode,
        boardType: 'math',
        backgroundStyle: 'grid',
      },
      'file-upload': {
        title: 'Uploaded File',
        templateId: 'file-upload',
        defaultMode: preferredMode,
        boardType: 'general',
      },
    };
    return templates[templateId] || templates.blank;
  };

  // Handle template selection and create board
  const handleTemplateSelect = useCallback(async (templateId: string, fileData?: string | string[]) => {
    if (creating) return;

    if (!user) {
      sileo.info({ title: 'Creating temporary board' });
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
      setTemplateDialogOpen(false);
      return;
    }

    if (!isAdmin && whiteboards.length >= FREE_BOARD_LIMIT) {
      sileo.error({ title: `You've reached the limit of ${FREE_BOARD_LIMIT} boards. Delete one to create a new board.` });
      setTemplateDialogOpen(false);
      return;
    }

    setCreating(true);
    try {
      const metadata = getTemplateMetadata(templateId);

      const { data, error } = await supabase
        .from('whiteboards')
        .insert([
          {
            name: metadata.title,
            title: metadata.title,
            user_id: user.id,
            data: {},
            metadata: metadata,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      sileo.success({ title: 'Board created' });

      // Store file data in sessionStorage if present (too large for URL)
      if (fileData) {
        const dataToStore = JSON.stringify(fileData);
        sessionStorage.setItem('uploadedFile', dataToStore);
        router.push(`/board/${data.id}?hasUpload=true`);
      } else {
        router.push(`/board/${data.id}`);
      }
    } catch (error: unknown) {
      console.error('Error creating whiteboard:', error);
      sileo.error({ title: 'Failed to create whiteboard' });
    } finally {
      setCreating(false);
      setTemplateDialogOpen(false);
    }
  }, [creating, user, router, supabase, isAdmin, whiteboards.length]);

  const createWhiteboard = useCallback(() => {
    if (creating) return;

    if (!user) {
      sileo.info({ title: 'Creating temporary board' });
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
      return;
    }

    if (!isAdmin && whiteboards.length >= FREE_BOARD_LIMIT) {
      sileo.error({ title: `You've reached the limit of ${FREE_BOARD_LIMIT} boards. Delete one to create a new board.` });
      return;
    }

    // Use preferred template if set, otherwise open dialog
    const preferredTemplate = localStorage.getItem('agathon_pref_board_template');
    if (preferredTemplate && (preferredTemplate === 'blank' || preferredTemplate === 'lined' || preferredTemplate === 'graph')) {
      handleTemplateSelect(preferredTemplate);
    } else {
      setTemplateDialogOpen(true);
    }
  }, [creating, user, router, isAdmin, whiteboards.length, handleTemplateSelect]);

  // Keyboard shortcuts (only when authenticated — don't hijack browser defaults on landing page)
  useEffect(() => {
    if (!user) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault();
            createWhiteboard();
            break;
          case 'j':
            e.preventDefault();
            setActiveView('journals');
            break;
          case 'k':
            // Cmd+K is handled globally by CommandPalette
            break;
          case 'n':
            e.preventDefault();
            setQuickNoteOpen(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, router, createWhiteboard]);

  const createJournal = useCallback(async () => {
    if (!user) {
      router.push('/?auth=required');
      return;
    }
    if (!isAdmin && journals.length >= FREE_JOURNAL_LIMIT) {
      sileo.error({ title: `You've reached the limit of ${FREE_JOURNAL_LIMIT} journals. Delete one to create a new journal.` });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('journals')
        .insert([{ user_id: user.id, title: 'New Journal', content: [] }])
        .select()
        .single();
      if (error) throw error;
      sileo.success({ title: 'Journal created' });
      router.push(`/journal/${data.id}`);
    } catch (error) {
      console.error('Error creating journal:', error);
      sileo.error({ title: 'Failed to create journal' });
    }
  }, [user, router, supabase, isAdmin, journals.length]);

  async function openClassroomInBoard(assignment: any) {
    if (!user) return;
    try {
      const preferredMode = localStorage.getItem('agathon_pref_ai_mode') || 'feedback';
      const docUrl = assignment.metadata?.url as string | undefined;
      const { data, error } = await supabase
        .from('whiteboards')
        .insert([{
          name: assignment.title || 'Classroom Assignment',
          title: assignment.title || 'Classroom Assignment',
          user_id: user.id,
          data: {},
          metadata: {
            templateId: 'blank',
            subject: assignment.metadata?.course_name || 'General',
            instructions: assignment.content || '',
            defaultMode: preferredMode,
            ...(docUrl ? { documentUrl: toEmbedUrl(docUrl), documentTitle: assignment.title || 'Document' } : {}),
          },
        }])
        .select()
        .single();
      if (error) throw error;
      sileo.success({ title: 'Board created from assignment' });
      router.push(`/board/${data.id}`);
    } catch (error) {
      console.error('Error creating board from assignment:', error);
      sileo.error({ title: 'Failed to create board' });
    }
  }

  async function openClassroomInJournal(assignment: any) {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('journals')
        .insert([{
          user_id: user.id,
          title: assignment.title || 'Classroom Assignment',
          content: [
            { type: 'heading', content: assignment.title || 'Classroom Assignment' },
            { type: 'paragraph', content: assignment.content || '' },
          ],
        }])
        .select()
        .single();
      if (error) throw error;
      sileo.success({ title: 'Journal created from assignment' });
      router.push(`/journal/${data.id}`);
    } catch (error) {
      console.error('Error creating journal from assignment:', error);
      sileo.error({ title: 'Failed to create journal' });
    }
  }

  async function deleteJournal(id: string) {
    try {
      const { error } = await supabase
        .from('journals')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setJournals(journals.filter(j => j.id !== id));
      sileo.success({ title: 'Journal deleted' });
    } catch (error) {
      console.error('Error deleting journal:', error);
      sileo.error({ title: 'Failed to delete journal' });
    }
  }

  async function deleteWhiteboard(id: string) {
    try {
      const { error } = await supabase
        .from('whiteboards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setWhiteboards(whiteboards.filter(w => w.id !== id));
      sileo.success({ title: 'Whiteboard deleted' });
    } catch (error) {
      console.error('Error deleting whiteboard:', error);
      sileo.error({ title: 'Failed to delete whiteboard' });
    }
  }

  async function duplicateWhiteboard(board: Whiteboard) {
    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .insert([
          {
            name: `${board.title} (Copy)`,
            title: `${board.title} (Copy)`,
            user_id: user?.id,
            data: {},
            metadata: board.metadata,
          }
        ])
        .select()
        .single();

      if (error) throw error;
      sileo.success({ title: 'Board duplicated' });
      fetchWhiteboards();
    } catch (error) {
      console.error('Error duplicating whiteboard:', error);
      sileo.error({ title: 'Failed to duplicate whiteboard' });
    }
  }

  async function toggleFavorite(id: string, isFavorite: boolean) {
    try {
      const { error } = await supabase
        .from('whiteboards')
        .update({ is_favorite: !isFavorite })
        .eq('id', id);

      if (error) throw error;

      setWhiteboards(whiteboards.map(w =>
        w.id === id ? { ...w, is_favorite: !isFavorite } : w
      ));
      sileo.success({ title: isFavorite ? 'Removed from favorites' : 'Added to favorites' });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      sileo.error({ title: 'Failed to update favorite' });
    }
  }

  async function handleRename() {
    if (!renameId) return;

    try {
      const { error } = await supabase
        .from('whiteboards')
        .update({ title: renameTitle })
        .eq('id', renameId);

      if (error) throw error;

      setWhiteboards(whiteboards.map(w =>
        w.id === renameId ? { ...w, title: renameTitle } : w
      ));
      sileo.success({ title: 'Whiteboard renamed' });
      setRenameId(null);
    } catch (error) {
      console.error('Error renaming whiteboard:', error);
      sileo.error({ title: 'Failed to rename whiteboard' });
    }
  }

  // Filter boards
  const filteredBoards = useMemo(() => {
    let boards = whiteboards;

    // Apply search
    if (searchQuery) {
      boards = boards.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    switch (filterType) {
      case 'favorites':
        boards = boards.filter(b => b.is_favorite);
        break;
      case 'archived':
        boards = boards.filter(b => b.is_archived);
        break;
      case 'recent':
        boards = boards.slice(0, 10);
        break;
    }

    return boards;
  }, [whiteboards, searchQuery, filterType]);

  // Last active board for "Continue where you left off"
  const lastActiveBoard = whiteboards[0];

  // Unified recents: merge boards + journals, sorted by updated_at
  const recentItems = useMemo<RecentItem[]>(() => {
    const boardItems: RecentItem[] = whiteboards.map(b => ({
      id: b.id,
      title: b.title,
      updated_at: b.updated_at,
      type: 'board' as const,
      preview: b.preview,
      boardType: b.metadata?.boardType,
    }));
    const journalItems: RecentItem[] = journals.map(j => {
      let snippet = '';
      if (j.content && j.content.length > 0) {
        const first = j.content[0];
        if (typeof first === 'string') snippet = first.slice(0, 80);
        else if (first?.content) snippet = first.content.slice(0, 80);
      }
      return {
        id: j.id,
        title: j.title,
        updated_at: j.updated_at,
        type: 'journal' as const,
        snippet: snippet || undefined,
      };
    });
    return [...boardItems, ...journalItems]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [whiteboards, journals]);

  // Feature cards for the main dashboard
  type FeatureCard = {
    id: string;
    title: string;
    description: string;
    detail: string;
    icon: React.ReactNode;
    color: ColorVariant;
    onClick: () => void;
    comingSoon?: boolean;
    isPrimary?: boolean;
  };

  const featureCards: FeatureCard[] = [
    {
      id: 'whiteboard',
      title: 'Agathon',
      description: 'Draw and get real-time AI tutoring help',
      detail: 'Handwriting recognition & hints',
 icon: <PencilLine className="h-5 w-5" weight="duotone" />,
      color: 'blue',
      onClick: () => { createWhiteboard(); },
      isPrimary: true,
    },
    {
      id: 'annotate',
      title: 'PDF Annotator',
      description: 'Mark up PDFs and images with ease',
      detail: 'Draw, highlight & add text',
 icon: <HighlighterCircle className="h-5 w-5" weight="duotone" />,
      color: 'purple',
      onClick: () => { router.push('/annotate'); },
    },
    {
      id: 'journal',
      title: 'Journal',
      description: 'Write notes with AI-powered study tools',
      detail: 'Flashcards, Feynman method & more',
 icon: <BookOpenText className="h-5 w-5" weight="duotone" />,
      color: 'green',
      onClick: () => { createJournal(); },
      isPrimary: true,
    },
  ];

  // Add Admin card
  if (profile?.role === 'admin') {
    featureCards.unshift({
      id: 'admin',
      title: 'Admin Console',
      description: 'Manage users, content, and platform analytics',
      detail: 'Administrative controls',
 icon: <ShieldCheck className="h-5 w-5" weight="duotone" />,
      color: 'amber',
      onClick: () => { router.push('/admin'); },
    });
  }

  // Add teacher/student specific cards
  if (profile?.role === 'teacher') {
    featureCards.push({
      id: 'classes',
      title: 'My Classes',
      description: 'Manage your classes and students',
      detail: 'Create assignments & track progress',
 icon: <UsersThree className="h-5 w-5" weight="duotone" />,
      color: 'green' as ColorVariant,
      onClick: () => { router.push('/teacher/classes'); },
    });
  } else if (profile?.role === 'student') {
    featureCards.push({
      id: 'join',
      title: 'Join a Class',
      description: 'Enter a class code from your teacher',
      detail: 'Access assignments & get help',
 icon: <GraduationCap className="h-5 w-5" weight="duotone" />,
      color: 'green' as ColorVariant,
      onClick: () => { router.push('/student/join'); },
    });
  }

  const formatPomodoroTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show landing page for non-authenticated users (or while still checking auth with a referral/waitlist link).
  // Unified into a single code path so the component instance persists through auth loading,
  // preventing state resets (e.g., waitlist dialog closing) when authLoading transitions to false.
  if (!user) {
    if (authLoading && !searchParams.get('ref') && !searchParams.get('waitlist')) {
      return (
 <div className="min-h-screen bg-background flex">
          {/* Skeleton sidebar */}
 <div className="w-[300px] h-screen p-4 flex flex-col gap-4" style={{ backgroundColor: '#F5F8F7' }}>
 <Skeleton className="h-8 w-24" />
 <div className="space-y-2 mt-4">
 <Skeleton className="h-9 w-full rounded-lg" />
 <Skeleton className="h-9 w-full rounded-lg" />
 <Skeleton className="h-9 w-full rounded-lg" />
            </div>
 <div className="mt-auto space-y-2">
 <Skeleton className="h-4 w-3/4" />
 <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
          {/* Skeleton main content */}
 <div className="flex-1 flex items-start justify-center pt-[12vh] px-8">
 <div className="w-full max-w-4xl space-y-6">
 <div className="space-y-2">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-7 w-64" />
              </div>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
 <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
 <div className="space-y-2 mt-6">
 <Skeleton className="h-4 w-20" />
                {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return <AgoraLandingPage />;
  }

  return (
 <div className="min-h-screen flex" style={{ backgroundColor: '#F5F8F7' }}>
      {/* Sidebar */}
      <motion.aside
        layout
 className={cn(
          "fixed left-0 top-0 h-full flex flex-col transition-all duration-300 ease-out z-50",
          sidebarCollapsed ? "w-16" : "w-[300px]"
        )}
        style={{ backgroundColor: '#F5F8F7' }}>
        {/* Sidebar Inner */}
 <div className="flex flex-col h-full py-[27px] px-[25px] justify-between">
          {/* Top Section */}
 <div className="flex flex-col gap-[30px]">
            {/* Logo + Search */}
 <div className="flex flex-col gap-[30px]">
              {/* Logo */}
              {sidebarCollapsed ? (
                <button
                  onClick={() => setSidebarCollapsed(false)}
 className="flex items-center justify-center"
                >
                  <Logo size="sm" />
                </button>
              ) : (
 <div className="flex items-center justify-between">
                  <Logo size="sm" showText />
                  <button
                    onClick={() => setSidebarCollapsed(true)}
 className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
                    style={{ color: '#06313A' }}
                  >
 <CaretLeft className="h-4 w-4" weight="duotone" />
                  </button>
                </div>
              )}

              {/* Search Bar */}
              {!sidebarCollapsed && (
                <div
 className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] border"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#E7E7E7', boxShadow: '0px 1px 1px 0px rgba(165, 165, 165, 0.25)' }}
                >
 <MagnifyingGlass className="w-[15px] h-[15px] flex-shrink-0" style={{ color: '#B8B8B4' }} />
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setMagnifyingGlassQuery(e.target.value)}
 className="flex-1 text-[15px] bg-transparent outline-none placeholder:text-[#B8B4B4]"
                    style={{ fontFamily: 'Inter, sans-serif', color: '#06313A' }}
                    data-search-input
                  />
                  <div
 className="flex items-center justify-center rounded-[5px] px-[7px]"
                    style={{ backgroundColor: '#F5F8F7' }}
                  >
 <span className="text-[20px] font-light" style={{ fontFamily: 'Manrope, sans-serif', color: '#ACB4B6' }}>/</span>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Navigation */}
 <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setActiveView('home')}
 className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left",
                  activeView === 'home'
                    ? "bg-[#FCFCFC]"
                    : "hover:bg-white/60"
                )}
                style={{ boxShadow: activeView === 'home' ? '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' : 'none' }}
              >
 <House className="h-4 w-4 flex-shrink-0" weight="duotone" style={{ color: '#06313A' }} />
 {!sidebarCollapsed && <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>Home</span>}
              </button>
              <button
                onClick={() => setActiveView('boards')}
 className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left",
                  activeView === 'boards'
                    ? "bg-[#FCFCFC]"
                    : "hover:bg-white/60"
                )}
                style={{ boxShadow: activeView === 'boards' ? '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' : 'none' }}
              >
 <FolderOpen className="h-4 w-4 flex-shrink-0" weight="duotone" style={{ color: '#05313A' }} />
 {!sidebarCollapsed && <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>My Boards</span>}
              </button>
              <button
                onClick={() => setActiveView('journals')}
 className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left",
                  activeView === 'journals'
                    ? "bg-[#FCFCFC]"
                    : "hover:bg-white/60"
                )}
                style={{ boxShadow: activeView === 'journals' ? '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' : 'none' }}
              >
 <BookOpenText className="h-4 w-4 flex-shrink-0" weight="duotone" style={{ color: '#06313A' }} />
 {!sidebarCollapsed && <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>My Journals</span>}
              </button>
              <button
                onClick={() => router.push('/annotate/files')}
 className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left hover:bg-white/60"
              >
 <HighlighterCircle className="h-4 w-4 flex-shrink-0" weight="duotone" style={{ color: '#06313A' }} />
 {!sidebarCollapsed && <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>My Annotations</span>}
              </button>
              <button
                onClick={() => router.push('/knowledge')}
 className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left hover:bg-white/60"
              >
 <Lightning className="h-4 w-4 flex-shrink-0" weight="duotone" style={{ color: '#06313A' }} />
 {!sidebarCollapsed && <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>Integrations</span>}
              </button>
            </div>

            {/* Tools Section */}
            {!sidebarCollapsed && (
              <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
 <CollapsibleTrigger className="flex items-center justify-between w-full px-2.5 py-1">
 <span className="text-[13px]" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>Tools</span>
 <CaretDown className="h-3 w-3" style={{ color: '#668186' }} />
                </CollapsibleTrigger>
 <CollapsibleContent className="mt-[5px]">
                  <button
                    onClick={() => setPomodoroActive(!pomodoroActive)}
 className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left hover:bg-white/60"
                    style={{ boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' }}
                  >
 <Timer className="h-[15px] w-[15px] flex-shrink-0" weight="duotone" style={{ color: '#05313A' }} />
 <span className="text-[15px] flex-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>Pomodoro</span>
                    {pomodoroActive && (
 <span className="text-xs font-mono" style={{ color: '#05313A' }}>{formatPomodoroTime(pomodoroTime)}</span>
                    )}
                  </button>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Settings Section */}
            {!sidebarCollapsed && (
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
 <CollapsibleTrigger className="flex items-center justify-between w-full px-2.5 py-1">
 <span className="text-[13px]" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>Settings</span>
 <CaretDown className="h-3 w-3" style={{ color: '#668186' }} />
                </CollapsibleTrigger>
 <CollapsibleContent className="space-y-[5px] mt-[5px]">
                  {user && (
                    <button
                      onClick={() => router.push('/billing')}
 className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left hover:bg-white/60"
                      style={{ boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' }}
                    >
 <CreditCard className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" style={{ color: '#05313A' }} />
 <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>Plans & Usage</span>
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/settings')}
 className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left hover:bg-white/60"
                    style={{ boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' }}
                  >
 <GearSix className="h-[15px] w-[15px] flex-shrink-0" weight="duotone" style={{ color: '#05313A' }} />
 <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>Preferences</span>
                  </button>
                  <button
                    onClick={() => sileo.info({ title: 'Help center coming soon!' })}
 className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[10px] transition-all duration-150 text-left hover:bg-white/60"
                    style={{ boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' }}
                  >
 <Question className="h-[15px] w-[15px] flex-shrink-0" weight="duotone" style={{ color: '#05313A' }} />
 <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>Help</span>
                  </button>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* Bottom Section - Usage + Profile */}
 <div className="flex flex-col gap-2.5">
            {/* Usage indicators */}
            {!sidebarCollapsed && user && (
              <div
 className="rounded-[10px] p-[15px_13px] space-y-2.5"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' }}
              >
                <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-[13px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>Boards</span>
 <span className="text-[10px]" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>
                      {isAdmin ? '\u221E' : `${FREE_BOARD_LIMIT - whiteboards.length}/${FREE_BOARD_LIMIT} remaining`}
                    </span>
                  </div>
                  {!isAdmin && (
 <div className="h-1 rounded-full" style={{ backgroundColor: '#F5F8F7' }}>
                      <div
 className="h-full rounded-full"
                        style={{ backgroundColor: '#05313A', width: `${(whiteboards.length / FREE_BOARD_LIMIT) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-[13px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>Journals</span>
 <span className="text-[10px]" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>
                      {isAdmin ? '\u221E' : `${FREE_JOURNAL_LIMIT - journalCount}/${FREE_JOURNAL_LIMIT} remaining`}
                    </span>
                  </div>
                  {!isAdmin && (
 <div className="h-1 rounded-full" style={{ backgroundColor: '#F5F8F7' }}>
                      <div
 className="h-full rounded-full"
                        style={{ backgroundColor: '#05313A', width: `${(journalCount / FREE_JOURNAL_LIMIT) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User Profile */}
            {!sidebarCollapsed && (
              <div
 className="rounded-[10px] p-[15px_13px]"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)' }}
              >
                {user ? (
                  <button
                    onClick={() => router.push('/profile')}
 className="w-full flex items-center justify-between"
                  >
 <div className="flex items-center gap-2.5">
                      <div
 className="w-[35px] h-[35px] rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden"
                        style={{ backgroundColor: '#06313A', color: '#FFFFFF' }}
                      >
                        {profile?.full_name
                          ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                          : user.email?.substring(0, 2).toUpperCase()}
                      </div>
 <div className="text-left">
 <p className="text-[13px] font-medium" style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}>
                          {profile?.full_name || user.email?.split('@')[0]}
                        </p>
 <p className="text-[10px] capitalize" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>
                          {profile?.role || 'User'}
                        </p>
                      </div>
                    </div>
                    {/* Settings icon */}
 <img src="/dashboard/user-menu.svg" alt="" className="w-[29px] h-[30px]" />
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/login')}
 className="w-full text-[15px] text-left"
                    style={{ fontFamily: 'Manrope, sans-serif', color: '#05313A' }}
                  >
                    Sign in
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
 <main className={cn(
        "flex-1 transition-all duration-300 ease-out",
        sidebarCollapsed ? "ml-16" : "ml-[300px]"
      )}>
        <AnimatePresence mode="wait">
        {activeView === 'boards' ? (
          /* My Boards View */
          <motion.div
            key="boards"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
 <div className="max-w-6xl mx-auto px-8 py-10">
 <div className="flex items-center justify-between mb-8">
              <div>
 <h1 className="text-2xl font-bold text-foreground tracking-tight">My Boards</h1>
 <p className="text-sm text-muted-foreground mt-1">All your whiteboards in one place</p>
              </div>
 <div className="flex items-center gap-3">
                {/* View mode toggle */}
 <div className="flex items-center bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
 className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === 'grid' ? "bg-card shadow-sm" : "hover:bg-card/50"
                    )}
                  >
 <GridNine className="w-4 h-4" weight="duotone" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
 className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === 'list' ? "bg-card shadow-sm" : "hover:bg-card/50"
                    )}
                  >
 <ListBullets className="w-4 h-4" weight="duotone" />
                  </button>
                </div>

                {/* Filter dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm" className="gap-2">
 <Funnel className="w-4 h-4" weight="duotone" />
                      {filterType === 'all' ? 'All' : filterType === 'favorites' ? 'Favorites' : filterType === 'recent' ? 'Recent' : 'Archived'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setFilterType('all')}>All Boards</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterType('favorites')}>Favorites</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilterType('recent')}>Recent</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilterType('archived')}>Archived</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* MagnifyingGlass */}
 <div className="relative w-64">
 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" weight="duotone" />
                  <Input
                    type="text"
                    placeholder=" Search boards..."
                    value={searchQuery}
                    onChange={(e) => setMagnifyingGlassQuery(e.target.value)}
 className="pl-9 bg-card border-border"
                    data-search-input
                  />
                </div>
              </div>
            </div>

            {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
 <div key={i} className="bg-card rounded-xl p-4 animate-pulse border border-border">
 <div className="aspect-[4/3] bg-muted rounded-lg mb-4" />
 <div className="h-5 bg-muted rounded w-3/4 mb-2" />
 <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredBoards.length === 0 && !searchQuery ? (
              /* Empty State */
 <div className="flex flex-col items-center justify-center py-20">
 <div className="empty-state-card rounded-2xl p-12 text-center max-w-md w-full">
 <div className="icon-container icon-container-lg icon-container-green mx-auto mb-5">
 <PencilLine className="w-6 h-6" weight="duotone" />
                  </div>
 <h2 className="text-lg font-bold text-foreground mb-2">Create your first board</h2>
 <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Start with a blank whiteboard and draw, write equations, or get AI tutoring help.
                  </p>
 <Button onClick={() => createWhiteboard()} size="lg" className="px-6">
 <Plus className="w-4 h-4" weight="duotone" />
                    New Board
                  </Button>
                </div>
              </div>
            ) : filteredBoards.length === 0 && searchQuery ? (
 <div className="flex flex-col items-center justify-center py-20">
 <div className="text-center">
 <MagnifyingGlass className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" weight="duotone" />
 <h2 className="text-lg font-bold text-foreground mb-2">No boards found</h2>
 <p className="text-sm text-muted-foreground">
                    No boards match "{searchQuery}"
                  </p>
                </div>
              </div>
            ) : (
 <div className={cn(
                viewMode === 'grid'
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                  : "space-y-2"
              )}>
                {/* Create New Card */}
                {viewMode === 'grid' && (
                  <button
                    onClick={() => createWhiteboard()}
 className="empty-state-card rounded-xl aspect-[4/3] flex flex-col items-center justify-center gap-3 cursor-pointer"
                  >
 <div className="icon-container icon-container-green">
 <Plus className="w-5 h-5" weight="duotone" />
                    </div>
 <span className="text-sm font-medium text-muted-foreground">New Board</span>
                  </button>
                )}

                {filteredBoards.map((board) => (
                  viewMode === 'grid' ? (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      key={board.id}
 className="group board-card bg-card rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => router.push(`/board/${board.id}`)}
                    >
 <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                        {board.preview ? (
                          <img
                            src={board.preview}
                            alt={board.title}
 className="w-full h-full object-cover"
                          />
                        ) : (
 <div className="flex items-center justify-center h-full">
 <PencilLine className="w-10 h-10 text-muted-foreground/30" weight="duotone" />
                          </div>
                        )}
                        {/* Board type badge */}
                        {board.metadata?.boardType && (
 <div className="absolute top-2 left-2 px-2 py-1 bg-card/90 backdrop-blur-sm rounded-md flex items-center gap-1.5 text-xs text-muted-foreground">
                            {boardTypeIcons[board.metadata.boardType]}
 <span className="capitalize">{board.metadata.boardType}</span>
                          </div>
                        )}
                        {/* Favorite indicator */}
                        {board.is_favorite && (
 <div className="absolute top-2 right-2">
 <Star className="w-4 h-4 text-amber-500 fill-amber-500" weight="duotone" />
                          </div>
                        )}
                        {/* Quick actions on hover */}
 <div className="absolute inset-0 bg-foreground/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
 className="shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateWhiteboard(board);
                            }}
                          >
 <Copy className="w-4 h-4" weight="duotone" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
 className="shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareBoardId(board.id);
                              setShareBoardTitle(board.title);
                              setShareDialogOpen(true);
                            }}
                          >
 <ShareNetwork className="w-4 h-4" weight="duotone" />
                          </Button>
                        </div>
                      </div>
 <div className="p-4">
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-foreground truncate text-sm">
                              {board.title}
                            </h3>
 <p className="text-xs text-muted-foreground mt-1">
                              {getFriendlyTimestamp(new Date(board.updated_at))}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
 className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                              >
 <DotsThree className="w-4 h-4" weight="duotone" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(board.id, board.is_favorite || false);
                              }}>
                                {board.is_favorite ? (
                                  <>
 <Star className="w-4 h-4 mr-2" weight="duotone" />
                                    Remove from favorites
                                  </>
                                ) : (
                                  <>
 <Star className="w-4 h-4 mr-2" weight="duotone" />
                                    Add to favorites
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setRenameId(board.id);
                                setRenameTitle(board.title);
                              }}>
 <PencilSimple className="w-4 h-4 mr-2" weight="duotone" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                duplicateWhiteboard(board);
                              }}>
 <Copy className="w-4 h-4 mr-2" weight="duotone" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setShareBoardId(board.id);
                                setShareBoardTitle(board.title);
                                setShareDialogOpen(true);
                              }}>
 <ShareNetwork className="w-4 h-4 mr-2" weight="duotone" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
 className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteWhiteboard(board.id);
                                }}
                              >
 <Trash className="w-4 h-4 mr-2" weight="duotone" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    /* List view */
                    <div
                      key={board.id}
 className="group flex items-center gap-4 p-3 bg-card rounded-lg border border-border hover:border-primary/20 cursor-pointer transition-all"
                      onClick={() => router.push(`/board/${board.id}`)}
                    >
 <div className="w-16 h-12 bg-muted rounded-md overflow-hidden flex-shrink-0">
                        {board.preview ? (
 <img src={board.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
 <div className="flex items-center justify-center h-full">
 <PencilLine className="w-5 h-5 text-muted-foreground/30" weight="duotone" />
                          </div>
                        )}
                      </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold text-sm text-foreground truncate" title={board.title}>{board.title}</h3>
                          {board.is_favorite && (
 <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" weight="duotone" />
                          )}
                        </div>
 <p className="text-xs text-muted-foreground">{getFriendlyTimestamp(new Date(board.updated_at))}</p>
                      </div>
 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                          e.stopPropagation();
                          setShareBoardId(board.id);
                          setShareBoardTitle(board.title);
                          setShareDialogOpen(true);
                        }}>
 <ShareNetwork className="w-4 h-4" weight="duotone" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <Button variant="ghost" size="icon" className="h-8 w-8">
 <DotsThree className="w-4 h-4" weight="duotone" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setRenameId(board.id);
                              setRenameTitle(board.title);
                            }}>
 <PencilSimple className="w-4 h-4 mr-2" weight="duotone" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              duplicateWhiteboard(board);
                            }}>
 <Copy className="w-4 h-4 mr-2" weight="duotone" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
 className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteWhiteboard(board.id);
                              }}
                            >
 <Trash className="w-4 h-4 mr-2" weight="duotone" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Assignments Section for Students */}
            {profile?.role === 'student' && assignments.length > 0 && (
 <div className="mt-12">
 <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
 <BookOpenText className="h-5 w-5" weight="duotone" />
                  My Assignments
                </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {assignments.map((submission: any) => (
                    <div
                      key={submission.id}
 className="group bg-card rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-200 cursor-pointer"
                      onClick={() => router.push(`/board/${submission.student_board_id}`)}
                    >
 <div className="aspect-video bg-muted relative">
                        {submission.student_board?.preview ? (
                          <img
                            src={submission.student_board.preview}
                            alt={submission.assignment.title}
 className="w-full h-full object-cover"
                          />
                        ) : (
 <div className="flex items-center justify-center h-full">
 <BookOpenText className="w-12 h-12 text-muted-foreground/50" weight="duotone" />
                          </div>
                        )}
 <div className={cn(
                          "absolute top-3 right-3 px-2.5 py-1 text-xs font-medium rounded-full",
                          submission.status === 'submitted'
                            ? 'bg-emerald-100 text-emerald-700  '
                            : submission.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-700  '
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {submission.status === 'submitted' ? 'Submitted' :
                           submission.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </div>
                      </div>
 <div className="p-4">
 <h3 className="font-semibold text-foreground">
                          {submission.assignment.title}
                        </h3>
 <p className="text-sm text-muted-foreground mt-1">
                          {submission.assignment.class?.name}
                        </p>
                        {submission.assignment.due_date && (
 <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2">
 <Clock className="w-3.5 h-3.5" weight="duotone" />
                            Due {getFriendlyTimestamp(new Date(submission.assignment.due_date))}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Classroom Section for Students + Admins */}
            {(profile?.role === 'student' || profile?.role === 'admin') && (classroomConnected ? (
 <div className="mt-12">
                {/* Header with sync + manage */}
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
 <GraduationCap className="h-5 w-5" weight="duotone" />
                    Google Classroom
                  </h2>
 <div className="flex items-center gap-2">
                    {classroomSyncing && (
 <span className="text-xs text-muted-foreground flex items-center gap-1">
 <CircleNotch className="w-3 h-3 animate-spin" weight="duotone" />
                        Syncing...
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
 className="text-muted-foreground gap-1.5"
                      onClick={async () => {
                        setClassroomSyncing(true);
                        try {
                          await fetch('/api/knowledge/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google_classroom' }) });
                          await fetchClassroomAssignments(classroomCourseFilter);
                          sileo.success({ title: 'Classroom synced' });
                        } catch { sileo.error({ title: 'Sync failed' }); }
                        setClassroomSyncing(false);
                      }}
                      disabled={classroomSyncing}
                    >
 <ArrowsClockwise className="w-3.5 h-3.5" weight="duotone" />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
 className="text-muted-foreground gap-1.5"
                      onClick={() => router.push('/knowledge')}
                    >
                      Manage
 <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Token expiry warning */}
                {classroomExpired && (
 <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-3">
 <Warning className="w-5 h-5 text-amber-600 shrink-0" weight="duotone" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-amber-800 ">Connection expired</p>
 <p className="text-xs text-amber-700 ">Your Google Classroom token has expired. Reconnect to keep syncing.</p>
                    </div>
 <Button size="sm" variant="outline" className="shrink-0" onClick={() => router.push('/knowledge')}>
                      Reconnect
                    </Button>
                  </div>
                )}

                {/* Stats bar */}
                {classroomStats.total > 0 && (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
 <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
 <ClockCountdown className="w-4 h-4 text-blue-600 " weight="duotone" />
                      </div>
                      <div>
 <p className="text-lg font-bold text-foreground leading-none">{classroomStats.upcoming}</p>
 <p className="text-[10px] text-muted-foreground mt-0.5">Upcoming</p>
                      </div>
                    </div>
 <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center">
 <CheckCircle className="w-4 h-4 text-emerald-600 " weight="duotone" />
                      </div>
                      <div>
 <p className="text-lg font-bold text-foreground leading-none">{classroomStats.turned_in}</p>
 <p className="text-[10px] text-muted-foreground mt-0.5">Turned In</p>
                      </div>
                    </div>
 <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center">
 <Eye className="w-4 h-4 text-purple-600 " weight="duotone" />
                      </div>
                      <div>
 <p className="text-lg font-bold text-foreground leading-none">{classroomStats.graded}</p>
 <p className="text-[10px] text-muted-foreground mt-0.5">Graded</p>
                      </div>
                    </div>
 <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
 <Warning className="w-4 h-4 text-red-600 " weight="duotone" />
                      </div>
                      <div>
 <p className="text-lg font-bold text-foreground leading-none">{classroomStats.missing}</p>
 <p className="text-[10px] text-muted-foreground mt-0.5">Missing</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Course filter */}
                {classroomCourses.length > 1 && (
 <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                    <button
                      onClick={() => { setClassroomCourseFilter(null); fetchClassroomAssignments(null); }}
 className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                        !classroomCourseFilter
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      All Courses
                    </button>
                    {classroomCourses.map(course => (
                      <button
                        key={course.id}
                        onClick={() => { setClassroomCourseFilter(course.id); fetchClassroomAssignments(course.id); }}
 className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                          classroomCourseFilter === course.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {course.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Assignments list */}
                {classroomAssignments.length > 0 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classroomAssignments.map((item: any) => {
                      const subState = item.metadata?.submission_state;
                      const isTurnedIn = subState === 'TURNED_IN';
                      const isReturned = subState === 'RETURNED';
                      const isLate = item.metadata?.late;
                      const grade = item.metadata?.assigned_grade;
                      const maxPts = item.metadata?.max_points;
                      const dueDate = item.metadata?.due_date;
                      let dueDateStr = '';
                      let isOverdue = false;
                      if (dueDate) {
                        const d = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate.year, dueDate.month - 1, dueDate.day);
                        dueDateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        isOverdue = d < new Date() && !isTurnedIn && !isReturned;
                      }

                      return (
                        <div
                          key={item.id}
 className={cn(
                            "group bg-card rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-md",
                            isOverdue ? "border-red-200 " : "border-border"
                          )}
                        >
 <div className="p-4 pb-3">
 <div className="flex items-start justify-between gap-2">
 <h3 className="font-semibold text-foreground text-sm line-clamp-2 flex-1">
                                {item.title}
                              </h3>
                              {/* Status badge */}
                              {isReturned ? (
 <Badge className="shrink-0 text-[10px] bg-purple-100 text-purple-700 border-0">
                                  {grade != null && maxPts ? `${grade}/${maxPts}` : 'Returned'}
                                </Badge>
                              ) : isTurnedIn ? (
 <Badge className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 border-0">
                                  Turned In
                                </Badge>
                              ) : isOverdue ? (
 <Badge className="shrink-0 text-[10px] bg-red-100 text-red-700 border-0">
                                  {isLate ? 'Late' : 'Missing'}
                                </Badge>
                              ) : maxPts ? (
 <Badge variant="secondary" className="shrink-0 text-[10px]">
                                  {maxPts} pts
                                </Badge>
                              ) : null}
                            </div>
                            {item.metadata?.course_name && (
 <p className="text-xs text-muted-foreground mt-1">
                                {item.metadata.course_name}
                              </p>
                            )}
                            {dueDateStr && (
 <p className={cn(
                                "text-xs flex items-center gap-1.5 mt-2",
                                isOverdue ? "text-red-600  font-medium" : "text-muted-foreground"
                              )}>
 <Clock className="w-3 h-3" weight="duotone" />
                                {isOverdue ? 'Was due' : 'Due'} {dueDateStr}
                              </p>
                            )}
                          </div>
 <div className="px-4 pb-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
 className="flex-1 gap-1.5 text-xs h-8"
                              onClick={() => openClassroomInBoard(item)}
                            >
 <PencilLine className="w-3 h-3" weight="duotone" />
                              Board
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
 className="flex-1 gap-1.5 text-xs h-8"
                              onClick={() => openClassroomInJournal(item)}
                            >
 <BookOpenText className="w-3 h-3" weight="duotone" />
                              Journal
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
 <div className="text-center py-8 bg-card rounded-xl border border-border">
 <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" weight="duotone" />
 <p className="text-sm font-medium text-foreground">No assignments found</p>
 <p className="text-xs text-muted-foreground mt-1">
                      {classroomCourseFilter ? 'Try selecting a different course' : 'Your classroom assignments will appear here after syncing'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
 <div className="mt-12">
                <div
 className="bg-card rounded-xl border border-dashed border-border p-6 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => router.push('/knowledge')}
                >
 <div className="icon-container icon-container-lg icon-container-green shrink-0">
 <GraduationCap className="w-5 h-5" weight="duotone" />
                  </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-foreground">Connect Google Classroom</h3>
 <p className="text-sm text-muted-foreground mt-0.5">
                      See your assignments here and open them in a board or journal
                    </p>
                  </div>
 <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" weight="duotone" />
                </div>
              </div>
            ))}
          </div>
          </motion.div>
        ) : activeView === 'journals' ? (
          /* My Journals View */
          <motion.div
            key="journals"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
 <div className="max-w-6xl mx-auto px-8 py-10">
 <div className="flex items-center justify-between mb-8">
              <div>
 <h1 className="text-2xl font-bold text-foreground tracking-tight">My Journals</h1>
 <p className="text-sm text-muted-foreground mt-1">All your journals in one place</p>
              </div>
 <Button onClick={() => createJournal()} size="sm" className="gap-2">
 <Plus className="w-4 h-4" />
                New Journal
              </Button>
            </div>

            {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
 <div key={i} className="bg-card rounded-xl p-4 animate-pulse border border-border">
 <div className="h-5 bg-muted rounded w-3/4 mb-3" />
 <div className="h-4 bg-muted rounded w-full mb-2" />
 <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : journals.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20">
 <div className="empty-state-card rounded-2xl p-12 text-center max-w-md w-full">
 <div className="icon-container icon-container-lg icon-container-green mx-auto mb-5">
 <BookOpenText className="w-6 h-6" weight="duotone" />
                  </div>
 <h3 className="text-base font-semibold text-foreground mb-2">No journals yet</h3>
 <p className="text-sm text-muted-foreground mb-6">Create your first journal to start writing with AI-powered study tools.</p>
 <Button onClick={() => createJournal()} size="lg" className="px-6">
 <Plus className="w-4 h-4 mr-2" />
                    Create Journal
                  </Button>
                </div>
              </div>
            ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {journals.map((journal) => {
                  let snippet = '';
                  if (journal.content && journal.content.length > 0) {
                    const first = journal.content[0];
                    if (typeof first === 'string') snippet = first.slice(0, 120);
                    else if (first?.content) snippet = first.content.slice(0, 120);
                  }
                  return (
                    <div
                      key={journal.id}
 className="group bg-card border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors cursor-pointer relative"
                      onClick={() => router.push(`/journal/${journal.id}`)}
                    >
 <div className="flex items-start justify-between mb-2">
 <h3 className="text-[13px] font-semibold text-foreground truncate pr-8">{journal.title}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <button className="p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3">
 <DotsThree className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
 className="text-destructive"
                              onClick={() => deleteJournal(journal.id)}
                            >
 <Trash className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
 <p className="text-[12px] text-muted-foreground line-clamp-3 mb-3">
                        {snippet || 'Empty journal'}
                      </p>
 <span className="text-[11px] text-muted-foreground/60">
                        {getFriendlyTimestamp(new Date(journal.updated_at))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </motion.div>
        ) : (
          /* Dashboard Home View */
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
 className="relative min-h-screen"
            style={{ backgroundColor: '#F5F8F7' }}
          >
          {/* Page title - positioned above the white card */}
 <div className="pl-[19px] pt-[30px] pb-[18px]">
 <h2 className="text-[20px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>Home</h2>
          </div>

          {/* Main white content card */}
          <div
 className="rounded-[20px] ml-[-7px] mr-0"
            style={{
              backgroundColor: '#FFFFFF',
              boxShadow: '0px 1px 4px 0px rgba(210, 203, 203, 0.25)',
              minHeight: 'calc(100vh - 75px)',
            }}
          >
            {/* Greeting */}
            <div style={{ padding: '76px 0 0 70px' }}>
 <p className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>
                {greeting}{user ? `, ${profile?.full_name?.split(' ')[0] || 'there'}` : ''}
              </p>
 <h1 className="text-[30px] mt-[9px]" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, color: '#07323B' }}>
                What are we working on today? :)
              </h1>
            </div>

            {/* Feature Cards Row */}
 <div className="grid grid-cols-4 gap-[15px]" style={{ padding: '41px 70px 0 70px' }}>
              {featureCards.map((card, index) => {
                const gradientMap: Record<string, string> = {
                  blue: 'linear-gradient(180deg, #4F88F1 0%, #90B6FC 100%)',
                  green: 'linear-gradient(180deg, #3AD53F 0%, #87FB8B 100%)',
                  purple: 'linear-gradient(180deg, #EB8633 0%, #FFCFA8 100%)',
                  amber: 'linear-gradient(180deg, #7929F9 0%, #B588FE 100%)',
                };
                const gradient = gradientMap[card.color] || gradientMap.blue;
                const isLast = card.id === 'join';
                return (
                  <motion.button
                    key={card.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={card.onClick}
                    disabled={(creating && card.id === 'whiteboard') || card.comingSoon}
 className="text-left rounded-[15px] p-[5px] transition-all duration-150 hover:scale-[1.01] disabled:cursor-not-allowed"
                    style={{ backgroundColor: isLast ? '#F4F7F6' : '#F5F8F7' }}
                  >
                    <div
 className="rounded-[10px] flex flex-col gap-[15px] h-full"
                      style={{ backgroundColor: '#FFFFFF', boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)', padding: '20px 11px' }}
                    >
                      <div
 className="w-[29px] h-[30px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                        style={{ background: gradient }}
                      >
 <div className="text-white">{card.icon}</div>
                      </div>
 <h3 className="text-[20px] font-medium leading-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>
                        {card.title}
                      </h3>
 <p className="text-[17px] leading-snug" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, color: 'rgba(6, 49, 58, 0.6)' }}>
                        {card.description}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Divider line */}
            <div style={{ margin: '30px 70px 0 70px', height: 1, backgroundColor: 'rgba(227, 227, 227, 0.6)' }} />

            {/* Recents Header */}
 <div className="flex items-center justify-between" style={{ padding: '14px 70px 0 70px' }}>
 <span className="text-[15px]" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, color: '#06313A' }}>Recents</span>
              <button
                onClick={() => setActiveView('boards')}
 className="text-[15px] transition-colors hover:opacity-80"
                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, color: 'rgba(6, 49, 58, 0.6)' }}
              >
                View All →
              </button>
            </div>

            {/* Recents Cards Grid */}
            {user && recentItems.length > 0 && (
 <div className="grid grid-cols-4 gap-[15px] pb-[40px]" style={{ padding: '30px 70px 40px 70px' }}>
                {recentItems.slice(0, 4).map((item, index) => (
                  <motion.button
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    onClick={() => router.push(item.type === 'board' ? `/board/${item.id}` : `/journal/${item.id}`)}
 className="text-left rounded-[15px] border p-[10px] flex flex-col transition-all duration-150 hover:shadow-md relative"
                    style={{ backgroundColor: '#F5F8F7', borderColor: '#E7E7E7' }}
                  >
                    {/* Preview area */}
                    <div
 className="w-full rounded-[10px] overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: '#FFFFFF', height: 213 }}
                    >
                      {item.type === 'board' && item.preview ? (
 <img src={item.preview} alt="" className="w-full h-full object-cover" />
                      ) : (
 <div className="w-full h-full flex items-center justify-center">
 <BookOpenText className="w-8 h-8" weight="duotone" style={{ color: '#05313A', opacity: 0.15 }} />
                        </div>
                      )}
                    </div>
                    {/* Title */}
 <h3 className="text-[20px] font-medium truncate mt-[20px]" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A', letterSpacing: '-0.02em' }}>
                      {item.title}
                    </h3>
                    {/* Timestamp + badge row */}
 <div className="flex items-center justify-between mt-[8px]">
 <span className="text-[12px]" style={{ fontFamily: 'Inter, sans-serif', color: '#6A8389', letterSpacing: '-0.02em' }}>
                        {getFriendlyTimestamp(new Date(item.updated_at))}
                      </span>
                      <span
 className="rounded-[30px] border px-[5px] py-[3px] text-[10px] font-light"
                        style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)', backgroundColor: '#FFFFFF', borderColor: '#F1F1F1', letterSpacing: '-0.02em' }}
                      >
                        {item.type === 'board' ? 'Board' : 'Journal'}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Empty state for recents */}
            {user && recentItems.length === 0 && (
 <div className="flex items-center justify-center py-20" style={{ padding: '80px 70px' }}>
 <div className="text-center">
 <PencilLine className="w-10 h-10 mx-auto mb-4" weight="duotone" style={{ color: '#05313A', opacity: 0.2 }} />
 <p className="text-[17px]" style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(6, 49, 58, 0.6)' }}>
                    No recent items yet. Create a board or journal to get started!
                  </p>
                </div>
              </div>
            )}
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Pomodoro Timer Popup */}
      <AnimatePresence>
      {pomodoroActive && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
 className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-4 z-40"
        >
 <div className="flex items-center gap-2">
 <Timer className={cn(
              "w-5 h-5",
              pomodoroMode === 'work' ? "text-primary" : "text-green-500"
            )} weight="duotone" />
 <span className="text-2xl font-mono font-bold">{formatPomodoroTime(pomodoroTime)}</span>
          </div>
 <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setPomodoroPaused(!pomodoroPaused)}
              title={pomodoroPaused ? "Resume" : "Pause"}
            >
              {pomodoroPaused ? (
 <Play className="w-4 h-4" weight="duotone" />
              ) : (
 <Pause className="w-4 h-4" weight="duotone" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setPomodoroTime(pomodoroMode === 'work' ? 25 * 60 : 5 * 60);
                setPomodoroPaused(false);
              }}
              title="Reset"
            >
 <ArrowCounterClockwise className="w-4 h-4" weight="duotone" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setPomodoroActive(false);
                setPomodoroPaused(false);
                setPomodoroTime(25 * 60);
                setPomodoroMode('work');
              }}
              title="Stop"
            >
 <X className="w-4 h-4" weight="duotone" />
            </Button>
          </div>
 <Badge variant="secondary" className="text-xs">
            {pomodoroPaused ? 'Paused' : pomodoroMode === 'work' ? 'Focus' : 'Break'}
          </Badge>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Quick Note Dialog */}
      <Dialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen}>
        <DialogContent>
          <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Note className="w-5 h-5" weight="duotone" />
              Quick Note
            </DialogTitle>
            <DialogDescription>
              Capture a quick thought or idea.
            </DialogDescription>
          </DialogHeader>
 <div className="py-4">
            <textarea
              value={quickNoteContent}
              onChange={(e) => setQuickNoteContent(e.target.value)}
              placeholder="What's on your mind?"
 className="w-full h-32 p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickNoteOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              sileo.success({ title: 'Note saved!' });
              setQuickNoteContent('');
              setQuickNoteOpen(false);
            }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Board</DialogTitle>
            <DialogDescription>
              Enter a new name for your whiteboard.
            </DialogDescription>
          </DialogHeader>
 <div className="py-4">
 <Label htmlFor="name" className="mb-2 block">Name</Label>
            <Input
              id="name"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
            <Button onClick={handleRename}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareBoardId && (
        <ShareBoardDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          boardId={shareBoardId}
          boardTitle={shareBoardTitle}
        />
      )}

      {/* Template Selection Dialog */}
      <TemplateSelectionDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onTemplateSelect={handleTemplateSelect}
        creating={creating}
      />
    </div>
  );
}
