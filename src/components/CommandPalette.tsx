'use client';

import React, { useCallback, useEffect, useState } from 'react';
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

export function CommandPalette({ boards, journals, userRole }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();

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

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const hasRecentItems = (boards && boards.length > 0) || (journals && journals.length > 0);

  return (
    <CommandMenu
      open={open}
      onOpenChange={setOpen}
      chatEndpoint="/api/command-chat"
      askAILabel="Ask Agathon"
    >
      <CommandInput placeholder="Type a command or search..." showSendButton />
      <CommandList>
        <CommandEmpty />

        {hasRecentItems && (
          <CommandGroup heading="Recent">
            {boards?.map((board) => (
              <CommandItem
                key={`board-${board.id}`}
                value={`board-${board.id}`}
                onSelect={() => navigate(`/board/${board.id}`)}
              >
                <FolderOpen className="mr-2 size-4" />
                <span>{board.title}</span>
              </CommandItem>
            ))}
            {journals?.map((journal) => (
              <CommandItem
                key={`journal-${journal.id}`}
                value={`journal-${journal.id}`}
                onSelect={() => navigate(`/journal/${journal.id}`)}
              >
                <BookOpenText className="mr-2 size-4" />
                <span>{journal.title}</span>
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
          <CommandItem value="settings" onSelect={() => navigate('/settings')}>
            <GearSix className="mr-2 size-4" />
            <span>Settings</span>
            <CommandShortcut>G S</CommandShortcut>
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
