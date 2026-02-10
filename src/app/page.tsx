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
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from "sonner";
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

// Feature card color variants - muted, professional creme palette
type ColorVariant = 'green' | 'blue' | 'purple' | 'amber';

const colorVariants: Record<ColorVariant, { iconBg: string; iconColor: string; hoverBorder: string; accentBg: string; accentBar: string }> = {
  green: {
    iconBg: 'bg-[oklch(0.92_0.08_145)]',
    iconColor: 'text-[oklch(0.40_0.16_145)]',
    hoverBorder: 'group-hover:border-[oklch(0.82_0.08_145)]',
    accentBg: 'bg-[oklch(0.92_0.08_145)]',
    accentBar: 'border-l-[oklch(0.52_0.18_145)]',
  },
  blue: {
    iconBg: 'bg-[oklch(0.92_0.08_220)]',
    iconColor: 'text-[oklch(0.42_0.17_220)]',
    hoverBorder: 'group-hover:border-[oklch(0.82_0.08_220)]',
    accentBg: 'bg-[oklch(0.92_0.08_220)]',
    accentBar: 'border-l-[oklch(0.48_0.17_220)]',
  },
  purple: {
    iconBg: 'bg-[oklch(0.92_0.08_285)]',
    iconColor: 'text-[oklch(0.42_0.18_285)]',
    hoverBorder: 'group-hover:border-[oklch(0.82_0.08_285)]',
    accentBg: 'bg-[oklch(0.92_0.08_285)]',
    accentBar: 'border-l-[oklch(0.50_0.18_285)]',
  },
  amber: {
    iconBg: 'bg-[oklch(0.93_0.08_70)]',
    iconColor: 'text-[oklch(0.52_0.18_70)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.08_70)]',
    accentBg: 'bg-[oklch(0.93_0.08_70)]',
    accentBar: 'border-l-[oklch(0.72_0.20_70)]',
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
        toast.success('Work session complete! Take a 5-minute break.');
        setPomodoroTime(5 * 60);
        setPomodoroMode('break');
      } else {
        toast.success('Break over! Ready for another session?');
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
      toast.info('Please sign in to continue');
    }
    if (searchParams.get('error') === 'teacher_only') {
      toast.error('Access denied. Only teachers can access the teacher dashboard.');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchWhiteboards();
      fetchJournals();
      if (profile?.role === 'student') {
        fetchAssignments();
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
        toast.error('Failed to fetch whiteboards');
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
      toast.info('Creating temporary board');
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
      setTemplateDialogOpen(false);
      return;
    }

    if (!isAdmin && whiteboards.length >= FREE_BOARD_LIMIT) {
      toast.error(`You've reached the limit of ${FREE_BOARD_LIMIT} boards. Delete one to create a new board.`);
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

      toast.success('Board created');

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
      toast.error('Failed to create whiteboard');
    } finally {
      setCreating(false);
      setTemplateDialogOpen(false);
    }
  }, [creating, user, router, supabase, isAdmin, whiteboards.length]);

  const createWhiteboard = useCallback(() => {
    console.log('createWhiteboard called', { creating, user: !!user, isAdmin, whiteboardsLength: whiteboards.length });
    if (creating) return;

    if (!user) {
      toast.info('Creating temporary board');
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
      return;
    }

    if (!isAdmin && whiteboards.length >= FREE_BOARD_LIMIT) {
      toast.error(`You've reached the limit of ${FREE_BOARD_LIMIT} boards. Delete one to create a new board.`);
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
      toast.error(`You've reached the limit of ${FREE_JOURNAL_LIMIT} journals. Delete one to create a new journal.`);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('journals')
        .insert([{ user_id: user.id, title: 'New Journal', content: [] }])
        .select()
        .single();
      if (error) throw error;
      toast.success('Journal created');
      router.push(`/journal/${data.id}`);
    } catch (error) {
      console.error('Error creating journal:', error);
      toast.error('Failed to create journal');
    }
  }, [user, router, supabase, isAdmin, journals.length]);

  async function deleteJournal(id: string) {
    try {
      const { error } = await supabase
        .from('journals')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setJournals(journals.filter(j => j.id !== id));
      toast.success('Journal deleted');
    } catch (error) {
      console.error('Error deleting journal:', error);
      toast.error('Failed to delete journal');
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
      toast.success('Whiteboard deleted');
    } catch (error) {
      console.error('Error deleting whiteboard:', error);
      toast.error('Failed to delete whiteboard');
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
      toast.success('Board duplicated');
      fetchWhiteboards();
    } catch (error) {
      console.error('Error duplicating whiteboard:', error);
      toast.error('Failed to duplicate whiteboard');
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
      toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
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
      toast.success('Whiteboard renamed');
      setRenameId(null);
    } catch (error) {
      console.error('Error renaming whiteboard:', error);
      toast.error('Failed to rename whiteboard');
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
      id: 'math',
      title: 'Math Document',
      description: 'Type equations with instant solving',
      detail: 'LaTeX support & step-by-step',
      icon: <Calculator className="h-5 w-5" weight="duotone" />,
      color: 'purple',
      onClick: () => { toast.info('Math Document is coming soon!'); },
      comingSoon: true,
    },
    {
      id: 'journal',
      title: 'Journal',
      description: 'Write notes with AI-powered study tools',
      detail: 'Flashcards, Feynman method & more',
      icon: <BookOpenText className="h-5 w-5" weight="duotone" />,
      color: 'green',
      onClick: () => { createJournal(); },
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

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Skeleton sidebar */}
        <div className="w-56 h-screen border-r border-border bg-card p-4 flex flex-col gap-4">
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

  // Show landing page for non-authenticated users
  if (!user) {
    return <AgoraLandingPage />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.aside
        layout
        className={cn(
          "fixed left-0 top-0 h-full flex flex-col transition-all duration-300 ease-out z-50",
          "bg-card border-r border-border",
          sidebarCollapsed ? "w-16" : "w-56"
        )}>
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between">
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center"
            >
              <Logo size="sm" />
            </button>
          ) : (
            <>
              <Logo size="sm" showText />
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
              >
                <CaretLeft className="h-4 w-4" weight="duotone" />
              </button>
            </>
          )}
        </div>

        {/* New Board Dropdown */}
        <div className="px-3 pb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 font-medium",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  sidebarCollapsed ? "justify-center px-2 py-2" : "px-4 py-2"
                )}
              >
                <Plus className="h-4 w-4 flex-shrink-0" weight="duotone" />
                {!sidebarCollapsed && <span className="text-sm">New</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => createWhiteboard()}>
                <PencilLine className="w-4 h-4 mr-2" weight="duotone" />
                New Board
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/board/temp-' + Date.now())}>
                <Lightning className="w-4 h-4 mr-2" weight="duotone" />
                Quick Board
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => createJournal()}>
                <BookOpenText className="w-4 h-4 mr-2" weight="duotone" />
                New Journal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            <button
              onClick={() => setActiveView('home')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left",
                activeView === 'home'
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <House className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
              {!sidebarCollapsed && <span className="text-sm">Home</span>}
            </button>
            <button
              onClick={() => setActiveView('boards')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left",
                activeView === 'boards'
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FolderOpen className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
              {!sidebarCollapsed && <span className="text-sm">My Boards</span>}
            </button>
            <button
              onClick={() => setActiveView('journals')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left",
                activeView === 'journals'
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <BookOpenText className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
              {!sidebarCollapsed && <span className="text-sm">My Journals</span>}
            </button>
          </div>

          {/* Collapsible Tools Section */}
          {!sidebarCollapsed && (
            <Collapsible open={toolsOpen} onOpenChange={setToolsOpen} className="mt-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tools
                {toolsOpen ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                <button
                  onClick={() => setPomodoroActive(!pomodoroActive)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                >
                  <Timer className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
                  <span className="text-sm flex-1">Pomodoro</span>
                  {pomodoroActive && (
                    <span className="text-xs font-mono text-primary">{formatPomodoroTime(pomodoroTime)}</span>
                  )}
                </button>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Collapsible Settings Section */}
          {!sidebarCollapsed && (
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="mt-2">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Settings
                {settingsOpen ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {user && (
                  <button
                    onClick={() => router.push('/billing')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                  >
                    <CreditCard className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
                    <span className="text-sm">Plans & Usage</span>
                  </button>
                )}
                <button
                  onClick={() => router.push('/settings')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                >
                  <GearSix className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
                  <span className="text-sm">Preferences</span>
                </button>
                <button
                  onClick={() => toast.info('Help center coming soon!')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                >
                  <Question className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
                  <span className="text-sm">Help</span>
                </button>
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-border" />

        {/* Secondary Navigation / Footer */}
        <div className="p-3 space-y-1">
          {/* Admin Console - only show here for admin */}
          {profile?.role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                sidebarCollapsed && "justify-center"
              )}
            >
              <ShieldCheck className="h-[18px] w-[18px] flex-shrink-0" weight="duotone" />
              {!sidebarCollapsed && <span className="text-sm">Admin Console</span>}
            </button>
          )}

          {/* Usage indicator */}
          {!sidebarCollapsed && user && (
            <div className="px-3 py-2 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <PencilLine className="w-3 h-3" />
                    Boards
                  </span>
                  <span>{whiteboards.length} / {isAdmin ? '\u221E' : FREE_BOARD_LIMIT}</span>
                </div>
                {!isAdmin && <Progress value={(whiteboards.length / FREE_BOARD_LIMIT) * 100} className="h-1.5" />}
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <BookOpenText className="w-3 h-3" />
                    Journals
                  </span>
                  <span>{journalCount} / {isAdmin ? '\u221E' : FREE_JOURNAL_LIMIT}</span>
                </div>
                {!isAdmin && <Progress value={(journalCount / FREE_JOURNAL_LIMIT) * 100} className="h-1.5" />}
              </div>
            </div>
          )}

          {/* User info / Sign in */}
          {!sidebarCollapsed && (
            <div className="pt-2 mt-2 border-t border-border">
              {user ? (
                <button
                  onClick={() => router.push('/profile')}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {profile?.full_name
                      ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                      : user.email?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {profile?.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'User'}</p>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="w-full px-3 py-2.5 text-sm text-left hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </button>
              )}
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 ease-out",
        sidebarCollapsed ? "ml-16" : "ml-56"
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
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : submission.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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
          >
          <div className="flex items-start justify-center min-h-screen px-8 lg:px-12 pt-[12vh] pb-12">
          <div className="w-full max-w-4xl">
              {/* Greeting */}
              <div className="mb-6">
                <p className="text-[13px] text-muted-foreground">
                  {greeting}{user ? `, ${profile?.full_name?.split(' ')[0] || 'there'}` : ''}
                </p>
                <h1 className="text-xl font-semibold text-foreground tracking-tight mt-0.5" style={{ fontFamily: 'var(--font-sans)' }}>
                  What would you like to work on?
                </h1>
              </div>

              {/* All feature cards in a single grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-8">
                {featureCards.map((card, index) => (
                  <motion.button
                    key={card.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={card.onClick}
                    disabled={(creating && card.id === 'whiteboard') || card.comingSoon}
                    className={cn(
                      "group text-left rounded-lg border border-border bg-card p-3.5 transition-colors duration-100 relative",
                      "hover:bg-muted/40 active:bg-muted/60",
                      "disabled:cursor-not-allowed",
                      card.comingSoon && "opacity-50"
                    )}
                  >
                    {card.comingSoon && (
                      <span className="absolute top-2.5 right-2.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
                    )}
                    <div className="flex items-center gap-2.5 text-muted-foreground mb-2">
                      {card.icon}
                      {card.isPrimary && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-auto">AI</span>
                      )}
                    </div>
                    <h3 className="text-[13px] font-semibold text-foreground leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>{card.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{card.description}</p>
                  </motion.button>
                ))}
              </div>

              {/* Recents — boards + journals */}
              {user && recentItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'var(--font-sans)' }}>Recents</span>
                    <button
                      onClick={() => setActiveView('boards')}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all &rarr;
                    </button>
                  </div>
                  <div className="border border-border rounded-lg bg-card divide-y divide-border">
                    {recentItems.map((item, index) => (
                      <motion.button
                        key={`${item.type}-${item.id}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        onClick={() => router.push(item.type === 'board' ? `/board/${item.id}` : `/journal/${item.id}`)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {/* Thumbnail / icon */}
                        {item.type === 'board' && item.preview ? (
                          <div className="w-10 h-7 rounded overflow-hidden bg-muted flex-shrink-0">
                            <img src={item.preview} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            {item.type === 'board'
                              ? <PencilLine className="w-3.5 h-3.5 text-muted-foreground/50" weight="duotone" />
                              : <BookOpenText className="w-3.5 h-3.5 text-muted-foreground/50" weight="duotone" />
                            }
                          </div>
                        )}
                        {/* Title + snippet */}
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] text-foreground truncate block">{item.title}</span>
                          {item.snippet && (
                            <span className="text-[11px] text-muted-foreground/60 truncate block">{item.snippet}</span>
                          )}
                        </div>
                        {/* Meta */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground/50 uppercase">
                            {item.type === 'board' ? 'Board' : 'Journal'}
                          </span>
                          <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                            {getFriendlyTimestamp(new Date(item.updated_at))}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

          </div>
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
              toast.success('Note saved!');
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
