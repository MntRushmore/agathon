"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Trash2, 
  Clock, 
  FileIcon, 
  Search, 
  LayoutGrid, 
  List as ListIcon, 
  MoreVertical,
  Edit2,
  MoreHorizontal
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
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
  DialogTrigger,
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
};

export default function Dashboard() {
  const router = useRouter();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  useEffect(() => {
    fetchWhiteboards();
  }, []);

  async function fetchWhiteboards() {
    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .select('id, title, created_at, updated_at, preview')
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

  async function createWhiteboard() {
    if (creating) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('whiteboards')
        .insert([
          { title: 'Untitled Whiteboard', data: {} }
        ])
        .select()
        .single();

      if (error) throw error;
      toast.success('Whiteboard created successfully');
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

  const filteredWhiteboards = whiteboards.filter(board => 
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-2 rounded-lg">
                <FileIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">
                Infinite Canvas
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="text"
                  placeholder="Search boards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button 
                onClick={createWhiteboard}
                disabled={creating}
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                New Board
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Whiteboards</h1>
            <p className="text-muted-foreground mt-1">
              {filteredWhiteboards.length} {filteredWhiteboards.length === 1 ? 'board' : 'boards'} found
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm self-start sm:self-auto">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="h-8 w-8"
            >
              <ListIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
              : "flex flex-col gap-3"
          )}>
            {/* Create New Card (Grid Only) */}
            {viewMode === 'grid' && (
              <div 
                onClick={createWhiteboard}
                className="group relative flex flex-col items-center justify-center h-64 bg-card border-2 border-dashed rounded-xl cursor-pointer hover:border-primary hover:bg-accent/50 transition-all duration-200"
              >
                <div className="p-4 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                  <Plus className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="mt-4 font-medium text-muted-foreground group-hover:text-primary">
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
                    </div>
                    ) : (
                    <div className="p-2 bg-muted rounded-lg">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    )}

                    <div className={cn("min-w-0", viewMode === 'grid' && "p-4")}>
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                            {board.title}
                        </h3>
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
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 bg-card/80 backdrop-blur-sm"
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
    </div>
  );
}
