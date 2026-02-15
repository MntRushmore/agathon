'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  GripVertical,
  Loader2,
  Send,
  StopCircle,
  Trash2,
  Brain,
  ChevronDown,
  MessageCircle,
  Lightbulb,
  BookOpen,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { LatexRenderer } from '@/components/chat/LatexRenderer';
import { useAnimatedUnmount } from '@/hooks/useAnimatedUnmount';
import { animate, stagger } from 'animejs';
import type { AITutorTab, GoDeepData } from '@/hooks/useAITutor';
import type { Message } from '@/hooks/useChat';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AITutorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Shared
  activeTab: AITutorTab;
  setActiveTab: (tab: AITutorTab) => void;
  // Chat
  messages: Message[];
  isChatLoading: boolean;
  isSocratic: boolean;
  setIsSocratic: (v: boolean) => void;
  sendMessage: (content: string) => void;
  checkWork: () => void;
  clearChat: () => void;
  stopChatGeneration: () => void;
  // Analysis
  analysisData: GoDeepData | null;
  isAnalysisLoading: boolean;
  analysisError: string | null;
  analysisConversation: ConversationMessage[];
  isAnalysisStreaming: boolean;
  sendAnalysisFollowUp: (content: string) => void;
  fetchAnalysis?: () => void;
  onWidthChange?: (width: number) => void;
}

export function AITutorPanel({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  messages,
  isChatLoading,
  isSocratic,
  setIsSocratic,
  sendMessage,
  checkWork,
  clearChat,
  stopChatGeneration,
  analysisData,
  isAnalysisLoading,
  analysisError,
  analysisConversation,
  isAnalysisStreaming,
  sendAnalysisFollowUp,
  fetchAnalysis,
  onWidthChange,
}: AITutorPanelProps) {
  const [panelWidth, setPanelWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());

  const panelRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Drag resize
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 300), 600);
      setPanelWidth(newWidth);
      onWidthChange?.(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onWidthChange]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  };

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, analysisConversation, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Cascade reveal analysis steps with anime.js
  useEffect(() => {
    if (!stepsRef.current || !analysisData?.steps?.length) return;
    const items = stepsRef.current.querySelectorAll('[data-step]');
    if (items.length === 0) return;
    animate(items, {
      opacity: [0, 1],
      translateX: [-16, 0],
      delay: stagger(100, { start: 200 }),
      duration: 400,
      ease: 'outQuint',
    });
  }, [analysisData]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim()) return;
      if (activeTab === 'chat') {
        sendMessage(inputValue);
      } else {
        sendAnalysisFollowUp(inputValue);
      }
      setInputValue('');
    },
    [inputValue, activeTab, sendMessage, sendAnalysisFollowUp]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleSubmit]
  );

  const isLoading = activeTab === 'chat' ? isChatLoading : isAnalysisStreaming;
  const canSubmit =
    activeTab === 'chat' ? !!inputValue.trim() : !!inputValue.trim() && !!analysisData;

  const { shouldRender, animationState } = useAnimatedUnmount({ isOpen, exitDurationMs: 250 });

  if (!shouldRender) return null;

  return (
    <div
      ref={panelRef}
      style={{ width: panelWidth }}
      className={cn(
        'fixed top-0 right-0 h-full bg-white border-l border-gray-200 z-[var(--z-panel)]',
        'flex flex-col w-full sm:w-auto',
        'transition-transform duration-250 ease-out',
        animationState === 'exiting' ? 'translate-x-full' : 'translate-x-0',
        isDragging && 'select-none'
      )}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleDragStart}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize',
          'hover:bg-sky-400 transition-colors',
          isDragging && 'bg-sky-500'
        )}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-8 flex items-center justify-center -translate-x-1/2 bg-white border border-gray-200 rounded-l shadow-sm opacity-0 hover:opacity-100 transition-opacity">
          <GripVertical className="w-2.5 h-2.5 text-gray-400" />
        </div>
      </div>

      {/* Header — minimal, matching old GoDeepPanel style */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">AI Tutor</span>
          {/* Tabs inline in header */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'chat'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                activeTab === 'analysis'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Analysis
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {/* ─── Chat Tab ─── */}
        <div className={cn(
          'absolute inset-0 overflow-y-auto transition-opacity duration-200',
          activeTab === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        )}>
          {messages.length === 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <p className="text-sm text-gray-400 text-center">
                  Ask anything about your work on the canvas.
                </p>
              </div>
              <div className="px-4 pb-4 space-y-1.5">
                <button
                  onClick={() => sendMessage("Can you explain what I'm working on?")}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Explain my work
                </button>
                <button
                  onClick={() => sendMessage('What should I do next?')}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  What should I do next?
                </button>
                <button
                  onClick={checkWork}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Check my work
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={
                    isChatLoading &&
                    index === messages.length - 1 &&
                    message.role === 'assistant'
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ─── Analysis Tab ─── */}
        <div className={cn(
          'absolute inset-0 overflow-y-auto transition-opacity duration-200',
          activeTab === 'analysis' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
        )}>
          <div className="p-4 space-y-6">
            {/* Loading */}
            {isAnalysisLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mb-2" />
                <p className="text-sm">Thinking...</p>
              </div>
            )}

            {/* Error */}
            {analysisError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                <p>{analysisError}</p>
                {fetchAnalysis && (
                  <button onClick={fetchAnalysis} className="mt-2 text-xs underline hover:no-underline">
                    Try again
                  </button>
                )}
              </div>
            )}

            {/* Steps */}
            {analysisData && analysisData.steps.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-medium">How to solve it</p>
                <div ref={stepsRef} className="space-y-2">
                  {analysisData.steps.map((step, idx) => (
                    <div
                      key={step.number}
                      data-step
                      className={cn(
                        'p-3 rounded-lg transition-all opacity-0',
                        idx === 0 ? 'bg-sky-50' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex gap-2.5">
                        <span className={cn('text-xs font-medium mt-0.5', idx === 0 ? 'text-sky-600' : 'text-gray-400')}>
                          {step.number}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700 leading-relaxed">
                            <LatexRenderer content={step.explanation} />
                          </div>
                          {step.latex && (
                            <div className="mt-2 text-base text-gray-800">
                              <LatexRenderer content={step.latex} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Socratic Questions */}
            {analysisData && analysisData.socraticQuestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-medium">Think deeper</p>
                <div className="space-y-2">
                  {analysisData.socraticQuestions.map((q, index) => {
                    const isExpanded = expandedQuestions.has(index);
                    const hintRevealed = revealedHints.has(index);
                    const question = typeof q === 'string' ? q : q.question;
                    const hint = typeof q === 'string' ? null : q.hint;
                    const followUp = typeof q === 'string' ? null : q.followUp;

                    return (
                      <div key={index} className="rounded-lg border border-gray-100 overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedQuestions((prev) => {
                              const next = new Set(prev);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            });
                          }}
                          className="w-full p-3 flex items-start gap-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 flex-1">
                            <LatexRenderer content={question} />
                          </span>
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 text-gray-400 transition-transform flex-shrink-0',
                              isExpanded && 'rotate-180'
                            )}
                          />
                        </button>
                        {isExpanded && (hint || followUp) && (
                          <div className="px-3 pb-3 pt-0 border-t border-gray-50">
                            {hint && !hintRevealed && (
                              <button
                                onClick={() => setRevealedHints((prev) => new Set(prev).add(index))}
                                className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium"
                              >
                                Need a hint?
                              </button>
                            )}
                            {hint && hintRevealed && (
                              <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
                                <LatexRenderer content={hint} />
                              </div>
                            )}
                            {followUp && (
                              <div className="mt-2 text-xs text-gray-500 italic">
                                <LatexRenderer content={followUp} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Concepts */}
            {analysisData && analysisData.conceptsInvolved.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-1.5">
                  {analysisData.conceptsInvolved.map((concept, index) => (
                    <span key={index} className="px-2 py-0.5 text-xs text-gray-500 bg-gray-50 rounded">
                      {concept}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {analysisData && analysisConversation.length === 0 && (
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-400 font-medium">Keep exploring</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => sendAnalysisFollowUp('Can you explain this in more detail with an example?')}
                    disabled={isAnalysisStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <BookOpen className="w-3 h-3" />
                    Give me an example
                  </button>
                  <button
                    onClick={() => sendAnalysisFollowUp('Can you explain the key concept here more simply?')}
                    disabled={isAnalysisStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <Lightbulb className="w-3 h-3" />
                    Explain further
                  </button>
                  <button
                    onClick={() =>
                      sendAnalysisFollowUp(
                        'I want to try solving this again. Can you guide me through it step by step without giving the answer?'
                      )
                    }
                    disabled={isAnalysisStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Let me try again
                  </button>
                </div>
              </div>
            )}

            {/* Analysis Conversation */}
            {analysisConversation.length > 0 && (
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Conversation</p>
                {analysisConversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-lg p-3 text-sm',
                      msg.role === 'user' ? 'bg-sky-50 text-sky-900 ml-6' : 'bg-gray-50 text-gray-700 mr-2'
                    )}
                  >
                    <p className="text-[10px] font-medium mb-1 opacity-50">
                      {msg.role === 'user' ? 'You' : 'Tutor'}
                    </p>
                    {msg.content ? (
                      <LatexRenderer content={msg.content} />
                    ) : isAnalysisStreaming && msg.role === 'assistant' ? (
                      <div className="flex items-center gap-1 py-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* Empty Analysis State */}
            {!isAnalysisLoading && !analysisError && !analysisData && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-300">
                <p className="text-sm text-gray-400">
                  Select a problem to explore
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-100 p-3">
        {/* Next Step button — always visible above input */}
        <button
          onClick={() =>
            activeTab === 'chat'
              ? sendMessage('Next Step')
              : sendAnalysisFollowUp('Next Step')
          }
          disabled={activeTab === 'chat' ? isChatLoading : isAnalysisStreaming}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mb-2 rounded-lg text-xs font-medium text-[#007ba5] bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowRight className="w-3 h-3" />
          Next Step
        </button>
        {/* Socratic toggle + clear — subtle row above input */}
        <div className="flex items-center justify-between mb-2">
          {activeTab === 'chat' ? (
            <>
              <button
                onClick={() => setIsSocratic(!isSocratic)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                  isSocratic
                    ? 'text-sky-700 bg-sky-50'
                    : 'text-gray-400 hover:text-gray-500'
                )}
              >
                <Brain className="w-3 h-3" />
                Socratic
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </>
          ) : (
            <div />
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeTab === 'chat'
                ? 'Ask about your work...'
                : analysisData
                ? 'Ask a follow-up question...'
                : 'Analyze a problem first...'
            }
            disabled={isLoading || (activeTab === 'analysis' && !analysisData)}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-300 focus:border-sky-300 disabled:opacity-50"
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={activeTab === 'chat' ? stopChatGeneration : undefined}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 transition-colors self-end"
              title="Stop generating"
            >
              <StopCircle className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#007ba5] text-white hover:bg-[#006589] transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-end"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
