'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { useChat, CanvasContext } from '@/hooks/useChat';
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  StopCircle,
  Expand,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISidePanelProps {
  getCanvasContext: () => CanvasContext | Promise<CanvasContext>;
  className?: string;
  currentMode?: 'off' | 'feedback' | 'suggest' | 'answer';
}

export function AISidePanel({ getCanvasContext, className }: AISidePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    sendMessage,
    clearChat,
    stopGeneration,
  } = useChat({ getCanvasContext });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

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
      if (inputValue.trim() && !isLoading) {
        sendMessage(inputValue);
        setInputValue('');
      }
    },
    [inputValue, isLoading, sendMessage]
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

  // Toggle button when panel is closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-4 z-[1050] h-12 w-12 rounded-full',
          'bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700',
          'shadow-[0_8px_30px_rgb(124,58,237,0.3)] hover:shadow-[0_8px_40px_rgb(124,58,237,0.4)]',
          'transition-all duration-200 hover:scale-105',
          'ios-safe-right ios-safe-bottom',
          className
        )}
        size="icon"
        aria-label="Open AI Assistant"
        data-tutorial="chat-button"
      >
        <MessageCircle className="h-5 w-5" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </Button>
    );
  }

  // Slide-out panel
  return (
    <div
      className={cn(
        'fixed top-0 right-0 bottom-0 z-[1050]',
        'w-[380px] max-w-[100vw]',
        'bg-[#fafafa] shadow-[-8px_0_30px_rgba(0,0,0,0.08)]',
        'flex flex-col',
        'animate-in slide-in-from-right duration-300 ease-out',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[15px] text-gray-900">Whiteboard AI</h2>
            <p className="text-xs text-gray-500">Ask questions about your work</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsOpen(false)}
            title="Expand"
          >
            <Expand className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Empty state hero */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-5">
                <HelpCircle className="h-8 w-8 text-violet-600" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900 mb-2">How can I help?</h3>
              <p className="text-sm text-gray-500 text-center max-w-[260px] leading-relaxed">
                I can see your canvas and help explain concepts, check your work, or guide you through problems.
              </p>
            </div>

            {/* Quick action suggestions */}
            <div className="px-4 pb-4 space-y-2">
              <button
                onClick={() => sendMessage("Can you explain what I'm working on?")}
                className="w-full text-left px-4 py-3.5 rounded-xl bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all duration-150 group"
              >
                <span className="font-medium text-sm text-gray-800 group-hover:text-violet-700">Explain my work</span>
                <p className="text-xs text-gray-400 mt-0.5 group-hover:text-violet-500/70">Describe what's on my canvas</p>
              </button>
              <button
                onClick={() => sendMessage("What should I do next?")}
                className="w-full text-left px-4 py-3.5 rounded-xl bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all duration-150 group"
              >
                <span className="font-medium text-sm text-gray-800 group-hover:text-violet-700">Next steps</span>
                <p className="text-xs text-gray-400 mt-0.5 group-hover:text-violet-500/70">Guide me on what to do next</p>
              </button>
              <button
                onClick={() => sendMessage("Is my approach correct?")}
                className="w-full text-left px-4 py-3.5 rounded-xl bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all duration-150 group"
              >
                <span className="font-medium text-sm text-gray-800 group-hover:text-violet-700">Check my work</span>
                <p className="text-xs text-gray-400 mt-0.5 group-hover:text-violet-500/70">Verify if I'm on the right track</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4 px-4">
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={
                  isLoading &&
                  index === messages.length - 1 &&
                  message.role === 'assistant'
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        {messages.length > 0 && (
          <div className="flex justify-end mb-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg px-2"
              onClick={clearChat}
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Clear
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Whiteboard AI..."
              disabled={isLoading}
              rows={1}
              className={cn(
                'w-full resize-none rounded-2xl border border-gray-200 bg-gray-50',
                'px-4 py-3 pr-12 text-sm placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-150'
              )}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <div className="absolute right-2 bottom-2">
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={stopGeneration}
                  className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                  title="Stop generating"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputValue.trim()}
                  className={cn(
                    'h-8 w-8 rounded-xl transition-all duration-150',
                    inputValue.trim()
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-gray-100 text-gray-400'
                  )}
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
        <p className="text-[11px] text-center text-gray-400 mt-3">
          Whiteboard AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}
