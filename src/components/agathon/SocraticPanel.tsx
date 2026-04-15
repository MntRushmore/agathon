'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '@/components/auth/auth-provider';

/** Minimal markdown → HTML for the dark AI panel. No external deps. */
function renderMd(text: string): string {
  // Stash block math ($$...$$) and inline math ($...$) before escaping HTML,
  // then restore them as styled spans so equations render visibly.
  const mathBlocks: string[] = [];
  let h = text
    // Extract block math first ($$...$$) — multiline
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
      mathBlocks.push(`<div style="text-align:center;margin:8px 0;padding:8px;background:rgba(255,255,255,0.05);border-radius:8px;font-family:monospace;font-size:13px;color:rgba(255,255,255,0.9);overflow-x:auto">${expr.trim()}</div>`);
      return `\x00math${mathBlocks.length - 1}\x00`;
    })
    // Extract inline math ($...$)
    .replace(/\$([^$\n]+?)\$/g, (_m, expr) => {
      mathBlocks.push(`<code style="background:rgba(30,110,232,0.15);padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace;color:rgba(180,200,255,0.9)">${expr.trim()}</code>`);
      return `\x00math${mathBlocks.length - 1}\x00`;
    });

  h = h
    // Escape HTML (now safe — math is stashed)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks (``` ... ```)
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_m, code) =>
      `<pre style="background:rgba(255,255,255,0.06);border-radius:8px;padding:10px 12px;font-size:12px;overflow-x:auto;margin:6px 0;font-family:monospace;line-height:1.5">${code.trim()}</pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:rgba(255,255,255,0.95)">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<div style="font-size:13px;font-weight:700;margin:10px 0 4px;color:#fff">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-size:14px;font-weight:700;margin:12px 0 4px;color:#fff">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-size:15px;font-weight:700;margin:12px 0 4px;color:#fff">$1</div>')
    // Bullet lists
    .replace(/^[-*] (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="opacity:0.5;flex-shrink:0">•</span><span>$1</span></div>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="opacity:0.5;flex-shrink:0;min-width:14px">·</span><span>$1</span></div>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:8px 0"/>')
    // Double newlines → paragraph break
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    // Single newlines → <br>
    .replace(/\n/g, '<br/>');

  // Restore stashed math (un-escaped)
  h = h.replace(/\x00math(\d+)\x00/g, (_m, i) => mathBlocks[Number(i)]);
  return h;
}

export type SocraticMode = 'socratic' | 'explain' | 'hint' | 'answer';

export interface SocraticMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: SocraticMode;
  timestamp: Date;
}

interface SocraticPanelProps {
  isOpen: boolean;
  onClose: () => void;
  getCanvasContext: () => string;
  getCanvasScreenshot?: () => string | null;
  subject?: string;
  selectedText?: string;
  onClearSelection?: () => void;
  /** Optional grounding context — journal content, notes, etc. (RAG) */
  docContext?: string;
  /** Label for the doc context source, e.g. "Journal: Derivatives" */
  docContextLabel?: string;
}

// Agathon's 5 onboarding items — same structure as AFFiNE's AIPreloadConfig
const PRELOAD_CONFIG: Array<{
  icon: React.ReactNode;
  text: string;
  mode: SocraticMode;
}> = [
  { icon: <LanguageIcon />,  text: 'Guide me through this with questions',   mode: 'socratic' },
  { icon: <MindmapIcon />,   text: 'Map out the concepts on my canvas',      mode: 'explain'  },
  { icon: <ImageIcon />,     text: 'Explain this with examples and analogies', mode: 'explain' },
  { icon: <PenIcon />,       text: 'Give me a hint without the answer',      mode: 'hint'     },
  { icon: <SendIcon />,      text: 'Show me the full solution',              mode: 'answer'   },
];

const MODE_LABELS: Record<SocraticMode, string> = {
  socratic: 'Socratic',
  explain:  'Explain',
  hint:     'Hint',
  answer:   'Answer',
};

export default function SocraticPanel({
  isOpen,
  onClose,
  getCanvasContext,
  getCanvasScreenshot,
  subject,
  selectedText,
  onClearSelection,
  docContext,
  docContextLabel,
}: SocraticPanelProps) {
  const { profile } = useAuth();
  const isEnterprise = (profile?.plan_tier === 'premium' || profile?.plan_tier === 'enterprise')
    && profile?.plan_status === 'active';
  const [modelLabel, setModelLabel] = useState<string | null>(null);

  const [messages, setMessages] = useState<SocraticMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<SocraticMode>('socratic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState<'solve' | 'step-by-step' | 'socratic' | 'example'>('step-by-step');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisImageUrl, setAnalysisImageUrl] = useState<string | null>(null);
  const [showAnalyzeModeMenu, setShowAnalyzeModeMenu] = useState(false);
  // Session ID — persists across messages in this panel open, resets on startFresh
  const sessionIdRef = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  // Web search state
  const [isSearching, setIsSearching] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (selectedText && isOpen) {
      setInput(`"${selectedText}"`);
      inputRef.current?.focus();
    }
  }, [selectedText, isOpen]);

  // Scroll tracking — matches AFFiNE's _onScroll
  const handleScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages, scrollToEnd]);

  const buildSystemPrompt = useCallback((m: SocraticMode, context: string, hasImage: boolean): string => {
    // Doc context (journal/notes) as grounding — ported from AFFiNE's ChatOptions.contexts
    const docSection = docContext
      ? `\n\nThe student's notes/journal (use this to ground your answers):\n<doc_context label="${docContextLabel || 'Notes'}">${docContext.slice(0, 4000)}</doc_context>`
      : '';

    const canvasSection = hasImage
      ? `A screenshot of the student's canvas is attached to their message. Use it to see exactly what they've written or drawn.`
      : `The student's current canvas text:\n<canvas_context>${context || '(empty canvas)'}</canvas_context>`;

    const base = `You are Agathon, a Socratic AI tutor${subject ? ` for ${subject}` : ''}.
Session ID: ${sessionIdRef.current}
${canvasSection}${docSection}`;

    const instructions: Record<SocraticMode, string> = {
      socratic: `${base}\n\nNEVER give direct answers. Ask one focused probing question at a time. Reference their canvas when relevant.`,
      explain:  `${base}\n\nExplain clearly using analogies and examples. Reference the canvas to connect concepts. End with a check-for-understanding question.`,
      hint:     `${base}\n\nGive minimal hints that unlock the next step without the full solution. Reference what you see on the canvas to point them in the right direction.`,
      answer:   `${base}\n\nProvide clear, complete answers with step-by-step reasoning. Reference what you see on the canvas to make the answer concrete.`,
    };
    return instructions[m];
  }, [subject, docContext, docContextLabel]);

  const sendMessage = useCallback(async (content: string, overrideMode?: SocraticMode) => {
    if (!content.trim() || isLoading) return;
    setError(null);
    const activeMode = overrideMode ?? mode;

    const userMsg: SocraticMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    if (onClearSelection) onClearSelection();

    const context = getCanvasContext();
    const screenshot = getCanvasScreenshot?.() ?? null;
    const systemPrompt = buildSystemPrompt(activeMode, context, !!screenshot);

    // Build messages — attach screenshot to the last user message so the model can see the canvas
    const baseMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }));
    const messagesWithImage = screenshot
      ? baseMessages.map((m, i) =>
          i === baseMessages.length - 1
            ? { ...m, image: screenshot }
            : m
        )
      : baseMessages;

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messagesWithImage,
    ];

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', mode: activeMode, timestamp: new Date() },
    ]);

    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const res = await fetch('/api/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode: activeMode }),
        signal: abortRef.current.signal,
      });
      // Capture which model was used from the response header
      const model = res.headers.get('X-Agathon-Model');
      if (model) setModelLabel(model);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? parsed.delta?.text ?? '';
            if (delta) {
              accumulated += delta;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            }
          } catch {
            if (data) {
              accumulated += data;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, mode, isLoading, getCanvasContext, buildSystemPrompt, onClearSelection]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startFresh = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setAnalysisImageUrl(null);
    // New session ID — fresh context window
    sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  // Web search — ported from AFFiNE's WebSearchTool
  const handleWebSearch = useCallback(async () => {
    const query = input.trim() || getCanvasContext().slice(0, 100);
    if (!query) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error('Search failed');
      const { results } = await res.json();
      if (!results?.length) return;

      // Format results as a message injected into the chat
      const formatted = results
        .map((r: { title: string; url: string; snippet: string }, i: number) =>
          `**${i + 1}. ${r.title}**\n${r.snippet}${r.url ? `\n[Source](${r.url})` : ''}`)
        .join('\n\n');

      const searchMsg: SocraticMessage = {
        id: `search-${Date.now()}`,
        role: 'assistant',
        content: `🔍 **Web search results for "${query}":**\n\n${formatted}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, searchMsg]);
    } catch {
      // silently fail — web search is best-effort
    } finally {
      setIsSearching(false);
    }
  }, [input, getCanvasContext]);

  const analyzeCanvas = useCallback(async () => {
    if (!getCanvasScreenshot || !isEnterprise) return;
    const screenshot = getCanvasScreenshot();
    if (!screenshot) {
      setError('Could not capture canvas. Try drawing something first.');
      return;
    }
    setIsAnalyzing(true);
    setAnalysisImageUrl(null);
    setError(null);
    try {
      const res = await fetch('/api/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: screenshot, mode: analyzeMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      // Show annotated image if returned (enterprise premium path)
      if (data.imageUrl) {
        setAnalysisImageUrl(data.imageUrl);
      }
      // Also inject the text feedback as an assistant message
      const textContent = data.feedback?.annotations?.map((a: { content: string }) => a.content).join('\n\n')
        || data.feedback?.summary
        || data.textContent
        || '';
      if (textContent) {
        const assistantMsg: SocraticMessage = {
          id: `analyze-${Date.now()}`,
          role: 'assistant',
          content: `**Canvas Analysis (${analyzeMode})**\n\n${textContent}`,
          mode: 'explain',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [getCanvasScreenshot, isEnterprise, analyzeMode]);

  const isEmpty = messages.length === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          className="absolute right-0 top-0 bottom-0 z-30 flex"
          style={{ width: 360 }}
        >
          {/* Left icon rail — matches AFFiNE's sidebar tab switcher */}
          <div
            style={{
              width: 44,
              background: 'var(--affine-background-primary-color, #1a1a1a)',
              borderLeft: '1px solid var(--affine-border-color, rgba(255,255,255,0.1))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 8,
              gap: 2,
            }}
          >
            <button
              title="Agathon AI"
              style={{
                width: 32, height: 32, borderRadius: 8, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--affine-primary-color, #1e6ee8)',
                background: 'var(--affine-hover-color, rgba(255,255,255,0.08))',
                border: 'none', cursor: 'pointer',
              }}
            >
              <AffineAIIcon color="var(--affine-primary-color, #1e6ee8)" size={16} />
            </button>
            {[
              { title: 'Table of contents', icon: <TOCIcon /> },
              { title: 'Journal', icon: <CalendarIcon /> },
              { title: 'Frame navigator', icon: <FrameIcon /> },
              { title: 'Template', icon: <GridIcon /> },
            ].map(({ title, icon }) => (
              <button
                key={title}
                title={title}
                style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'var(--affine-icon-secondary, rgba(255,255,255,0.3))',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                {icon}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              title="Collapse"
              style={{
                width: 32, height: 32, marginBottom: 8, borderRadius: 8, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--affine-icon-secondary, rgba(255,255,255,0.3))',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <CollapseRightIcon />
            </button>
          </div>

          {/* Main panel — exact AFFiNE structure */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--affine-background-primary-color, #1a1a1a)',
              borderLeft: '1px solid var(--affine-border-color, rgba(255,255,255,0.1))',
              overflow: 'hidden',
            }}
          >
            {/* Header — "AFFiNE AI" row with +, pin, chevron */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                height: 36,
                position: 'relative',
                zIndex: 1,
                borderBottom: '0.5px solid var(--affine-border-color, rgba(255,255,255,0.1))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--affine-text-secondary-color, rgba(255,255,255,0.5))',
                }}>
                  Agathon AI
                </span>
                {/* Model badge */}
                {isEnterprise ? (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 6px',
                    borderRadius: 20,
                    background: 'rgba(30,110,232,0.18)',
                    color: 'var(--affine-primary-color, #1e6ee8)',
                    letterSpacing: '0.02em',
                    border: '1px solid rgba(30,110,232,0.25)',
                  }}>
                    {modelLabel ?? 'Claude Sonnet'}
                  </span>
                ) : (
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: '2px 6px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.3)',
                  }}>
                    {modelLabel ?? 'Gemini Flash'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconBtn onClick={startFresh} title="New chat"><PlusIcon /></IconBtn>
                <IconBtn title="Pin"><PinIcon /></IconBtn>
                <IconBtn onClick={onClose} title="Close"><ChevronDownIcon /></IconBtn>
              </div>
            </div>

            {/* Doc context chip — shows when journal/notes are grounding the chat */}
            {docContext && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 14px',
                borderBottom: '0.5px solid rgba(255,255,255,0.07)',
                background: 'rgba(30,110,232,0.07)',
              }}>
                <span style={{ fontSize: 10, color: 'rgba(30,110,232,0.9)', fontWeight: 500, letterSpacing: '0.02em' }}>
                  📄 Context:
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {docContextLabel || 'Document'}
                </span>
              </div>
            )}

            {/* Messages area — matches AFFiNE's scrollable messages container */}
            <div
              ref={messagesRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                position: 'relative',
                minHeight: 0,
              }}
            >
              {/* chat-panel-messages-container */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 24,
                  minHeight: '100%',
                  position: 'relative',
                  padding: isEmpty ? 0 : '16px',
                }}
              >
                {/* Enterprise annotated image result */}
                {analysisImageUrl && (
                  <div style={{ padding: '12px 16px 0' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--affine-primary-color, #1e6ee8)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Annotated Canvas
                    </div>
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={analysisImageUrl}
                        alt="AI-annotated canvas"
                        style={{ width: '100%', display: 'block' }}
                      />
                      <button
                        onClick={() => setAnalysisImageUrl(null)}
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        <XIcon />
                      </button>
                    </div>
                  </div>
                )}

                {isEmpty && !analysisImageUrl ? (
                  /* messages-placeholder — exact AFFiNE CSS */
                  <div style={{
                    width: '100%',
                    position: 'absolute',
                    zIndex: 1,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0 16px',
                  }}>
                    {/* AFFiNE AI icon — exact SVG from affine/desktop/components/ai-island/icons.tsx */}
                    <AffineAIIcon size={36} color="var(--affine-primary-color, #1e6ee8)" />

                    {/* messages-placeholder-title */}
                    <div style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--affine-text-primary-color, #fff)',
                    }}>
                      What can I help you with?
                    </div>

                    {/* onboarding-wrapper — exact AFFiNE structure */}
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      flexDirection: 'column',
                      marginTop: 16,
                      width: '100%',
                    }}>
                      {PRELOAD_CONFIG.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => sendMessage(item.text, item.mode)}
                          style={{
                            display: 'flex',
                            height: 28,
                            gap: 8,
                            alignItems: 'center',
                            justifyContent: 'start',
                            cursor: 'pointer',
                          }}
                        >
                          {/* onboarding-item-icon */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--affine-text-secondary-color, rgba(255,255,255,0.4))',
                          }}>
                            {item.icon}
                          </div>
                          {/* onboarding-item-text */}
                          <div style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: 'var(--affine-text-primary-color, #fff)',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Enterprise upsell — only shown on free plan */}
                    {!isEnterprise && (
                      <div style={{
                        marginTop: 20,
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(30,110,232,0.12) 0%, rgba(124,58,237,0.12) 100%)',
                        border: '1px solid rgba(30,110,232,0.2)',
                        width: '100%',
                      }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                          color: 'var(--affine-primary-color, #1e6ee8)',
                          marginBottom: 4,
                          textTransform: 'uppercase',
                        }}>
                          Enterprise
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: 'var(--affine-text-primary-color, rgba(255,255,255,0.75))',
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}>
                          Upgrade for Claude Sonnet, 2× context, and handwritten visual feedback on your canvas.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                          {[
                            'Claude Sonnet (vs Gemini Flash)',
                            '2048 token responses',
                            'Visual handwriting feedback',
                          ].map((f) => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                              <span style={{ color: 'var(--affine-primary-color, #1e6ee8)', fontSize: 13 }}>✓</span>
                              {f}
                            </div>
                          ))}
                        </div>
                        <a
                          href="/billing"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: 'var(--affine-primary-color, #1e6ee8)',
                            color: '#fff', textDecoration: 'none',
                          }}
                        >
                          Upgrade plan →
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          display: 'flex',
                          gap: 10,
                          flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                          alignItems: 'flex-start',
                        }}
                      >
                        {msg.role === 'assistant' && (
                          <div style={{
                            width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
                            background: 'var(--affine-primary-color, #1e6ee8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <AffineAIIcon size={13} color="#fff" />
                          </div>
                        )}
                        <div style={{
                          maxWidth: '85%',
                          borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                          padding: '10px 14px',
                          fontSize: 13,
                          lineHeight: 1.55,
                          background: msg.role === 'user'
                            ? 'var(--affine-primary-color, #1e6ee8)'
                            : 'var(--affine-hover-color, rgba(255,255,255,0.06))',
                          color: msg.role === 'user'
                            ? '#fff'
                            : 'var(--affine-text-primary-color, rgba(255,255,255,0.85))',
                        }}>
                          {msg.content ? (
                            msg.role === 'assistant'
                              ? <span dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                              : msg.content
                          ) : (
                            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', opacity: 0.5 }}>
                              {[0, 150, 300].map((d) => (
                                <span key={d} style={{
                                  width: 6, height: 6, borderRadius: '50%',
                                  background: 'currentColor',
                                  animation: `bounce 1s ${d}ms infinite`,
                                }} />
                              ))}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {error && (
                      <div style={{
                        fontSize: 12, color: '#f87171', padding: '8px 12px',
                        background: 'rgba(248,113,113,0.1)', borderRadius: 12,
                      }}>
                        {error}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            </div>

            {/* Scroll-down indicator — exact AFFiNE down-indicator */}
            {canScrollDown && messages.length > 0 && (
              <button
                onClick={() => { setCanScrollDown(false); scrollToEnd(); }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translate(-50%, 0)',
                  bottom: 166,
                  zIndex: 1,
                  borderRadius: '50%',
                  width: 32, height: 32,
                  border: '0.5px solid var(--affine-border-color, rgba(255,255,255,0.15))',
                  background: 'var(--affine-background-primary-color, #1a1a1a)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--affine-text-secondary-color, rgba(255,255,255,0.5))',
                }}
              >
                <ArrowDownIcon />
              </button>
            )}

            {/* Composer footer — chat-panel-footer */}
            <div style={{
              margin: '0 0 0 0',
              display: 'flex',
              flexDirection: 'column',
              borderTop: '0.5px solid var(--affine-border-color, rgba(255,255,255,0.1))',
              padding: '8px 12px 12px',
              gap: 4,
            }}>
              {/* Selected text chip */}
              {selectedText && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                  padding: '6px 10px', borderRadius: 8, fontSize: 12,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--affine-text-secondary-color, rgba(255,255,255,0.4))',
                }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    &ldquo;{selectedText.slice(0, 40)}{selectedText.length > 40 ? '…' : ''}&rdquo;
                  </span>
                  <button
                    onClick={onClearSelection}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}
                  >
                    <XIcon />
                  </button>
                </div>
              )}

              {/* Input card — ai-chat-input style */}
              <div style={{
                borderRadius: 12,
                background: 'var(--affine-hover-color, rgba(255,255,255,0.06))',
                border: '1px solid var(--affine-border-color, rgba(255,255,255,0.12))',
                overflow: 'hidden',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What are your thoughts?"
                  rows={2}
                  disabled={isLoading}
                  style={{
                    width: '100%', resize: 'none', background: 'transparent',
                    padding: '12px 14px 4px', fontSize: 13, lineHeight: 1.55,
                    color: 'var(--affine-text-primary-color, #fff)',
                    border: 'none', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                  }}
                />

                {/* Bottom action bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px 8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* + attach */}
                    <IconBtn title="Add context"><PlusIcon /></IconBtn>
                    {/* Web search */}
                    <button
                      onClick={handleWebSearch}
                      disabled={isSearching || isLoading}
                      title="Search the web"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        height: 28, padding: '0 8px', borderRadius: 6,
                        fontSize: 11, fontWeight: 500,
                        color: isSearching ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.4)',
                        background: 'none', border: 'none',
                        cursor: isSearching || isLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isSearching ? '⏳' : '🔍'}
                    </button>
                    {/* Enterprise: Analyze Canvas button */}
                    {isEnterprise && getCanvasScreenshot && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowAnalyzeModeMenu((v) => !v)}
                          disabled={isAnalyzing}
                          title="Analyze canvas with AI (Enterprise)"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            height: 28, padding: '0 8px', borderRadius: 6,
                            fontSize: 11, fontWeight: 600,
                            color: isAnalyzing ? 'rgba(255,255,255,0.3)' : 'var(--affine-primary-color, #1e6ee8)',
                            background: 'rgba(30,110,232,0.1)',
                            border: '1px solid rgba(30,110,232,0.2)',
                            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isAnalyzing ? <SpinnerIcon /> : <ScanIcon />}
                          {isAnalyzing ? 'Analyzing…' : 'Analyze'}
                        </button>
                        <AnimatePresence>
                          {showAnalyzeModeMenu && !isAnalyzing && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.1 }}
                              style={{
                                position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                                width: 160, borderRadius: 12, overflow: 'hidden', zIndex: 50,
                                background: 'var(--affine-background-overlay-panel-color, #2a2a2a)',
                                border: '1px solid var(--affine-border-color, rgba(255,255,255,0.12))',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                              }}
                            >
                              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                                Analysis mode
                              </div>
                              {([
                                { id: 'step-by-step', label: 'Next step', desc: 'Show one step at a time' },
                                { id: 'socratic', label: 'Socratic', desc: 'Guide with questions' },
                                { id: 'solve', label: 'Full solve', desc: 'Complete solution' },
                                { id: 'example', label: 'Example', desc: 'Similar worked example' },
                              ] as const).map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => {
                                    setAnalyzeMode(opt.id);
                                    setShowAnalyzeModeMenu(false);
                                    setTimeout(() => analyzeCanvas(), 50);
                                  }}
                                  style={{
                                    width: '100%', padding: '8px 12px', textAlign: 'left',
                                    background: analyzeMode === opt.id ? 'rgba(30,110,232,0.12)' : 'none',
                                    color: analyzeMode === opt.id
                                      ? 'var(--affine-primary-color, #1e6ee8)'
                                      : 'var(--affine-text-primary-color, rgba(255,255,255,0.7))',
                                    border: 'none', cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 500 }}>{opt.label}</div>
                                  <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>{opt.desc}</div>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {/* Mode picker */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowModeMenu((v) => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          height: 28, padding: '0 8px', borderRadius: 6,
                          fontSize: 11, fontWeight: 500,
                          color: 'var(--affine-text-secondary-color, rgba(255,255,255,0.4))',
                          background: 'none', border: 'none', cursor: 'pointer',
                        }}
                      >
                        {MODE_LABELS[mode]}
                        <SmallChevronIcon />
                      </button>
                      <AnimatePresence>
                        {showModeMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.1 }}
                            style={{
                              position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                              width: 140, borderRadius: 12, overflow: 'hidden', zIndex: 50,
                              background: 'var(--affine-background-overlay-panel-color, #2a2a2a)',
                              border: '1px solid var(--affine-border-color, rgba(255,255,255,0.12))',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}
                          >
                            {(Object.keys(MODE_LABELS) as SocraticMode[]).map((m) => (
                              <button
                                key={m}
                                onClick={() => { setMode(m); setShowModeMenu(false); }}
                                style={{
                                  width: '100%', padding: '9px 12px', fontSize: 12, textAlign: 'left',
                                  background: mode === m ? 'rgba(30,110,232,0.12)' : 'none',
                                  color: mode === m
                                    ? 'var(--affine-primary-color, #1e6ee8)'
                                    : 'var(--affine-text-primary-color, rgba(255,255,255,0.7))',
                                  border: 'none', cursor: 'pointer',
                                }}
                              >
                                {MODE_LABELS[m]}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Send — round filled button like AFFiNE */}
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: input.trim() && !isLoading
                        ? 'var(--affine-primary-color, #1e6ee8)'
                        : 'var(--affine-hover-color, rgba(255,255,255,0.08))',
                      color: input.trim() && !isLoading ? '#fff' : 'rgba(255,255,255,0.2)',
                      border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    <SendUpIcon />
                  </button>
                </div>
              </div>

              {/* chat-panel-footer tip — exact AFFiNE text */}
              <div style={{
                marginTop: 4,
                fontSize: 12,
                color: 'var(--affine-text-secondary-color, rgba(255,255,255,0.3))',
                userSelect: 'none',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <InfoIcon />
                <span>AI outputs can be misleading or wrong</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Tiny reusable icon button matching AFFiNE header buttons
function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--affine-icon-color, rgba(255,255,255,0.35))',
        background: 'none', border: 'none', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ─── Exact AFFiNE AI star icon from packages/frontend/core/src/desktop/components/ai-island/icons.tsx ───

function AffineAIIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#affine-ai-clip)">
        <path d="M11.2812 5.49104C11.2403 5.13024 10.9353 4.85751 10.5722 4.85714C10.2091 4.85677 9.90345 5.12887 9.86185 5.48959C9.59131 7.83515 8.89003 9.48448 7.75868 10.6158C6.62734 11.7472 4.97801 12.4485 2.63244 12.719C2.27173 12.7606 1.99963 13.0662 2 13.4293C2.00037 13.7924 2.2731 14.0975 2.63389 14.1383C4.94069 14.3996 6.62508 15.1006 7.78328 16.2379C8.93713 17.3709 9.65305 19.0198 9.85994 21.3489C9.89271 21.7178 10.2019 22.0004 10.5722 22C10.9425 21.9996 11.2511 21.7162 11.2831 21.3473C11.4813 19.0565 12.1966 17.3729 13.3562 16.2133C14.5157 15.0537 16.1994 14.3385 18.4902 14.1402C18.8591 14.1083 19.1424 13.7997 19.1429 13.4294C19.1433 13.0591 18.8606 12.7499 18.4918 12.7171C16.1627 12.5102 14.5137 11.7943 13.3807 10.6404C12.2435 9.48222 11.5425 7.79783 11.2812 5.49104Z" fill={color}/>
        <path d="M18.9427 2.24651C18.9268 2.1062 18.8082 2.00014 18.667 2C18.5257 1.99986 18.4069 2.10567 18.3907 2.24595C18.2855 3.15811 18.0128 3.79952 17.5728 4.23949C17.1329 4.67946 16.4914 4.95218 15.5793 5.05739C15.439 5.07356 15.3332 5.19241 15.3333 5.33362C15.3335 5.47482 15.4395 5.59345 15.5798 5.60935C16.4769 5.71096 17.132 5.98357 17.5824 6.42584C18.0311 6.86644 18.3095 7.50771 18.39 8.41347C18.4027 8.55691 18.523 8.66683 18.667 8.66667C18.811 8.6665 18.931 8.55632 18.9434 8.41284C19.0205 7.52199 19.2987 6.86723 19.7496 6.41629C20.2006 5.96534 20.8553 5.68719 21.7462 5.61008C21.8896 5.59766 21.9998 5.47765 22 5.33365C22.0002 5.18964 21.8902 5.06939 21.7468 5.05664C20.841 4.97619 20.1998 4.69777 19.7592 4.24905C19.3169 3.79864 19.0443 3.1436 18.9427 2.24651Z" fill={color}/>
      </g>
      <defs>
        <clipPath id="affine-ai-clip">
          <rect width="24" height="24" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

// ─── Icons matching AFFiNE's @blocksuite/icons ───────────────────────────────

function LanguageIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
    </svg>
  );
}
function MindmapIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={10} width={5} height={4} rx={1} />
      <rect x={17} y={4} width={5} height={4} rx={1} />
      <rect x={17} y={10} width={5} height={4} rx={1} />
      <rect x={17} y={16} width={5} height={4} rx={1} />
      <path d="M7 12h4M11 12V6h6M11 12v6h6M11 12h6" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <circle cx={8.5} cy={8.5} r={1.5} />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-11 11M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function TOCIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={18} rx={2} /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function FrameIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M5 3H3v2M19 3h2v2M5 21H3v-2M19 21h2v-2M9 3h6M9 21h6M3 9v6M21 9v6" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={7} height={7} /><rect x={14} y={3} width={7} height={7} />
      <rect x={3} y={14} width={7} height={7} /><rect x={14} y={14} width={7} height={7} />
    </svg>
  );
}
function CollapseRightIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 19V5M13 19l7-7-7-7M20 12H7" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5M8 11V5h8v6l2 3H6l2-3z" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function SmallChevronIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function SendUpIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function ArrowDownIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} /><path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x={7} y={7} width={10} height={10} rx={1} />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
