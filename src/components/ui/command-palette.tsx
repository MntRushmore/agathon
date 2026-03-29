'use client';

/**
 * Global ⌘K Command Palette
 * Inspired by AFFiNE's cmdk implementation — context-aware, keyboard-navigable,
 * searches journals, boards, and surfaces quick actions.
 */

import { useEffect, useState, useCallback, useTransition } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import {
  MagnifyingGlass, BookOpenText, PenNib, Gear, Plus,
  ArrowRight, Sparkle, House, UserCircle, SignOut,
  Keyboard, Sun, Moon, DesktopTower, Note,
} from '@phosphor-icons/react';

// ── Types ──────────────────────────────────────────────────

interface CmdItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string;
  group: string;
  danger?: boolean;
}

// ── Palette component ──────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function CommandPalette({ open, onClose, onOpenSettings }: CommandPaletteProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [journals, setJournals] = useState<{ id: string; title: string }[]>([]);
  const [boards, setBoards] = useState<{ id: string; title: string }[]>([]);
  const [, startTransition] = useTransition();

  // Reset query on open
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // Fetch recent docs when open
  useEffect(() => {
    if (!open || !user) return;
    const sb = createClient();
    sb.from('journals').select('id, title').order('updated_at', { ascending: false }).limit(8)
      .then(({ data }) => setJournals(data ?? []));
    sb.from('whiteboards').select('id, title').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(6)
      .then(({ data }) => setBoards(data ?? []));
  }, [open, user]);

  const go = useCallback((path: string) => {
    onClose();
    startTransition(() => router.push(path));
  }, [onClose, router]);

  // Static actions
  const actions: CmdItem[] = [
    {
      id: 'go-home', label: 'Go to Home', icon: <House className="h-4 w-4" />,
      action: () => go('/'), group: 'Navigation',
    },
    {
      id: 'new-journal', label: 'New Journal', subtitle: 'Create a blank journal',
      icon: <Plus className="h-4 w-4" />, action: () => go('/journal'), group: 'Create',
      keywords: 'create note document',
    },
    {
      id: 'new-board', label: 'New Whiteboard', subtitle: 'Open a blank canvas',
      icon: <Plus className="h-4 w-4" />, action: () => go('/'), group: 'Create',
      keywords: 'create canvas draw sketch',
    },
    {
      id: 'go-journals', label: 'All Journals', icon: <BookOpenText className="h-4 w-4" />,
      action: () => go('/journal'), group: 'Navigation', keywords: 'notes documents',
    },
    {
      id: 'go-knowledge', label: 'Knowledge Base', icon: <Note className="h-4 w-4" />,
      action: () => go('/knowledge'), group: 'Navigation',
    },
    {
      id: 'open-settings', label: 'Open Settings', subtitle: '⌘,',
      icon: <Gear className="h-4 w-4" />,
      action: () => { onClose(); onOpenSettings(); }, group: 'Navigation',
      keywords: 'preferences appearance theme',
    },
    {
      id: 'go-profile', label: 'Account & Profile', icon: <UserCircle className="h-4 w-4" />,
      action: () => { onClose(); onOpenSettings(); }, group: 'Navigation',
    },
    {
      id: 'theme-light', label: 'Switch to Light mode', icon: <Sun className="h-4 w-4" />,
      action: () => { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); onClose(); },
      group: 'Appearance', keywords: 'theme color mode',
    },
    {
      id: 'theme-dark', label: 'Switch to Dark mode', icon: <Moon className="h-4 w-4" />,
      action: () => { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); onClose(); },
      group: 'Appearance', keywords: 'theme color mode',
    },
    {
      id: 'theme-system', label: 'Use System theme', icon: <DesktopTower className="h-4 w-4" />,
      action: () => {
        localStorage.removeItem('theme');
        document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        onClose();
      },
      group: 'Appearance',
    },
    ...(user ? [{
      id: 'sign-out', label: 'Sign out', icon: <SignOut className="h-4 w-4" />,
      action: () => { onClose(); signOut(); }, group: 'Account', danger: true,
    }] : []),
  ];

  // Dynamic journal items
  const journalItems: CmdItem[] = journals.map(j => ({
    id: `journal-${j.id}`,
    label: j.title || 'Untitled Journal',
    icon: <BookOpenText className="h-4 w-4" />,
    action: () => go(`/journal/${j.id}`),
    group: 'Recent Journals',
  }));

  // Dynamic board items
  const boardItems: CmdItem[] = boards.map(b => ({
    id: `board-${b.id}`,
    label: b.title || 'Untitled Board',
    icon: <PenNib className="h-4 w-4" />,
    action: () => go(`/board/${b.id}`),
    group: 'Recent Boards',
  }));

  const allItems = [...actions, ...journalItems, ...boardItems];

  // Group items
  const grouped = allItems.reduce<Record<string, CmdItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]',
        'transition-all duration-150',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-[560px] mx-4 bg-white rounded-2xl shadow-2xl border border-[#e2e4e8] overflow-hidden',
          'transition-all duration-150',
          open ? 'scale-100 translate-y-0' : 'scale-95 -translate-y-2'
        )}
      >
        <Command
          className="flex flex-col"
          shouldFilter={true}
          filter={(value, search) => {
            const item = allItems.find(i => i.id === value);
            if (!item) return 0;
            const haystack = `${item.label} ${item.subtitle ?? ''} ${item.keywords ?? ''}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-[#e2e4e8]">
            <MagnifyingGlass className="h-4 w-4 text-[#9096a2] flex-shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search journals, boards, actions…"
              className="flex-1 py-4 text-[14px] text-[#1a1d2b] placeholder:text-[#9096a2] bg-transparent border-none outline-none focus:ring-0"
              autoFocus
            />
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-[#f0f1f3] rounded text-[11px] text-[#9096a2] font-mono">
              esc
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-y-auto py-2 overscroll-contain">
            <Command.Empty className="flex flex-col items-center justify-center py-10 text-center">
              <Sparkle className="h-8 w-8 text-[#e2e4e8] mb-3" weight="duotone" />
              <p className="text-[13px] text-[#9096a2]">No results for &ldquo;{query}&rdquo;</p>
            </Command.Empty>

            {Object.entries(grouped).map(([group, items]) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[#9096a2] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={item.action}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl cursor-pointer text-left select-none',
                      'transition-colors duration-75',
                      'data-[selected=true]:bg-[#f0f1f3]',
                      item.danger && 'data-[selected=true]:bg-red-50 text-red-600'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-lg border flex-shrink-0',
                      item.danger
                        ? 'bg-red-50 border-red-200 text-red-500'
                        : 'bg-white border-[#e2e4e8] text-[#4a4f5c]'
                    )}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-[13px] font-medium truncate', item.danger ? 'text-red-600' : 'text-[#1a1d2b]')}>
                        {item.label}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-[#9096a2] truncate">{item.subtitle}</div>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#c4c7cd] flex-shrink-0 opacity-0 group-data-[selected=true]:opacity-100" />
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[#f0f1f3] bg-[#fafafa]">
            <span className="text-[11px] text-[#9096a2] flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span className="mx-1">·</span>
              <span><kbd className="font-mono">↵</kbd> select</span>
              <span className="mx-1">·</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
