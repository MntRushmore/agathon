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
  const featureCards = [
    {
      id: 'whiteboard',
      title: 'AI Whiteboard',
      description: 'Draw and get real-time AI tutoring help',
      detail: 'Handwriting recognition & hints',
      icon: <PenTool className="h-6 w-6" />,
      color: 'bg-blue-500',
      onClick: () => createWhiteboard(),
    },
    {
      id: 'math',
      title: 'Math Document',
      description: 'Type equations with instant solving',
      detail: 'LaTeX support & step-by-step',
      icon: <Sparkles className="h-6 w-6" />,
      color: 'bg-purple-500',
      onClick: () => router.push('/math'),
    },
  ];

  // Add teacher/student specific cards
  if (profile?.role === 'teacher') {
    featureCards.push({
      id: 'classes',
      title: 'My Classes',
      description: 'Manage your classes and students',
      detail: 'Create assignments & track progress',
      icon: <Users className="h-6 w-6" />,
      color: 'bg-green-500',
      onClick: () => router.push('/teacher/classes'),
    });
  } else if (profile?.role === 'student') {
    featureCards.push({
      id: 'join',
      title: 'Join a Class',
      description: 'Enter a class code from your teacher',
      detail: 'Access assignments & get help',
      icon: <GraduationCap className="h-6 w-6" />,
      color: 'bg-green-500',
      onClick: () => router.push('/student/join'),
    });
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#1a1a1a] flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-[#1e1e1e] text-white flex flex-col transition-all duration-300 z-50",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={() => createWhiteboard()}
            className={cn(
              "flex items-center gap-3 hover:bg-white/10 rounded-lg transition-colors",
              sidebarCollapsed ? "p-2" : "px-3 py-2"
            )}
          >
            <Plus className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="font-medium">New</span>}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform",
              sidebarCollapsed && "rotate-180"
            )} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-2">
          <button
            onClick={() => setShowMyFiles(!showMyFiles)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-left",
              showMyFiles && "bg-white/10"
            )}
          >
            <Folder className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>My files</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 space-y-2 border-t border-white/10">
          {!sidebarCollapsed && (
            <>
              {user ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  <p className="truncate">{profile?.full_name || user.email}</p>
                  <p className="text-xs capitalize">{profile?.role || 'User'}</p>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-white/10 rounded-lg transition-colors"
                >
                  Sign in
                </button>
              )}
            </>
          )}
          <button
            onClick={() => router.push('/board/temp-' + Date.now())}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors",
              sidebarCollapsed && "justify-center"
            )}
          >
            <PenTool className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Whiteboard</span>}
          </button>
          {user && (
            <button
              onClick={() => {/* settings */}}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors",
                sidebarCollapsed && "justify-center"
              )}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarCollapsed ? "ml-16" : "ml-64"
      )}>
        {showMyFiles ? (
          /* My Files View */
          <div className="max-w-5xl mx-auto px-8 py-12">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Files</h1>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search..."
                  className="pl-9 bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 animate-pulse">
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : whiteboards.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No files yet</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first whiteboard to get started</p>
                <Button onClick={() => createWhiteboard()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Board
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {whiteboards.map((board) => (
                  <div
                    key={board.id}
                    className="group bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => router.push(`/board/${board.id}`)}
                  >
                    <div className="aspect-video bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
                      {board.preview ? (
                        <img
                          src={board.preview}
                          alt={board.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <FileIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {board.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            {formatDistance(new Date(board.updated_at), new Date(), { addSuffix: true })}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
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
                              className="text-red-600"
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  My Assignments
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.map((submission: any) => (
                    <div
                      key={submission.id}
                      className="group bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => router.push(`/board/${submission.student_board_id}`)}
                    >
                      <div className="aspect-video bg-gray-50 dark:bg-gray-900 relative">
                        {submission.student_board?.preview ? (
                          <img
                            src={submission.student_board.preview}
                            alt={submission.assignment.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        <div className={cn(
                          "absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full",
                          submission.status === 'submitted' ? 'bg-green-100 text-green-700' :
                          submission.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        )}>
                          {submission.status === 'submitted' ? 'Submitted' :
                           submission.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {submission.assignment.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {submission.assignment.class?.name}
                        </p>
                        {submission.assignment.due_date && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-2">
                            <Clock className="w-3 h-3" />
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
            <div className="max-w-4xl w-full">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-2">
                How can I help you today?
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-center mb-12">
                Select an option below to get started.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featureCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={card.onClick}
                    disabled={creating && card.id === 'whiteboard'}
                    className="group bg-white dark:bg-gray-800 rounded-2xl p-6 text-left border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "p-3 rounded-xl text-white",
                        card.color
                      )}>
                        {card.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {card.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                          {card.description}
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                          {card.detail}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Quick Access to Recent Files */}
              {user && whiteboards.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent files</h2>
                    <button
                      onClick={() => setShowMyFiles(true)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {whiteboards.slice(0, 3).map((board) => (
                      <button
                        key={board.id}
                        onClick={() => router.push(`/board/${board.id}`)}
                        className="bg-white dark:bg-gray-800 rounded-xl p-4 text-left border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <FileIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm">
                              {board.title}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDistance(new Date(board.updated_at), new Date(), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign in prompt for non-authenticated users */}
              {!user && (
                <div className="mt-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Sign in to save your work and access all features
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
