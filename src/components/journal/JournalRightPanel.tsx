'use client';

/**
 * JournalRightPanel — AFFiNE-style right sidebar for journal editor.
 *
 * Tabs (matching screenshot icon strip):
 *   AI     — Agathon AI chat
 *   ToC    — Table of contents (headings)
 *   Cal    — Calendar / journal date picker + "Set a Template" banner
 *   Tpl    — Templates
 *   Frame  — (coming soon placeholder)
 *   Chat   — (coming soon placeholder)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from 'date-fns';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';

// ── Types ──

export type RightPanelTab = 'ai' | 'toc' | 'cal' | 'tpl' | 'frame' | 'chat';

interface TocHeading {
  level: number;
  text: string;
  index: number;
}

interface JournalDay {
  id: string;
  title: string;
  updated_at: string;
}

interface JournalRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;

  // AI tab props
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string; written?: boolean }>;
  isChatting: boolean;
  onSendMessage: (msg: string) => void;
  onClearChat: () => void;
  pendingMessageIndex: number | null;
  onAcceptContent: () => void;
  onDismissContent: () => void;
  onReapplyContent: (content: string, idx: number) => void;
  onCopyMessage: (content: string) => void;
  renderMarkdown: (text: string) => string;
  showSlashMenu: boolean;
  commandInput: string;
  chatInput: string;
  onCommandInputChange: (value: string) => void;
  onChatInputChange: (value: string) => void;
  onChatKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmitChat: () => void;

  // ToC tab props
  content: string;

  // Calendar tab props
  journalId?: string;
  journalTitle?: string;
}

// ── Calendar helpers ──

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Main component ──

export function JournalRightPanel({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  chatMessages,
  isChatting,
  onSendMessage,
  onClearChat,
  pendingMessageIndex,
  onAcceptContent,
  onDismissContent,
  onReapplyContent,
  onCopyMessage,
  renderMarkdown,
  showSlashMenu,
  commandInput,
  chatInput,
  onCommandInputChange,
  onChatInputChange,
  onChatKeyDown,
  onSubmitChat,
  content,
  journalId,
}: JournalRightPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date());
  const [journalDays, setJournalDays] = useState<JournalDay[]>([]);
  const [showTemplateBanner, setShowTemplateBanner] = useState(true);

  // Load journals for calendar dots
  useEffect(() => {
    if (!user || activeTab !== 'cal') return;
    const load = async () => {
      const start = format(startOfMonth(calMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(calMonth), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('journals')
        .select('id, title, updated_at')
        .gte('updated_at', start)
        .lte('updated_at', end + 'T23:59:59');
      setJournalDays(data || []);
    };
    load();
  }, [user, calMonth, activeTab, supabase]);

  // ToC — extract headings from markdown content
  const tocHeadings: TocHeading[] = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) tocHeadings.push({ level: m[1].length, text: m[2].trim(), index: i });
  });

  // Calendar days grid
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = monthStart.getDay(); // 0=Sun

  const getDayJournals = (d: Date) =>
    journalDays.filter(j => isSameDay(new Date(j.updated_at), d));

  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const inputRef = useRef<HTMLInputElement>(null);

  const TABS: Array<{ id: RightPanelTab; icon: React.ReactNode; label: string }> = [
    { id: 'ai',    icon: <SparkleIcon />,    label: 'AI' },
    { id: 'toc',   icon: <ListIcon />,       label: 'Contents' },
    { id: 'cal',   icon: <CalendarIcon />,   label: 'Calendar' },
    { id: 'tpl',   icon: <TemplateIcon />,   label: 'Templates' },
    { id: 'frame', icon: <FrameIcon />,      label: 'Frames' },
    { id: 'chat',  icon: <ChatBubbleIcon />, label: 'Chat' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 440, damping: 42 }}
          className="fixed right-0 top-0 bottom-0 z-[80] flex"
          style={{ width: 320 }}
        >
          {/* Tab icon strip — leftmost column */}
          <div
            className="flex flex-col items-center pt-2 gap-0.5 flex-shrink-0"
            style={{
              width: 40,
              background: 'var(--affine-background-primary-color, #1a1a1a)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.label}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150',
                  activeTab === tab.id
                    ? 'text-[#1e6ee8] bg-[rgba(30,110,232,0.15)]'
                    : 'text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.07)]'
                )}
                style={{ margin: '1px 0' }}
              >
                {tab.icon}
              </button>
            ))}
            <div className="flex-1" />
            {/* Collapse button */}
            <button
              onClick={onClose}
              title="Close panel"
              className="flex items-center justify-center w-7 h-7 rounded-lg mb-3 transition-all duration-150 text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.07)]"
            >
              <CollapseRightIcon />
            </button>
          </div>

          {/* Main panel content */}
          <div
            className="flex flex-col flex-1 overflow-hidden"
            style={{
              background: 'var(--affine-background-primary-color, #1a1a1a)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-3 py-2 flex-shrink-0"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                height: 40,
              }}
            >
              <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {TABS.find(t => t.id === activeTab)?.label ?? 'Panel'}
              </span>
              <div className="flex items-center gap-0.5">
                <PanelHeaderBtn title="New chat" onClick={activeTab === 'ai' ? onClearChat : undefined}>
                  <PlusSmIcon />
                </PanelHeaderBtn>
                <PanelHeaderBtn title="Pin">
                  <PinIcon />
                </PanelHeaderBtn>
                <PanelHeaderBtn title="Close" onClick={onClose}>
                  <ChevronDownIcon />
                </PanelHeaderBtn>
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden relative">

              {/* ── AI TAB ── */}
              {activeTab === 'ai' && (
                <div className="absolute inset-0 flex flex-col">
                  {/* Messages */}
                  <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto"
                    style={{ padding: chatMessages.length === 0 ? 0 : '12px' }}
                  >
                    {chatMessages.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 gap-3">
                        <AffineAIBigIcon />
                        <p className="text-[17px] font-semibold text-white text-center">
                          What can I help you with?
                        </p>
                        <div className="w-full mt-2 space-y-1">
                          {[
                            { icon: <TranslateIcon />, text: 'Read a foreign language article with AI' },
                            { icon: <MindmapIcon />,   text: 'Tidy an article with AI MindMap Action' },
                            { icon: <ImageAIIcon />,   text: 'Add illustrations to the article' },
                            { icon: <PenIcon />,       text: 'Complete writing with AI' },
                            { icon: <SendSmIcon />,    text: 'Freely communicate with AI' },
                          ].map((item, i) => (
                            <button
                              key={i}
                              onClick={() => onSendMessage(item.text)}
                              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left"
                              style={{ color: 'rgba(255,255,255,0.75)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{item.icon}</span>
                              <span className="text-[12px]">{item.text}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {chatMessages.map((msg, idx) => (
                          <div key={idx}>
                            {msg.role === 'user' ? (
                              <div className="flex justify-end">
                                <div
                                  className="text-white text-[13px] leading-relaxed max-w-[220px] px-3 py-2"
                                  style={{
                                    background: '#1e6ee8',
                                    borderRadius: '14px 4px 14px 14px',
                                  }}
                                >
                                  {msg.content}
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 items-start">
                                <div
                                  className="flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    background: '#1e6ee8',
                                  }}
                                >
                                  <AffineAISmIcon />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div
                                    className="text-[12.5px] leading-relaxed"
                                    style={{ color: 'rgba(255,255,255,0.82)' }}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                  />
                                  {/* Action buttons */}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {msg.written ? (
                                      <span className="text-[10px] text-[#1e6ee8] font-medium flex items-center gap-1">
                                        <CheckSmIcon /> Written!
                                      </span>
                                    ) : pendingMessageIndex === idx ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={onAcceptContent}
                                          className="text-[10px] px-2 py-0.5 rounded-md font-medium text-white"
                                          style={{ background: '#1e6ee8' }}
                                        >
                                          Add to Journal
                                        </button>
                                        <button
                                          onClick={onDismissContent}
                                          className="text-[10px] font-medium"
                                          style={{ color: 'rgba(255,255,255,0.4)' }}
                                        >
                                          Dismiss
                                        </button>
                                      </div>
                                    ) : null}
                                    <button
                                      onClick={() => onCopyMessage(msg.content)}
                                      className="ml-auto flex items-center p-0.5 rounded transition-colors"
                                      style={{ color: 'rgba(255,255,255,0.3)' }}
                                      title="Copy"
                                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                                    >
                                      <CopySmIcon />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {isChatting && (
                          <div className="flex gap-2 items-center">
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#1e6ee8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                            <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Thinking…</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Input area — exact AFFiNE ai-chat-input */}
                  <div className="flex-shrink-0 px-3 pb-3">
                    {chatMessages.length > 0 && (
                      <button
                        onClick={onClearChat}
                        className="mb-2 text-[10px] transition-colors"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                      >
                        Clear conversation
                      </button>
                    )}
                    {/* Input card */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={showSlashMenu ? commandInput : chatInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.startsWith('/')) {
                            onCommandInputChange(v);
                          } else {
                            onChatInputChange(v);
                          }
                        }}
                        onKeyDown={onChatKeyDown}
                        placeholder="What are your thoughts?"
                        className="w-full bg-transparent outline-none text-[13px] px-3 pt-2.5 pb-1"
                        style={{
                          color: 'rgba(255,255,255,0.85)',
                        }}
                      />
                      <div
                        className="flex items-center justify-between px-2 pb-2"
                        style={{ paddingTop: 2 }}
                      >
                        <div className="flex items-center gap-0.5">
                          {/* + attach */}
                          <SmallIconBtn title="Attach context">
                            <PlusSmIcon />
                          </SmallIconBtn>
                          {/* Mode chevron */}
                          <SmallIconBtn title="Change mode">
                            <ChevronSmIcon />
                          </SmallIconBtn>
                        </div>
                        {/* Send */}
                        <button
                          onClick={onSubmitChat}
                          disabled={!(showSlashMenu ? commandInput : chatInput).trim()}
                          title="Send"
                          className="flex items-center justify-center rounded-full transition-all duration-150"
                          style={{
                            width: 28, height: 28,
                            background: (showSlashMenu ? commandInput : chatInput).trim()
                              ? '#1e6ee8'
                              : 'rgba(255,255,255,0.08)',
                            color: (showSlashMenu ? commandInput : chatInput).trim()
                              ? '#fff'
                              : 'rgba(255,255,255,0.2)',
                            cursor: (showSlashMenu ? commandInput : chatInput).trim() ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <SendUpIcon />
                        </button>
                      </div>
                    </div>
                    {/* Footer disclaimer */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <InfoSmIcon />
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        AI outputs can be misleading or wrong
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TABLE OF CONTENTS TAB ── */}
              {activeTab === 'toc' && (
                <div className="absolute inset-0 overflow-y-auto px-3 py-3">
                  {tocHeadings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-2">
                      <ListIcon />
                      <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        No headings yet
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Add ## headings to your journal to see them here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {tocHeadings.map((h, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-2 py-1.5 rounded-lg transition-colors text-[12px] leading-snug"
                          style={{
                            paddingLeft: `${(h.level - 1) * 12 + 8}px`,
                            color: h.level === 1 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
                            fontWeight: h.level === 1 ? 500 : 400,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {h.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── CALENDAR TAB ── */}
              {activeTab === 'cal' && (
                <div className="absolute inset-0 overflow-y-auto">
                  {/* Template banner — "Set a Template for the Journal" */}
                  {showTemplateBanner && (
                    <div
                      className="mx-3 mt-3 rounded-xl overflow-hidden relative"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <button
                        onClick={() => setShowTemplateBanner(false)}
                        className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded transition-colors"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                      >
                        <XSmIcon />
                      </button>
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[13px] font-semibold text-white leading-snug mb-2">
                          Set a Template for the Journal
                        </p>
                        <div
                          className="rounded-lg overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.06)', height: 64 }}
                        >
                          <div className="flex items-center justify-center h-full gap-2">
                            <div className="flex flex-col items-center gap-0.5">
                              <div style={{ width: 28, height: 36, background: '#f5f5f5', borderRadius: 4 }} />
                              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Journal</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Calendar */}
                  <div className="px-3 py-3">
                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-white">
                          {format(calMonth, 'MMM')}
                        </span>
                        <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {format(calMonth, 'yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCalMonth(subMonths(calMonth, 1))}
                          className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                        >
                          <ChevLeftIcon />
                        </button>
                        <button
                          onClick={() => setCalMonth(new Date())}
                          className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                          style={{
                            color: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          TODAY
                        </button>
                        <button
                          onClick={() => setCalMonth(addMonths(calMonth, 1))}
                          className="flex items-center justify-center w-6 h-6 rounded transition-colors"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                        >
                          <ChevRightIcon />
                        </button>
                      </div>
                    </div>

                    {/* Day-of-week labels */}
                    <div className="grid grid-cols-7 mb-1">
                      {DAYS.map(d => (
                        <div key={d} className="flex items-center justify-center h-6">
                          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {d}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-y-0.5">
                      {/* Leading empty cells */}
                      {Array.from({ length: startDow }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {days.map((day) => {
                        const dayJournals = getDayJournals(day);
                        const today = isToday(day);
                        const sameMonth = isSameMonth(day, calMonth);
                        const hasJournals = dayJournals.length > 0;

                        return (
                          <div key={day.toISOString()} className="flex flex-col items-center">
                            <button
                              onClick={() => {
                                if (dayJournals.length > 0) {
                                  router.push(`/journal/${dayJournals[0].id}`);
                                } else {
                                  // Navigate to create new journal for this date
                                  router.push('/journal');
                                }
                              }}
                              className="relative flex items-center justify-center rounded-full w-7 h-7 text-[12px] font-medium transition-all"
                              style={{
                                color: today
                                  ? '#fff'
                                  : sameMonth
                                  ? 'rgba(255,255,255,0.75)'
                                  : 'rgba(255,255,255,0.2)',
                                background: today ? '#1e6ee8' : 'transparent',
                              }}
                              onMouseEnter={e => {
                                if (!today) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                              }}
                              onMouseLeave={e => {
                                if (!today) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {format(day, 'd')}
                            </button>
                            {/* Dots for journals on this day */}
                            {hasJournals && (
                              <div className="flex gap-0.5 mt-0.5">
                                {dayJournals.slice(0, 2).map((j, i) => (
                                  <div
                                    key={i}
                                    className="w-1 h-1 rounded-full"
                                    style={{ background: i === 0 ? '#1e6ee8' : '#e34' }}
                                  />
                                ))}
                              </div>
                            )}
                            {!hasJournals && <div className="h-1.5" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TEMPLATES TAB ── */}
              {activeTab === 'tpl' && (
                <div className="absolute inset-0 overflow-y-auto px-3 py-4">
                  <p className="text-[12px] font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    TEMPLATES
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Study Notes', emoji: '📝' },
                      { label: 'Daily Log', emoji: '📅' },
                      { label: 'Flashcard Set', emoji: '🃏' },
                      { label: 'Problem Set', emoji: '🧮' },
                      { label: 'Reading Notes', emoji: '📚' },
                      { label: 'Mind Map', emoji: '🧠' },
                    ].map(t => (
                      <button
                        key={t.label}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-4 text-center transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onClick={() => {}}
                      >
                        <span className="text-2xl">{t.emoji}</span>
                        <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── FRAME / CHAT TABS — coming soon ── */}
              {(activeTab === 'frame' || activeTab === 'chat') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6">
                  <span className="text-3xl">{activeTab === 'frame' ? '🖼' : '💬'}</span>
                  <p className="text-[13px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {activeTab === 'frame' ? 'Frame Navigator' : 'Comments'} coming soon
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Small reusable button components ──

function PanelHeaderBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors duration-150"
      style={{ color: 'rgba(255,255,255,0.35)', background: 'transparent' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
    >
      {children}
    </button>
  );
}

function SmallIconBtn({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <button
      title={title}
      className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
      style={{ color: 'rgba(255,255,255,0.35)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
    >
      {children}
    </button>
  );
}

// ── Icons ──

function SparkleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1={8} y1={6} x2={21} y2={6} />
      <line x1={8} y1={12} x2={21} y2={12} />
      <line x1={8} y1={18} x2={21} y2={18} />
      <line x1={3} y1={6} x2={3.01} y2={6} />
      <line x1={3} y1={12} x2={3.01} y2={12} />
      <line x1={3} y1={18} x2={3.01} y2={18} />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={18} rx={2} />
      <line x1={16} y1={2} x2={16} y2={6} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={3} y1={10} x2={21} y2={10} />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={7} height={7} />
      <rect x={14} y={3} width={7} height={7} />
      <rect x={14} y={14} width={7} height={7} />
      <rect x={3} y={14} width={7} height={7} />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CollapseRightIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <line x1={15} y1={3} x2={15} y2={21} />
      <polyline points="9 9 6 12 9 15" />
    </svg>
  );
}

function AffineAIBigIcon() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: 52, height: 52, borderRadius: 16, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <path d="M11.28 5.49c-.04-.36-.34-.63-.71-.63s-.67.27-.71.63c-.27 2.35-.97 4-2.1 5.12C6.63 11.75 4.98 12.45 2.63 12.72c-.36.04-.63.35-.63.71s.27.67.63.71c2.31.26 4 .96 5.15 2.1 1.15 1.13 1.87 2.78 2.07 5.11.03.37.34.65.71.65s.67-.27.71-.65c.2-2.29.91-3.97 2.07-5.13 1.16-1.16 2.84-1.87 5.13-2.07.37-.03.65-.34.65-.71s-.27-.67-.65-.71c-2.33-.21-3.98-.93-5.11-2.06C12.22 9.49 11.52 7.81 11.28 5.49z" fill="#1e6ee8"/>
        <path d="M19.5 2.5c-.02-.21-.2-.37-.42-.37s-.4.16-.42.37c-.16 1.38-.57 2.35-1.24 3.02-.67.67-1.64 1.08-3.02 1.24-.21.02-.37.2-.37.42s.16.4.37.42c1.36.16 2.35.57 3.02 1.24.67.67 1.08 1.64 1.24 3.02.02.21.2.37.42.37s.4-.16.42-.37c.16-1.36.57-2.35 1.24-3.02.67-.67 1.64-1.08 3.02-1.24.21-.02.37-.2.37-.42s-.16-.4-.37-.42c-1.37-.16-2.35-.57-3.02-1.24-.67-.67-1.08-1.64-1.24-3.02z" fill="#1e6ee8"/>
      </svg>
    </div>
  );
}

function AffineAISmIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="white">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function TranslateIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>;
}
function MindmapIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={12} cy={12} r={3}/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
}
function ImageAIIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={3} width={18} height={18} rx={2}/><circle cx={8.5} cy={8.5} r={1.5}/><polyline points="21 15 16 10 5 21"/></svg>;
}
function PenIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
}
function SendSmIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1={22} y1={2} x2={11} y2={13}/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}

function PlusSmIcon() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>;
}
function PinIcon() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1={12} y1={17} x2={12} y2={22}/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>;
}
function ChevronDownIcon() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function ChevronSmIcon() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;
}
function SendUpIcon() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={19} x2={12} y2={5}/><polyline points="5 12 12 5 19 12"/></svg>;
}
function InfoSmIcon() {
  return <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={12} r={10}/><line x1={12} y1={16} x2={12} y2={12}/><line x1={12} y1={8} x2={12.01} y2={8}/></svg>;
}
function CheckSmIcon() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function CopySmIcon() {
  return <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={9} y={9} width={13} height={13} rx={2}/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function XSmIcon() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>;
}
function ChevLeftIcon() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevRightIcon() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
