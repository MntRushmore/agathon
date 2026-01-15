'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './ChatMessage';
import { useChat, CanvasContext } from '@/hooks/useChat';
import {
    MessageCircle,
    X,
    Minus,
    Send,
    Trash2,
    StopCircle,
    Bot,
    Brain,
    CheckCircle,
  } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ChatPanelProps {
  getCanvasContext: () => CanvasContext;
  className?: string;
}

export function ChatPanel({ getCanvasContext, className }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    isSocratic,
    setIsSocratic,
    sendMessage,
    checkWork,
    clearChat,
    stopGeneration,
  } = useChat({ getCanvasContext });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimized]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

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

  // Toggle button when chat is closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-20 right-4 z-[1050] h-12 w-12 rounded-full shadow-lg',
          'bg-primary hover:bg-primary/90',
          'ios-safe-right ios-safe-bottom',
          className
        )}
        size="icon"
        aria-label="Open AI Chat"
      >
        <MessageCircle className="h-5 w-5" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </Button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div
        className={cn(
          'fixed bottom-20 right-4 z-[1050]',
          'bg-card border rounded-lg shadow-lg',
          'ios-safe-right ios-safe-bottom',
          className
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Tutor</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-2"
            onClick={() => setIsMinimized(false)}
          >
            <Minus className="h-3 w-3 rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setIsOpen(false);
              setIsMinimized(false);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Full chat panel
  return (
    <div
      className={cn(
        'fixed bottom-20 right-4 z-[1050]',
        'w-[380px] max-w-[calc(100vw-2rem)]',
        'bg-card border rounded-lg shadow-xl',
        'flex flex-col',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        'ios-safe-right ios-safe-bottom',
        className
      )}
      style={{ maxHeight: 'min(500px, calc(100vh - 10rem))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Tutor</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 transition-colors",
              isSocratic ? "text-primary bg-primary/10" : "text-muted-foreground"
            )}
            onClick={() => setIsSocratic(!isSocratic)}
            title={isSocratic ? "Socratic Mode On" : "Socratic Mode Off"}
          >
            <Brain className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={checkWork}
            disabled={isLoading}
            title="Check My Work"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearChat}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium mb-2">Hi! I'm your AI tutor</h3>
            <p className="text-sm text-muted-foreground">
              Ask me anything about what you're working on. I can see your canvas
              and help explain concepts step by step.
            </p>
          </div>
        ) : (
          <div className="py-2">
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-background/50">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1"
          />
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stopGeneration}
              title="Stop generating"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim()}
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
