"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { getStudentAssignments } from '@/lib/api/assignments';
import { ShareBoardDialog } from '@/components/sharing/ShareBoardDialog';
import { getTimeBasedGreeting, getFriendlyTimestamp } from '@/components/dashboard/study-tips';
import {
  Plus,
  Trash2,
  Search,
  Edit2,
  MoreHorizontal,
  Share2,
  Users,
  BookOpen,
  CreditCard,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Home,
  Pencil,
  GraduationCap,
  Clock,
  Calculator,
  Sparkles,
  Star,
  StarOff,
  Copy,
  Filter,
  Grid3X3,
  List,
  Timer,
  Pause,
  Play,
  RotateCcw,
  X,
  Settings,
  HelpCircle,
  Zap,
  FileText,
  StickyNote,
} from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

// Feature card color variants - muted, professional creme palette
type ColorVariant = 'green' | 'blue' | 'purple' | 'amber';

const colorVariants: Record<ColorVariant, { iconBg: string; iconColor: string; hoverBorder: string; accentBg: string }> = {
  green: {
    iconBg: 'bg-[oklch(0.94_0.03_200)]',
    iconColor: 'text-[oklch(0.42_0.08_200)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_200)]',
    accentBg: 'bg-[oklch(0.94_0.03_200)]',
  },
  blue: {
    iconBg: 'bg-[oklch(0.94_0.03_240)]',
    iconColor: 'text-[oklch(0.45_0.12_240)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_240)]',
    accentBg: 'bg-[oklch(0.94_0.03_240)]',
  },
  purple: {
    iconBg: 'bg-[oklch(0.94_0.03_290)]',
    iconColor: 'text-[oklch(0.45_0.14_290)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_290)]',
    accentBg: 'bg-[oklch(0.94_0.03_290)]',
  },
  amber: {
    iconBg: 'bg-[oklch(0.95_0.03_75)]',
    iconColor: 'text-[oklch(0.55_0.12_75)]',
    hoverBorder: 'group-hover:border-[oklch(0.88_0.04_75)]',
    accentBg: 'bg-[oklch(0.95_0.03_75)]',
  },
};

// Board type icons
const boardTypeIcons: Record<string, React.ReactNode> = {
  math: <Calculator className="w-3.5 h-3.5" strokeWidth={2} />,
  notes: <FileText className="w-3.5 h-3.5" strokeWidth={2} />,
  diagram: <Grid3X3 className="w-3.5 h-3.5" strokeWidth={2} />,
  general: <Pencil className="w-3.5 h-3.5" strokeWidth={2} />,
};

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMyFiles, setShowMyFiles] = useState(false);

  // Greeting state
  const greeting = useMemo(() => getTimeBasedGreeting(), []);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'recent' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sidebar section states
  const [toolsOpen, setToolsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      fetchJournalCount();
      if (profile?.role === 'student') {
        fetchAssignments();
      }
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  async function fetchJournalCount() {
    try {
      const { count, error } = await supabase
        .from('journals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      if (error) throw error;
      setJournalCount(count || 0);
    } catch (error) {
      console.error('Error fetching journal count:', error);
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

  const createWhiteboard = useCallback(async () => {
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

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .insert([
          {
            name: 'Untitled Board',
            title: 'Untitled Board',
            user_id: user.id,
            data: {},
            metadata: {
              templateId: 'blank',
              defaultMode: 'feedback',
            }
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('Board created');
      router.push(`/board/${data.id}`);
    } catch (error: unknown) {
      console.error('Error creating whiteboard:', error);
      toast.error('Failed to create whiteboard');
    } finally {
      setCreating(false);
    }
  }, [creating, user, router, supabase]);

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
            router.push('/journal');
            break;
          case 'k':
            e.preventDefault();
            document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
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
      icon: <Pencil className="h-5 w-5" strokeWidth={2} />,
      color: 'blue',
      onClick: () => { createWhiteboard(); },
      isPrimary: true,
    },
    {
      id: 'math',
      title: 'Math Document',
      description: 'Type equations with instant solving',
      detail: 'LaTeX support & step-by-step',
      icon: <Calculator className="h-5 w-5" strokeWidth={2} />,
      color: 'purple',
      onClick: () => { toast.info('Math Document is coming soon!'); },
      comingSoon: true,
    },
    {
      id: 'journal',
      title: 'Journal',
      description: 'Write notes with AI-powered study tools',
      detail: 'Flashcards, Feynman method & more',
      icon: <BookOpen className="h-5 w-5" strokeWidth={2} />,
      color: 'green',
      onClick: () => { router.push('/journal'); },
    },
  ];

  // Add Admin card
  if (profile?.role === 'admin') {
    featureCards.unshift({
      id: 'admin',
      title: 'Admin Console',
      description: 'Manage users, content, and platform analytics',
      detail: 'Administrative controls',
      icon: <Shield className="h-5 w-5" strokeWidth={2} />,
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
      icon: <Users className="h-5 w-5" strokeWidth={2} />,
      color: 'green' as ColorVariant,
      onClick: () => { router.push('/teacher/classes'); },
    });
  } else if (profile?.role === 'student') {
    featureCards.push({
      id: 'join',
      title: 'Join a Class',
      description: 'Enter a class code from your teacher',
      detail: 'Access assignments & get help',
      icon: <GraduationCap className="h-5 w-5" strokeWidth={2} />,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
      <aside className={cn(
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
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
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
                <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
                {!sidebarCollapsed && <span className="text-sm">New</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => createWhiteboard()}>
                <Pencil className="w-4 h-4 mr-2" strokeWidth={2} />
                New Board
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/board/temp-' + Date.now())}>
                <Zap className="w-4 h-4 mr-2" strokeWidth={2} />
                Quick Board
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/journal')}>
                <BookOpen className="w-4 h-4 mr-2" strokeWidth={2} />
                New Journal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            <button
              onClick={() => setShowMyFiles(false)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left",
                !showMyFiles
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Home className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
              {!sidebarCollapsed && <span className="text-sm">Home</span>}
            </button>
            <button
              onClick={() => setShowMyFiles(true)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left",
                showMyFiles
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FolderOpen className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
              {!sidebarCollapsed && <span className="text-sm">My Boards</span>}
            </button>
          </div>

          {/* Collapsible Tools Section */}
          {!sidebarCollapsed && (
            <Collapsible open={toolsOpen} onOpenChange={setToolsOpen} className="mt-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tools
                {toolsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                <button
                  onClick={() => setPomodoroActive(!pomodoroActive)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                >
                  <Timer className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
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
                {settingsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {user && (
                  <button
                    onClick={() => router.push('/billing')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                  >
                    <CreditCard className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                    <span className="text-sm">Plans & Usage</span>
                  </button>
                )}
                <button
                  onClick={() => toast.info('Settings coming soon!')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                >
                  <Settings className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                  <span className="text-sm">Preferences</span>
                </button>
                <button
                  onClick={() => toast.info('Help center coming soon!')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground text-left"
                >
                  <HelpCircle className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
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
              <Shield className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
              {!sidebarCollapsed && <span className="text-sm">Admin Console</span>}
            </button>
          )}

          {/* Usage indicator */}
          {!sidebarCollapsed && user && (
            <div className="px-3 py-2 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Pencil className="w-3 h-3" />
                    Boards
                  </span>
                  <span>{whiteboards.length} / {isAdmin ? '\u221E' : FREE_BOARD_LIMIT}</span>
                </div>
                {!isAdmin && <Progress value={(whiteboards.length / FREE_BOARD_LIMIT) * 100} className="h-1.5" />}
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" />
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
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 ease-out",
        sidebarCollapsed ? "ml-16" : "ml-56"
      )}>
        {showMyFiles ? (
          /* My Boards View */
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
                    <Grid3X3 className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === 'list' ? "bg-card shadow-sm" : "hover:bg-card/50"
                    )}
                  >
                    <List className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>

                {/* Filter dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Filter className="w-4 h-4" strokeWidth={2} />
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

                {/* Search */}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
                  <Input
                    type="text"
                    placeholder="Search boards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                    <Pencil className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground mb-2">Create your first board</h2>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Start with a blank whiteboard and draw, write equations, or get AI tutoring help.
                  </p>
                  <Button onClick={() => createWhiteboard()} size="lg" className="px-6">
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    New Board
                  </Button>
                </div>
              </div>
            ) : filteredBoards.length === 0 && searchQuery ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="text-center">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.5} />
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
                      <Plus className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">New Board</span>
                  </button>
                )}

                {filteredBoards.map((board) => (
                  viewMode === 'grid' ? (
                    <div
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
                            <Pencil className="w-10 h-10 text-muted-foreground/30" strokeWidth={1.5} />
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
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" strokeWidth={2} />
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
                            <Copy className="w-4 h-4" strokeWidth={2} />
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
                            <Share2 className="w-4 h-4" strokeWidth={2} />
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
                                <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(board.id, board.is_favorite || false);
                              }}>
                                {board.is_favorite ? (
                                  <>
                                    <StarOff className="w-4 h-4 mr-2" strokeWidth={2} />
                                    Remove from favorites
                                  </>
                                ) : (
                                  <>
                                    <Star className="w-4 h-4 mr-2" strokeWidth={2} />
                                    Add to favorites
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setRenameId(board.id);
                                setRenameTitle(board.title);
                              }}>
                                <Edit2 className="w-4 h-4 mr-2" strokeWidth={2} />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                duplicateWhiteboard(board);
                              }}>
                                <Copy className="w-4 h-4 mr-2" strokeWidth={2} />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setShareBoardId(board.id);
                                setShareBoardTitle(board.title);
                                setShareDialogOpen(true);
                              }}>
                                <Share2 className="w-4 h-4 mr-2" strokeWidth={2} />
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
                                <Trash2 className="w-4 h-4 mr-2" strokeWidth={2} />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
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
                            <Pencil className="w-5 h-5 text-muted-foreground/30" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-foreground truncate" title={board.title}>{board.title}</h3>
                          {board.is_favorite && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" strokeWidth={2} />
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
                          <Share2 className="w-4 h-4" strokeWidth={2} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setRenameId(board.id);
                              setRenameTitle(board.title);
                            }}>
                              <Edit2 className="w-4 h-4 mr-2" strokeWidth={2} />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              duplicateWhiteboard(board);
                            }}>
                              <Copy className="w-4 h-4 mr-2" strokeWidth={2} />
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
                              <Trash2 className="w-4 h-4 mr-2" strokeWidth={2} />
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
                  <BookOpen className="h-5 w-5" strokeWidth={2} />
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
                            <BookOpen className="w-12 h-12 text-muted-foreground/50" strokeWidth={1.5} />
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
                            <Clock className="w-3.5 h-3.5" strokeWidth={2} />
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
        ) : (
          /* Dashboard Home View */
          <div className="flex flex-col items-center justify-center min-h-screen px-8 py-12">
            <div className="max-w-2xl w-full">
              {/* Simple Greeting */}
              <div className="text-center mb-10">
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                  {greeting}{user ? `, ${profile?.full_name?.split(' ')[0] || 'there'}` : '!'}
                </h1>
                <p className="text-muted-foreground mt-2">
                  What would you like to work on?
                </p>
              </div>


              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featureCards.map((card) => {
                  const colors = colorVariants[card.color];
                  return (
                    <button
                      key={card.id}
                      onClick={card.onClick}
                      disabled={creating && card.id === 'whiteboard'}
                      className={cn(
                        "group feature-card rounded-xl p-5 text-left transition-all duration-200 relative overflow-hidden",
                        "hover:shadow-md active:scale-[0.99]",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        colors.hoverBorder,
                        card.isPrimary && "ring-2 ring-primary/20 border-primary/30",
                        card.comingSoon && "opacity-50"
                      )}
                    >
                      {/* Coming soon overlay - only show when signed in */}
                      {card.comingSoon && user && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                            Coming Soon
                          </span>
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "icon-container",
                          colors.iconBg,
                          colors.iconColor
                        )}>
                          {card.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-foreground">
                              {card.title}
                            </h3>
                            {card.isPrimary && (
                              <span className="text-[10px] font-medium text-primary flex items-center gap-0.5">
                                <Sparkles className="w-3 h-3" strokeWidth={2} />
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Recent Boards */}
              {user && whiteboards.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-foreground">Recent boards</h2>
                    <button
                      onClick={() => setShowMyFiles(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {whiteboards.slice(0, 3).map((board) => (
                      <button
                        key={board.id}
                        onClick={() => router.push(`/board/${board.id}`)}
                        className="feature-card rounded-lg p-3.5 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="icon-container-sm bg-muted">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate text-sm">
                              {board.title}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {getFriendlyTimestamp(new Date(board.updated_at))}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>

      {/* Pomodoro Timer Popup */}
      {pomodoroActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-4 z-40">
          <div className="flex items-center gap-2">
            <Timer className={cn(
              "w-5 h-5",
              pomodoroMode === 'work' ? "text-primary" : "text-green-500"
            )} strokeWidth={2} />
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
                <Play className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Pause className="w-4 h-4" strokeWidth={2} />
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
              <RotateCcw className="w-4 h-4" strokeWidth={2} />
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
              <X className="w-4 h-4" strokeWidth={2} />
            </Button>
          </div>
          <Badge variant="secondary" className="text-xs">
            {pomodoroPaused ? 'Paused' : pomodoroMode === 'work' ? 'Focus' : 'Break'}
          </Badge>
        </div>
      )}

      {/* Quick Note Dialog */}
      <Dialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5" strokeWidth={2} />
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
    </div>
  );
}
