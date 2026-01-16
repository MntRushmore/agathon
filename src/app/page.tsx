"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { getStudentAssignments } from '@/lib/api/assignments';
import { UserMenu } from '@/components/auth/user-menu';
import { AuthModal } from '@/components/auth/auth-modal';
import { ShareBoardDialog } from '@/components/sharing/ShareBoardDialog';
import { WelcomeDialog } from '@/components/onboarding/WelcomeDialog';
import { EmptyStateCard } from '@/components/onboarding/EmptyStateCard';
import { ProgressChecklist } from '@/components/dashboard/ProgressChecklist';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { useOnboarding } from '@/lib/hooks/useOnboarding';
import {
  Plus,
  Trash2,
  Clock,
  FileIcon,
  Search,
  LayoutGrid,
  List as ListIcon,
  Edit2,
  MoreHorizontal,
  Share2,
  Users,
  BookOpen,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { formatDistance } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const assignmentTemplates = [
  {
    id: 'blank',
    title: 'Blank board',
    description: 'Start from scratch for open exploration.',
    defaultTitle: 'Untitled Board',
    defaultMode: 'feedback' as const,
  },
  {
    id: 'math-practice',
    title: 'Math practice',
    description: 'Set up space for multi-step worked examples and hinting.',
    defaultTitle: 'Math Practice',
    defaultMode: 'suggest' as const,
  },
  {
    id: 'science-annotate',
    title: 'Science annotate',
    description: 'Label diagrams, graphs, and experiments with hints.',
    defaultTitle: 'Science Board',
    defaultMode: 'feedback' as const,
  },
  {
    id: 'writing-review',
    title: 'Writing review',
    description: 'Structure essays with feedback-first assistance.',
    defaultTitle: 'Writing Review',
    defaultMode: 'feedback' as const,
  },
];

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [sharedBoards, setSharedBoards] = useState<Whiteboard[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'my-boards' | 'assignments' | 'shared'>('my-boards');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('math-practice');
  const [newTitle, setNewTitle] = useState<string>('Math Practice');
  const [subject, setSubject] = useState<string>('Math');
  const [gradeLevel, setGradeLevel] = useState<string>('Grade 8');
  const [instructions, setInstructions] = useState<string>('Solve the practice problems and show work.');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBoardId, setShareBoardId] = useState<string | null>(null);
  const [shareBoardTitle, setShareBoardTitle] = useState('');

  // Onboarding state
  const {
    isOnboardingComplete,
    loading: onboardingLoading,
    completeOnboarding,
    skipOnboarding,
    checkMilestones,
  } = useOnboarding();
  const [milestones, setMilestones] = useState({
    hasJoinedClass: false,
    hasCreatedBoard: false,
    hasUsedAI: false,
  });

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
      fetchSharedBoards();
      if (profile?.role === 'student') {
        fetchAssignments();
      }
      // Check milestones for progress checklist
      checkMilestones().then(setMilestones);
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
      // Only show error toast if it's not a "no rows" error (new users have no boards)
      if (error.code !== 'PGRST116') {
        toast.error('Failed to fetch whiteboards');
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchSharedBoards() {
    try {
      const { data, error } = await supabase
        .from('board_shares')
        .select(`
          board_id,
          permission,
          whiteboards (
            id,
            title,
            created_at,
            updated_at,
            preview,
            metadata
          )
        `)
        .eq('shared_with_user_id', user?.id);

      if (error) throw error;

      // Extract whiteboard data from shares
      const boards = (data || [])
        .filter(share => share.whiteboards)
        .map(share => ({
          ...(share.whiteboards as any),
          sharedPermission: share.permission
        }));

      setSharedBoards(boards);
    } catch (error) {
      console.error('Error fetching shared boards:', error);
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

  const selectedTemplate = assignmentTemplates.find((t) => t.id === selectedTemplateId) || assignmentTemplates[0];

  const getTemplateTitle = (templateId?: string) =>
    assignmentTemplates.find((t) => t.id === templateId)?.title || 'Class board';

  const openCreateDialog = (templateId?: string) => {
    const template = assignmentTemplates.find((t) => t.id === templateId) || assignmentTemplates[0];
    setSelectedTemplateId(template.id);
    setNewTitle(template.defaultTitle);
    setSubject(template.id === 'writing-review' ? 'ELA' : template.id === 'science-annotate' ? 'Science' : 'Math');
    setGradeLevel('Grade 8');
    setInstructions('Add your work on the canvas. Use hints before solutions.');
    setCreating(false);
    setCreateDialogOpen(true);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = assignmentTemplates.find((t) => t.id === templateId);
    if (template) {
      setNewTitle(template.defaultTitle);
    }
  };

  async function createWhiteboard() {
    if (creating) return;

    // If no user (auth disabled), create board without database
    if (!user) {
      toast.info('Creating temporary board (auth disabled)');
      setCreateDialogOpen(false);
      // Generate a temporary ID
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
      return;
    }

    setCreating(true);
    try {
      const metadata = {
        templateId: selectedTemplateId,
        subject,
        gradeLevel,
        instructions,
        defaultMode: selectedTemplate.defaultMode,
      };

      const { data, error } = await supabase
        .from('whiteboards')
        .insert([
          {
            name: newTitle || selectedTemplate.defaultTitle,
            title: newTitle || selectedTemplate.defaultTitle,
            user_id: user.id,
            data: {},
            metadata
          }
        ])
        .select()
        .single();

      if (error) throw error;
      toast.success('Board created for your class');
      setCreateDialogOpen(false);
      setCreating(false);
      router.push(`/board/${data.id}`);
    } catch (error) {
      console.error('Error creating whiteboard:', error);
      toast.error('Failed to create whiteboard');
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

  const currentBoards = activeTab === 'my-boards' ? whiteboards : sharedBoards;
  const filteredWhiteboards = currentBoards.filter(board =>
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Dialog for first-time students */}
      {user && profile?.role === 'student' && !onboardingLoading && isOnboardingComplete === false && (
        <WelcomeDialog
          open={true}
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
          userName={profile?.full_name?.split(' ')[0] || 'there'}
          userRole={profile?.role}
        />
      )}

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">AI Whiteboard</div>
            </div>
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-6">
        {/* Header Section */}
        <div className="space-y-4 mb-4">
          <h1 className="text-4xl font-bold tracking-tight">
            {user ? 'My Whiteboards' : 'Welcome to AI Whiteboard'}
          </h1>

          {/* Teacher Quick Actions */}
          {user && profile?.role === 'teacher' && (
            <div className="flex flex-col sm:flex-row gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-muted-foreground mb-1">Teacher Dashboard</h2>
                <p className="text-xs text-muted-foreground">Manage your classes and assignments</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => router.push('/teacher/classes')}
                  variant="default"
                  className="w-full sm:w-auto"
                >
                  <Users className="w-4 h-4 mr-2" />
                  My Classes
                </Button>
                <Button
                  onClick={() => router.push('/teacher/assignments/create')}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Create Assignment
                </Button>
              </div>
            </div>
          )}

          {/* Student Dashboard - Quick Stats and Progress */}
          {user && profile?.role === 'student' && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <QuickStats
                enrolledClassCount={milestones.hasJoinedClass ? Math.max(1, assignments.filter((a, i, arr) => arr.findIndex(b => b.assignment?.class_id === a.assignment?.class_id) === i).length) : 0}
                assignmentCount={assignments.length}
                overdueCount={assignments.filter((a: any) => a.assignment?.due_date && new Date(a.assignment.due_date) < new Date() && a.status !== 'submitted').length}
                boardCount={whiteboards.length}
              />

              {/* Progress Checklist (only show if incomplete) */}
              <ProgressChecklist
                hasJoinedClass={milestones.hasJoinedClass}
                hasCreatedBoard={milestones.hasCreatedBoard}
                hasUsedAI={milestones.hasUsedAI}
              />

              {/* Student Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-lg border border-green-500/20">
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-muted-foreground mb-1">Student Dashboard</h2>
                  <p className="text-xs text-muted-foreground">Join classes and complete your assignments</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => router.push('/student/join')}
                    variant="default"
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Join a Class
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs for My Boards / Shared / Assignments (Students only) */}
          {user && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="my-boards">My Boards</TabsTrigger>
                {profile?.role === 'student' && (
                  <TabsTrigger value="assignments">
                    <BookOpen className="w-4 h-4 mr-2" />
                    My Assignments
                    {assignments.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                        {assignments.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
                <TabsTrigger value="shared">
                  <Users className="w-4 h-4 mr-2" />
                  Shared With Me
                  {sharedBoards.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                      {sharedBoards.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                type="text"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button 
              onClick={() => openCreateDialog()}
              disabled={creating}
              className="h-10 w-full sm:w-auto"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              New Board
            </Button>
            
            <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon-lg"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon-lg"
                onClick={() => setViewMode('list')}
              >
                <ListIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {!user ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <FileIcon className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Sign in to get started</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create an account to save your whiteboards, access them from anywhere, and use AI-powered tutoring.
            </p>
            <Button onClick={() => setAuthModalOpen(true)} size="lg">
              Sign In or Create Account
            </Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden bg-card rounded-xl border">
                <div className="w-full aspect-[16/10] bg-muted skeleton" />
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-muted rounded skeleton w-3/4" />
                  <div className="h-4 bg-muted rounded skeleton w-1/2" />
                  <div className="h-4 bg-muted rounded skeleton w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'assignments' ? (
          /* ASSIGNMENTS TAB */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {assignments.length === 0 ? (
              <div className="col-span-full">
                <EmptyStateCard
                  icon={<BookOpen className="h-12 w-12 text-muted-foreground" />}
                  title="No assignments yet"
                  description="Join a class to see assignments from your teacher, or create a practice board to explore AI tutoring features."
                  actions={[
                    {
                      label: "Join a Class",
                      onClick: () => router.push('/student/join'),
                      variant: "default",
                    },
                    {
                      label: "Create Practice Board",
                      onClick: () => openCreateDialog(),
                      variant: "outline",
                    },
                  ]}
                />
              </div>
            ) : (
              assignments.map((submission: any) => (
                <div
                  key={submission.id}
                  className="group relative bg-card border hover:border-ring/50 transition-all overflow-hidden flex flex-col rounded-xl board-card cursor-pointer"
                  onClick={() => router.push(`/board/${submission.student_board_id}`)}
                >
                  {/* Preview */}
                  <div className="relative w-full aspect-[16/10] overflow-hidden bg-muted">
                    {submission.student_board?.preview ? (
                      <img
                        src={submission.student_board.preview}
                        alt={submission.assignment.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <BookOpen className="w-16 h-16 text-muted-foreground opacity-20" />
                      </div>
                    )}
                    {/* Status Badge */}
                    <div className={cn(
                      "absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg backdrop-blur-sm",
                      submission.status === 'submitted' ? 'bg-green-500/90 text-white' :
                      submission.status === 'in_progress' ? 'bg-yellow-500/90 text-white' :
                      'bg-gray-500/90 text-white'
                    )}>
                      {submission.status === 'submitted' ? '✓ Submitted' :
                       submission.status === 'in_progress' ? 'In Progress' :
                       'Not Started'}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <h3 className="text-xl font-medium mb-1">{submission.assignment.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {submission.assignment.class.name}
                    </p>
                    {submission.assignment.due_date && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due {formatDistance(new Date(submission.assignment.due_date), new Date(), { addSuffix: true })}
                      </p>
                    )}
                    {submission.submitted_at && (
                      <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <Check className="h-3 w-3" />
                        Submitted {formatDistance(new Date(submission.submitted_at), new Date(), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* MY BOARDS / SHARED TAB */
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
              : "flex flex-col gap-3"
          )}>
            {/* Create New Card (Grid Only) */}
            {activeTab === 'my-boards' && viewMode === 'grid' && (
              <div
                onClick={() => openCreateDialog()}
                className="flex flex-col items-center justify-center aspect-[16/10] bg-card border-2 border-dashed rounded-xl cursor-pointer hover:bg-accent transition-all hover:border-ring/50"
              >
                <div className="p-4 rounded-full bg-muted">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <span className="mt-4 font-medium text-muted-foreground">
                  Create New Board
                </span>
              </div>
            )}

            {(activeTab === 'my-boards' ? whiteboards : sharedBoards)
              .filter(board => board.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((board) => (
              <div
                key={board.id}
                className={cn(
                  "group relative bg-card border hover:border-ring/50 transition-all overflow-hidden",
                  viewMode === 'grid'
                    ? "flex flex-col rounded-xl board-card"
                    : "flex items-center p-4 rounded-lg hover:bg-accent/50"
                )}
              >
                <div 
                    className={cn("flex-1 cursor-pointer", viewMode === 'list' && "flex items-center gap-4")}
                    onClick={() => router.push(`/board/${board.id}`)}
                >
                    {viewMode === 'grid' ? (
                    <div className="relative w-full aspect-[16/10] overflow-hidden bg-muted">
                        {board.preview ? (
                            <img
                                src={board.preview}
                                alt={board.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <FileIcon className="w-16 h-16 text-muted-foreground opacity-20" />
                            </div>
                        )}
                        {/* Gradient overlay for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {/* Shared badge */}
                        {board.sharedPermission && (
                            <div className="absolute top-3 left-3 px-3 py-1.5 bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 backdrop-blur-sm">
                                <Users className="w-3.5 h-3.5" />
                                {board.sharedPermission === 'edit' ? 'Can Edit' : 'View Only'}
                            </div>
                        )}
                    </div>
                    ) : (
                    <div className="p-2 bg-muted rounded-lg relative">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    )}

                    <div className={cn("min-w-0", viewMode === 'grid' && "p-6")}>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors flex-1">
                                {board.title}
                            </h3>
                            {board.sharedPermission && viewMode === 'list' && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap">
                                    <Users className="w-3 h-3" />
                                    {board.sharedPermission === 'edit' ? 'Edit' : 'View'}
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          {(board.metadata?.subject || 'Subject')}{board.metadata?.gradeLevel ? `  b7 ${board.metadata.gradeLevel}` : ''}  b7 {getTemplateTitle(board.metadata?.templateId)}
                        </div>
                        <div className="flex items-center mt-2 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            {new Date(board.updated_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                            })}
                        </div>
                    </div>
                </div>

                <div className={cn(
                    "absolute",
                    viewMode === 'grid' ? "top-3 right-3" : "right-4"
                )}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-card border shadow-sm"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                                setRenameId(board.id);
                                setRenameTitle(board.title);
                            }}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
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
                                onClick={() => deleteWhiteboard(board.id)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </div>
            ))}

            {filteredWhiteboards.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
                <div className="w-32 h-32 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-16 h-16 text-primary/40" />
                </div>
                <h2 className="text-2xl font-semibold mb-3">No boards found</h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  {searchQuery
                    ? `No boards match "${searchQuery}". Try a different search.`
                    : 'Start by creating a new whiteboard to begin drawing and learning.'
                  }
                </p>
                {!searchQuery && (
                  <Button size="lg" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Board
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) setCreating(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a class board</DialogTitle>
            <DialogDescription>
              Pick a template and subject so the tutor can tailor hints.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <select
                id="template"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {assignmentTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Board name</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={selectedTemplate.defaultTitle}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Math, Science, ELA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade">Grade level</Label>
              <Input
                id="grade"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="Grade 6, Algebra I, AP Bio"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="instructions">Student prompt</Label>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-24 resize-none"
                placeholder="What should students do on this board?"
              />
              <p className="text-xs text-muted-foreground">Tutor will prefer {selectedTemplate.defaultMode} mode by default for this board.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={createWhiteboard} disabled={creating}>
              {creating ? 'Creating...' : 'Create board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
