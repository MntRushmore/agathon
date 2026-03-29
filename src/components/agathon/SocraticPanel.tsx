'use client';

/**
 * SocraticPanel — AFFiNE-style AI chat sidebar with Socratic workflow engine.
 *
 * Implements a simple workflow graph:
 *   captureContext → socraticQuestion → assessResponse → branch(explain|followUp|moveOn)
 *
 * The AI reads live canvas blocks as context (like AFFiNE's docRead tool).
 * Modes: socratic (default), explain, hint, answer.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';

export type SocraticMode = 'socratic' | 'explain' | 'hint' | 'answer';

export interface SocraticMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: SocraticMode;
  timestamp: Date;
}

interface SocraticPanelProps {
  isOpen: boolean;
  onClose: () => void;
  getCanvasContext: () => string;
  subject?: string;
  selectedText?: string;
  onClearSelection?: () => void;
}

const MODE_CONFIG: Record<SocraticMode, { label: string; description: string; color: string }> = {
  socratic: {
    label: 'Socratic',
    description: 'Guide me with questions',
    color: 'bg-violet-100 text-violet-700',
  },
  explain: {
    label: 'Explain',
    description: 'Explain this to me',
    color: 'bg-blue-100 text-blue-700',
  },
  hint: {
    label: 'Hint',
    description: 'Give me a nudge',
    color: 'bg-amber-100 text-amber-700',
  },
  answer: {
    label: 'Answer',
    description: 'Show me the answer',
    color: 'bg-green-100 text-green-700',
  },
};

export default function SocraticPanel({
  isOpen,
  onClose,
  getCanvasContext,
  subject,
  selectedText,
  onClearSelection,
}: SocraticPanelProps) {
  const [messages, setMessages] = useState<SocraticMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<SocraticMode>('socratic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Pre-fill input when user selects text on canvas
  useEffect(() => {
    if (selectedText && isOpen) {
      setInput(`"${selectedText}"`);
      inputRef.current?.focus();
    }
  }, [selectedText, isOpen]);

  const buildSystemPrompt = useCallback((m: SocraticMode, context: string): string => {
    const base = `You are Agathon, a Socratic AI tutor${subject ? ` for ${subject}` : ''}.
The student's current canvas content:
<canvas_context>
${context || '(empty canvas)'}
</canvas_context>`;

    const modeInstructions: Record<SocraticMode, string> = {
      socratic: `${base}

Your role: NEVER give direct answers. Ask probing questions that guide the student to discover the answer themselves.
- Start with what they already know
- Ask one focused question at a time
- When they're close, ask "what would happen if...?"
- Celebrate partial understanding, then push deeper`,
      explain: `${base}

Your role: Explain concepts clearly using analogies, examples, and visual descriptions.
- Build from what they understand
- Use the canvas context to make explanations concrete
- End each explanation with a check-for-understanding question`,
      hint: `${base}

Your role: Give minimal hints that unlock the next step without revealing the full solution.
- Point to the relevant concept without solving it
- Use "think about..." or "consider..." framing
- One hint per response`,
      answer: `${base}

Your role: Provide clear, complete answers with step-by-step reasoning.
- Show all work
- Explain why each step follows
- After answering, ask if they'd like to explore a related concept`,
    };

    return modeInstructions[m];
  }, [subject]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(null);

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
    const systemPrompt = buildSystemPrompt(mode, context);

    // Build conversation history for API
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...updatedMessages.map((m) => ({
        role: m.role === 'system' ? 'assistant' as const : m.role,
        content: m.content,
      })),
    ];

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', mode, timestamp: new Date() },
    ]);

    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch('/api/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE data lines
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content ?? parsed.delta?.text ?? '';
              if (delta) {
                accumulated += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                  )
                );
              }
            } catch {
              // Not JSON — raw text chunk
              if (data && data !== '[DONE]') {
                accumulated += data;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m
                  )
                );
              }
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const errMsg = e instanceof Error ? e.message : 'Something went wrong';
      setError(errMsg);
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
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 38 }}
          className="absolute right-0 top-0 bottom-0 w-80 z-30 flex flex-col
            bg-white/97 backdrop-blur-sm
            border-l border-[#e8e8e8]
            shadow-[-8px_0_32px_rgba(0,0,0,0.06)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
            <div className="flex items-center gap-2">
              <SparkleIcon className="text-[#1e6ee8]" />
              <span className="font-semibold text-[#1a1a1a] text-sm">Agathon AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                title="New conversation"
                onClick={startFresh}
                className="p-1.5 rounded-lg text-[#8a8a8a] hover:bg-[#f5f5f5] hover:text-[#3d3d3d] transition-colors"
              >
                <ResetIcon />
              </button>
              <button
                title="Close"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#8a8a8a] hover:bg-[#f5f5f5] hover:text-[#3d3d3d] transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Mode selector */}
          <div className="flex gap-1 px-3 py-2 border-b border-[#f0f0f0] overflow-x-auto scrollbar-none">
            {(Object.keys(MODE_CONFIG) as SocraticMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150',
                  mode === m
                    ? MODE_CONFIG[m].color
                    : 'text-[#666] hover:bg-[#f5f5f5]'
                )}
              >
                {MODE_CONFIG[m].label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                <div className="w-10 h-10 rounded-2xl bg-[#e8f2ff] flex items-center justify-center">
                  <SparkleIcon className="text-[#1e6ee8]" size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a1a1a]">
                    {MODE_CONFIG[mode].label} mode
                  </p>
                  <p className="text-xs text-[#8a8a8a] mt-1">
                    {MODE_CONFIG[mode].description}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-1.5 w-full mt-2">
                  {getStarterQuestions(mode, subject).map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs px-3 py-2 rounded-xl bg-[#f7f7f7] hover:bg-[#eef4ff] hover:text-[#1e6ee8] text-[#555] transition-colors border border-transparent hover:border-[#c7dcff]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-[#e8f2ff] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <SparkleIcon className="text-[#1e6ee8]" size={12} />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-[#1e6ee8] text-white rounded-tr-sm'
                      : 'bg-[#f7f7f7] text-[#1a1a1a] rounded-tl-sm'
                  )}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </motion.div>
            ))}

            {error && (
              <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#f0f0f0]">
            {selectedText && (
              <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-[#f7f7f7] rounded-xl text-xs text-[#666]">
                <span className="truncate flex-1">Selected: &ldquo;{selectedText.slice(0, 40)}{selectedText.length > 40 ? '…' : ''}&rdquo;</span>
                <button onClick={onClearSelection} className="text-[#aaa] hover:text-[#555]">
                  <CloseIcon size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask in ${MODE_CONFIG[mode].label.toLowerCase()} mode…`}
                rows={1}
                className="flex-1 resize-none bg-[#f5f5f5] rounded-xl px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#aaa] focus:outline-none focus:ring-2 focus:ring-[#1e6ee8]/20 focus:bg-white transition-colors max-h-32 overflow-y-auto"
                style={{ lineHeight: '1.5' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150',
                  input.trim() && !isLoading
                    ? 'bg-[#1e6ee8] text-white hover:bg-[#1a5fcf] active:scale-95'
                    : 'bg-[#f0f0f0] text-[#ccc] cursor-not-allowed'
                )}
              >
                <SendIcon size={14} />
              </button>
            </div>
            <p className="text-[10px] text-[#bbb] mt-1.5 text-center">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function getStarterQuestions(mode: SocraticMode, subject?: string): string[] {
  const sub = subject ?? 'this topic';
  const starters: Record<SocraticMode, string[]> = {
    socratic: [
      `What do you already know about ${sub}?`,
      "Walk me through your thinking so far",
      "What's the first step you'd try?",
    ],
    explain: [
      `Can you explain the main concept here?`,
      "What does this formula mean?",
      "Break down this step for me",
    ],
    hint: [
      "I'm stuck — give me a nudge",
      "What should I focus on next?",
      "Am I on the right track?",
    ],
    answer: [
      "Show me the full solution",
      "What's the answer and why?",
      "Solve this step by step",
    ],
  };
  return starters[mode];
}

// Icon components
function SparkleIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6L12 2z" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ResetIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
