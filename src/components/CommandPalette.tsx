'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  House,
  FolderOpen,
  BookOpenText,
  User,
  GearSix,
  CreditCard,
  Plus,
  PencilLine,
  ShieldCheck,
  UsersThree,
  ChartBar,
  ClipboardText,
  GraduationCap,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import {
  CommandMenu,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from 'better-cmdk';
import { useAuth } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';

interface Board {
  id: string;
  title: string;
}

interface Journal {
  id: string;
  title: string;
}

interface CommandPaletteProps {
  boards?: Board[];
  journals?: Journal[];
  userRole?: string;
}

export function CommandPalette({ userRole }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchBoards, setSearchBoards] = useState<Board[]>([]);
  const [searchJournals, setSearchJournals] = useState<Journal[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createClient();

  const role = userRole ?? profile?.role;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live search when query changes
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!open) return;
    if (!query.trim()) {
      // Load recent items when palette opens with no query
      loadRecent();
      return;
    }
    searchTimeout.current = setTimeout(() => runSearch(query), 200);
  }, [query, open]);

  const loadRecent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [boardsRes, journalsRes] = await Promise.all([
      supabase.from('whiteboards').select('id, title').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5),
      supabase.from('journals').select('id, title').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5),
    ]);
    setSearchBoards((boardsRes.data || []) as Board[]);
    setSearchJournals((journalsRes.data || []) as Journal[]);
  };

  const runSearch = async (q: string) => {
    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [boardsRes, journalsRes] = await Promise.all([
        supabase.from('whiteboards').select('id, title').eq('user_id', user.id).ilike('title', `%${q}%`).limit(5),
        supabase.from('journals').select('id, title').eq('user_id', user.id).ilike('title', `%${q}%`).limit(5),
      ]);
      setSearchBoards((boardsRes.data || []) as Board[]);
      setSearchJournals((journalsRes.data || []) as Journal[]);
    } finally {
      setSearching(false);
    }
  };

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      router.push(path);
    },
    [router]
  );

  const hasResults = searchBoards.length > 0 || searchJournals.length > 0;

  return (
    <CommandMenu
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}
      chatEndpoint="/api/command-chat"
      askAILabel="Ask Agathon"
    >
      <div onChange={(e) => {
        const val = (e.target as HTMLInputElement).value;
        setQuery(val);
      }}>
        <CommandInput
          placeholder="Search journals, boards, or type a command…"
          showSendButton
        />
      </div>
      <CommandList>
        <CommandEmpty>{searching ? 'Searching…' : 'No results found.'}</CommandEmpty>

        {hasResults && (
          <CommandGroup heading={query.trim() ? 'Search results' : 'Recent'}>
            {searchBoards.map((board) => (
              <CommandItem
                key={`board-${board.id}`}
                value={`board-${board.id}-${board.title}`}
                onSelect={() => navigate(`/board/${board.id}`)}
              >
                <FolderOpen className="mr-2 size-4 text-purple-500" />
                <span>{board.title || 'Untitled board'}</span>
              </CommandItem>
            ))}
            {searchJournals.map((journal) => (
              <CommandItem
                key={`journal-${journal.id}`}
                value={`journal-${journal.id}-${journal.title}`}
                onSelect={() => navigate(`/journal/${journal.id}`)}
              >
                <BookOpenText className="mr-2 size-4 text-blue-500" />
                <span>{journal.title || 'Untitled journal'}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Navigation">
          <CommandItem value="home" onSelect={() => navigate('/')}>
            <House className="mr-2 size-4" />
            <span>Home</span>
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          <CommandItem value="my-boards" onSelect={() => navigate('/')}>
            <FolderOpen className="mr-2 size-4" />
            <span>My Boards</span>
            <CommandShortcut>G B</CommandShortcut>
          </CommandItem>
          <CommandItem value="my-journals" onSelect={() => navigate('/journal')}>
            <BookOpenText className="mr-2 size-4" />
            <span>My Journals</span>
            <CommandShortcut>G J</CommandShortcut>
          </CommandItem>
          <CommandItem value="profile" onSelect={() => navigate('/profile')}>
            <User className="mr-2 size-4" />
            <span>Profile</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem value="settings" onSelect={() => { setOpen(false); window.dispatchEvent(new Event('agathon-open-settings')); }}>
            <GearSix className="mr-2 size-4" />
            <span>Settings</span>
            <CommandShortcut>⌘ ,</CommandShortcut>
          </CommandItem>
          <CommandItem value="billing" onSelect={() => navigate('/billing')}>
            <CreditCard className="mr-2 size-4" />
            <span>Billing</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Create">
          <CommandItem value="new-board" onSelect={() => navigate(`/board/temp-${Date.now()}`)}>
            <Plus className="mr-2 size-4" />
            <span>New Board</span>
            <CommandShortcut>C B</CommandShortcut>
          </CommandItem>
          <CommandItem value="new-journal" onSelect={() => navigate('/journal')}>
            <PencilLine className="mr-2 size-4" />
            <span>New Journal</span>
            <CommandShortcut>C J</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {role === 'admin' && (
          <CommandGroup heading="Admin">
            <CommandItem value="admin-console" onSelect={() => navigate('/admin')}>
              <ShieldCheck className="mr-2 size-4" />
              <span>Admin Console</span>
            </CommandItem>
            <CommandItem value="user-management" onSelect={() => navigate('/admin/users')}>
              <UsersThree className="mr-2 size-4" />
              <span>User Management</span>
            </CommandItem>
            <CommandItem value="analytics" onSelect={() => navigate('/admin/analytics')}>
              <ChartBar className="mr-2 size-4" />
              <span>Analytics</span>
            </CommandItem>
            <CommandItem value="audit-logs" onSelect={() => navigate('/admin/logs')}>
              <ClipboardText className="mr-2 size-4" />
              <span>Audit Logs</span>
            </CommandItem>
          </CommandGroup>
        )}

        {role === 'teacher' && (
          <CommandGroup heading="Teacher">
            <CommandItem value="teacher-dashboard" onSelect={() => navigate('/teacher')}>
              <GraduationCap className="mr-2 size-4" />
              <span>Teacher Dashboard</span>
            </CommandItem>
            <CommandItem value="my-classes" onSelect={() => navigate('/teacher/classes')}>
              <UsersThree className="mr-2 size-4" />
              <span>My Classes</span>
            </CommandItem>
            <CommandItem value="create-assignment" onSelect={() => navigate('/teacher/assignments/create')}>
              <ClipboardText className="mr-2 size-4" />
              <span>Create Assignment</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandMenu>
  );
}
