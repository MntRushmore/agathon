'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Home,
  FolderOpen,
  BookOpen,
  Pencil,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface SidebarJournal {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarWhiteboard {
  id: string;
  title: string;
  updated_at: string;
}

interface JournalSidebarProps {
  activeJournalId?: string;
  onCollapseChange?: (collapsed: boolean) => void;
}

const STORAGE_KEY = 'journal-sidebar-collapsed';
const FREE_BOARD_LIMIT = 3;
const FREE_JOURNAL_LIMIT = 3;

export function JournalSidebar({ activeJournalId, onCollapseChange }: JournalSidebarProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const [journals, setJournals] = useState<SidebarJournal[]>([]);
  const [whiteboards, setWhiteboards] = useState<SidebarWhiteboard[]>([]);
  const [journalsOpen, setJournalsOpen] = useState(true);
  const [boardsOpen, setBoardsOpen] = useState(true);

  // Persist and notify collapse state
  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      onCollapseChange?.(next);
      return next;
    });
  }, [onCollapseChange]);

  // Notify parent of initial state
  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch journals
  useEffect(() => {
    if (!user) return;

    async function fetchJournals() {
      const { data, error } = await supabase
        .from('journals')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false });

      if (!error) setJournals(data || []);
    }

    fetchJournals();
  }, [user, supabase]);

  // Fetch recent whiteboards
  useEffect(() => {
    if (!user) return;

    async function fetchWhiteboards() {
      const { data, error } = await supabase
        .from('whiteboards')
        .select('id, title, updated_at')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!error) setWhiteboards(data || []);
    }

    fetchWhiteboards();
  }, [user, supabase]);

  // Create new journal
  const createJournal = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('journals')
      .insert([{ user_id: user.id, title: 'New Journal', content: [] }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create journal');
      return;
    }

    router.push(`/journal/${data.id}`);
  };

  // Create new whiteboard
  const createWhiteboard = async () => {
    if (!user) {
      const tempId = `temp-${Date.now()}`;
      router.push(`/board/${tempId}`);
      return;
    }

    const { data, error } = await supabase
      .from('whiteboards')
      .insert([{
        name: 'Untitled Board',
        title: 'Untitled Board',
        user_id: user.id,
        data: {},
        metadata: { templateId: 'blank', defaultMode: 'feedback' },
      }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create board');
      return;
    }

    router.push(`/board/${data.id}`);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full flex flex-col transition-all duration-300 ease-out z-40',
        collapsed ? 'w-16 bg-transparent' : 'w-56 bg-card/90 backdrop-blur-sm border-r border-border',
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        {collapsed ? (
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center"
          >
            <Logo size="sm" />
          </button>
        ) : (
          <>
            <Logo size="sm" showText />
            <button
              onClick={toggleCollapse}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {/* New Button Dropdown */}
      <div className="px-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 font-medium',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                collapsed ? 'justify-center px-2 py-2' : 'px-4 py-2'
              )}
            >
              <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
              {!collapsed && <span className="text-sm">New</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={createWhiteboard}>
              <Pencil className="w-4 h-4 mr-2" strokeWidth={2} />
              New Board
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/board/temp-' + Date.now())}>
              <Zap className="w-4 h-4 mr-2" strokeWidth={2} />
              Quick Board
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={createJournal}>
              <BookOpen className="w-4 h-4 mr-2" strokeWidth={2} />
              New Journal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-hidden flex flex-col">
        <div className="space-y-1">
          <button
            onClick={() => router.push('/')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left',
              'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Home className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
            {!collapsed && <span className="text-sm">Home</span>}
          </button>
          <button
            onClick={() => router.push('/')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left',
              'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <FolderOpen className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
            {!collapsed && <span className="text-sm">My Boards</span>}
          </button>
          <button
            onClick={() => router.push('/journal')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left',
              'bg-accent text-foreground font-medium'
            )}
          >
            <BookOpen className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
            {!collapsed && <span className="text-sm">My Journals</span>}
          </button>
        </div>

        {/* Your Journals */}
        {!collapsed && (
          <Collapsible open={journalsOpen} onOpenChange={setJournalsOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Your Journals
              {journalsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-0.5 mt-1">
                  {journals.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => router.push(`/journal/${j.id}`)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-left',
                        j.id === activeJournalId
                          ? 'bg-accent text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <BookOpen className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-sm truncate">{j.title || 'Untitled'}</span>
                    </button>
                  ))}
                  {journals.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No journals yet</p>
                  )}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recent Boards */}
        {!collapsed && (
          <Collapsible open={boardsOpen} onOpenChange={setBoardsOpen} className="mt-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Boards
              {boardsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 mt-1">
                {whiteboards.map((wb) => (
                  <button
                    key={wb.id}
                    onClick={() => router.push(`/board/${wb.id}`)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm truncate">{wb.title || 'Untitled Board'}</span>
                  </button>
                ))}
                {whiteboards.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No boards yet</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-border" />

      {/* Footer */}
      <div className="p-3 space-y-1">
        {/* Usage indicators */}
        {!collapsed && user && (
          <div className="px-3 py-2 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Pencil className="w-3 h-3" />
                  Boards
                </span>
                <span>{whiteboards.length} / {FREE_BOARD_LIMIT}</span>
              </div>
              <Progress value={(whiteboards.length / FREE_BOARD_LIMIT) * 100} className="h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" />
                  Journals
                </span>
                <span>{journals.length} / {FREE_JOURNAL_LIMIT}</span>
              </div>
              <Progress value={(journals.length / FREE_JOURNAL_LIMIT) * 100} className="h-1.5" />
            </div>
          </div>
        )}

        {/* User info */}
        {!collapsed && (
          <div className="pt-2 mt-2 border-t border-border">
            {user ? (
              <button
                onClick={() => router.push('/profile')}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {profile?.full_name
                    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
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
  );
}
