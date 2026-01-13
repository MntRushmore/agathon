"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/auth-provider';
import { UserMenu } from '@/components/auth/user-menu';
import { AuthModal } from '@/components/auth/auth-modal';
import { ShareBoardDialog } from '@/components/sharing/ShareBoardDialog';
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
  Users
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
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
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [sharedBoards, setSharedBoards] = useState<Whiteboard[]>([]);
  const [activeTab, setActiveTab] = useState<'my-boards' | 'shared'>('my-boards');
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

  // Show auth modal if required
  useEffect(() => {
    if (searchParams.get('auth') === 'required') {
      setAuthModalOpen(true);
      toast.info('Please sign in to continue');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchWhiteboards();
      fetchSharedBoards();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading]);

  async function fetchWhiteboards() {
    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .select('id, title, created_at, updated_at, preview, metadata')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setWhiteboards(data || []);
    } catch (error) {
      console.error('Error fetching whiteboards:', error);
      toast.error('Failed to fetch whiteboards');
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

          {/* Tabs for My Boards / Shared */}
          {user && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-boards' | 'shared')}>
              <TabsList>
                <TabsTrigger value="my-boards">My Boards</TabsTrigger>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-card rounded-xl border shadow-sm animate-pulse">
                <div className="h-40 bg-muted rounded-t-xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
              : "flex flex-col gap-3"
          )}>
            {/* Create New Card (Grid Only) */}
            {viewMode === 'grid' && (
              <div 
                onClick={() => openCreateDialog()}
                className="flex flex-col items-center justify-center h-64 bg-card border-2 border-dashed rounded-xl cursor-pointer hover:bg-accent transition-colors"
              >
                <div className="p-4 rounded-full bg-muted">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <span className="mt-4 font-medium text-muted-foreground">
                  Create New Board
                </span>
              </div>
            )}

            {filteredWhiteboards.map((board) => (
              <div 
                key={board.id}
                className={cn(
                  "group relative bg-card border hover:border-ring/50 transition-all overflow-hidden",
                  viewMode === 'grid' 
                    ? "flex flex-col h-64 rounded-xl shadow-sm hover:shadow-md" 
                    : "flex items-center p-4 rounded-lg hover:bg-accent/50"
                )}
              >
                <div 
                    className={cn("flex-1 cursor-pointer", viewMode === 'list' && "flex items-center gap-4")}
                    onClick={() => router.push(`/board/${board.id}`)}
                >
                    {viewMode === 'grid' ? (
                    <div className="flex-1 h-40 bg-muted flex items-center justify-center relative overflow-hidden border-b">
                        {board.preview ? (
                            <img
                                src={board.preview}
                                alt={board.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
                                <FileIcon className="w-12 h-12 text-muted-foreground/50 group-hover:scale-110 transition-transform duration-300" />
                            </>
                        )}
                        {/* Shared badge */}
                        {board.sharedPermission && (
                            <div className="absolute top-2 left-2 px-2 py-1 bg-primary/90 text-primary-foreground text-xs font-medium rounded-md flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {board.sharedPermission === 'edit' ? 'Can Edit' : 'View Only'}
                            </div>
                        )}
                    </div>
                    ) : (
                    <div className="p-2 bg-muted rounded-lg relative">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    )}

                    <div className={cn("min-w-0", viewMode === 'grid' && "p-4")}>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate group-hover:text-primary transition-colors flex-1">
                                {board.title}
                            </h3>
                            {board.sharedPermission && viewMode === 'list' && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap">
                                    <Users className="w-3 h-3" />
                                    {board.sharedPermission === 'edit' ? 'Edit' : 'View'}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {(board.metadata?.subject || 'Subject')}{board.metadata?.gradeLevel ? `  b7 ${board.metadata.gradeLevel}` : ''}  b7 {getTemplateTitle(board.metadata?.templateId)}
                        </div>
                        <div className="flex items-center mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" />
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
                    viewMode === 'grid' ? "top-2 right-2" : "right-4"
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
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No boards found</h3>
                <p className="text-muted-foreground mt-1">Try searching for something else or create a new board.</p>
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
