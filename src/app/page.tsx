"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { getStudentAssignments } from '@/lib/api/assignments';
import { AuthModal } from '@/components/auth/auth-modal';
import { ShareBoardDialog } from '@/components/sharing/ShareBoardDialog';
import {
  Plus,
  Trash2,
  Clock,
  FileIcon,
  Search,
  Edit2,
  MoreHorizontal,
  Share2,
  Users,
  BookOpen,
  Settings,
  ChevronLeft,
  Folder,
  Sparkles,
  PenTool,
  GraduationCap,
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { formatDistance } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from "@/components/ui/label";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Whiteboard = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preview?: string;
  metadata?: {
    templateId?: string;
    subject?: string;
    gradeLevel?: string;
    instructions?: string;
    defaultMode?: 'off' | 'feedback' | 'suggest' | 'answer';
  };
  sharedPermission?: 'view' | 'edit';
};

// Feature card color variants - muted, professional crème palette
type ColorVariant = 'green' | 'blue' | 'purple';

const colorVariants: Record<ColorVariant, { iconBg: string; iconColor: string; hoverBorder: string }> = {
  green: {
    iconBg: 'bg-[oklch(0.94_0.03_155)]',
    iconColor: 'text-[oklch(0.45_0.12_155)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_155)]',
  },
  blue: {
    iconBg: 'bg-[oklch(0.94_0.03_240)]',
    iconColor: 'text-[oklch(0.45_0.12_240)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_240)]',
  },
  purple: {
    iconBg: 'bg-[oklch(0.94_0.03_290)]',
    iconColor: 'text-[oklch(0.45_0.14_290)]',
    hoverBorder: 'group-hover:border-[oklch(0.85_0.04_290)]',
  },
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [showMyFiles, setShowMyFiles] = useState(false);

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBoardId, setShareBoardId] = useState<string | null>(null);
  const [shareBoardTitle, setShareBoardTitle] = useState('');

  // Show auth modal if required
  useEffect(() => {
    if (searchParams.get('auth') === 'required') {
      setAuthModalOpen(true);
      toast.info('Please sign in to continue');
    }
    if (searchParams.get('error') === 'teacher_only') {
      toast.error('Access denied. Only teachers can access the teacher dashboard.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchWhiteboards();
      if (profile?.role === 'student') {
        fetchAssignments();
      }
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

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

  async function createWhiteboard() {
    if (creating) return;

    if (!user) {
      toast.info('Creating temporary board');
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
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
    } catch (error: any) {
      console.error('Error creating whiteboard:', error);
      toast.error('Failed to create whiteboard');
    } finally {
      setCreating(false);
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
  };

  const featureCards: FeatureCard[] = [
    {
      id: 'whiteboard',
      title: 'AI Whiteboard',
      description: 'Draw and get real-time AI tutoring help',
      detail: 'Handwriting recognition & hints',
      icon: <PenTool className="h-5 w-5" />,
      color: 'blue',
      onClick: () => { createWhiteboard(); },
    },
    {
      id: 'math',
      title: 'Math Document',
      description: 'Type equations with instant solving',
      detail: 'LaTeX support & step-by-step',
      icon: <Sparkles className="h-5 w-5" />,
      color: 'purple',
      onClick: () => { toast.info('Math Document is coming soon!'); },
      comingSoon: true,
    },
  ];

  // Add teacher/student specific cards
  if (profile?.role === 'teacher') {
    featureCards.push({
      id: 'classes',
      title: 'My Classes',
      description: 'Manage your classes and students',
      detail: 'Create assignments & track progress',
      icon: <Users className="h-5 w-5" />,
      color: 'green' as ColorVariant,
      onClick: () => { router.push('/teacher/classes'); },
    });
  } else if (profile?.role === 'student') {
    featureCards.push({
      id: 'join',
      title: 'Join a Class',
      description: 'Enter a class code from your teacher',
      detail: 'Access assignments & get help',
      icon: <GraduationCap className="h-5 w-5" />,
      color: 'green' as ColorVariant,
      onClick: () => { router.push('/student/join'); },
    });
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Light crème theme */}
      <aside className={cn(
        "fixed left-0 top-0 h-full flex flex-col transition-all duration-300 ease-out z-50",
        "bg-card border-r border-border",
        sidebarCollapsed ? "w-16" : "w-56"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={() => createWhiteboard()}
            className={cn(
              "flex items-center gap-2.5 rounded-lg transition-all duration-150 font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              sidebarCollapsed ? "p-2.5" : "px-4 py-2"
            )}
          >
            <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
            {!sidebarCollapsed && <span className="text-sm">New</span>}
          </button>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-3 py-2">
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
              <Sparkles className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} />
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
              <Folder className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && <span className="text-sm">My Boards</span>}
            </button>
          </div>
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-border" />

        {/* Secondary Navigation / Footer */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => router.push('/board/temp-' + Date.now())}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              sidebarCollapsed && "justify-center"
            )}
          >
            <PenTool className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} />
            {!sidebarCollapsed && <span className="text-sm">Quick Board</span>}
          </button>
          {user && (
            <button
              onClick={() => {/* settings */}}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                sidebarCollapsed && "justify-center"
              )}
            >
              <Settings className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && <span className="text-sm">Settings</span>}
            </button>
          )}

          {/* User info / Sign in */}
          {!sidebarCollapsed && (
            <div className="pt-2 mt-2 border-t border-border">
              {user ? (
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {profile?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'User'}</p>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
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
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">My Boards</h1>
                <p className="text-sm text-muted-foreground mt-1">All your whiteboards in one place</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search boards..."
                  className="pl-9 bg-card border-border"
                />
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
            ) : whiteboards.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="empty-state-card rounded-2xl p-12 text-center max-w-md w-full">
                  <div className="icon-container icon-container-lg icon-container-green mx-auto mb-5">
                    <PenTool className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-2">Create your first board</h2>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Start with a blank whiteboard and draw, write equations, or get AI tutoring help.
                  </p>
                  <Button onClick={() => createWhiteboard()} size="lg" className="px-6">
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                    New Board
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {/* Create New Card */}
                <button
                  onClick={() => createWhiteboard()}
                  className="empty-state-card rounded-xl aspect-[4/3] flex flex-col items-center justify-center gap-3 cursor-pointer"
                >
                  <div className="icon-container icon-container-green">
                    <Plus className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">New Board</span>
                </button>

                {whiteboards.map((board) => (
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
                          <PenTool className="w-10 h-10 text-muted-foreground/30" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate text-sm">
                            {board.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistance(new Date(board.updated_at), new Date(), { addSuffix: true })}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setRenameId(board.id);
                              setRenameTitle(board.title);
                            }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setShareBoardId(board.id);
                              setShareBoardTitle(board.title);
                              setShareDialogOpen(true);
                            }}>
                              <Share2 className="w-4 h-4 mr-2" />
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
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Assignments Section for Students */}
            {profile?.role === 'student' && assignments.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
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
                            <BookOpen className="w-12 h-12 text-muted-foreground/50" />
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
                        <h3 className="font-medium text-foreground">
                          {submission.assignment.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {submission.assignment.class?.name}
                        </p>
                        {submission.assignment.due_date && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2">
                            <Clock className="w-3.5 h-3.5" />
                            Due {formatDistance(new Date(submission.assignment.due_date), new Date(), { addSuffix: true })}
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
              {/* Greeting */}
              <div className="text-center mb-10">
                <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
                  {user ? `Hi, ${profile?.full_name?.split(' ')[0] || 'there'}` : 'Welcome'}
                </h1>
                <p className="text-muted-foreground">
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
                        "group feature-card rounded-xl p-5 text-left transition-all duration-200",
                        "hover:shadow-md active:scale-[0.99]",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        colors.hoverBorder,
                        card.comingSoon && "opacity-70"
                      )}
                    >
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
                            {card.comingSoon && (
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded-full">
                                Soon
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
                            <PenTool className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate text-sm">
                              {board.title}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {formatDistance(new Date(board.updated_at), new Date(), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign in prompt */}
              {!user && (
                <div className="mt-12 text-center p-6 bg-card rounded-xl border border-border">
                  <p className="text-sm text-muted-foreground mb-4">
                    Sign in to save your boards and access all features
                  </p>
                  <Button onClick={() => setAuthModalOpen(true)} variant="outline">
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />

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
