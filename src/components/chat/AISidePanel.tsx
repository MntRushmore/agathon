'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './ChatMessage';
import { useChat, CanvasContext } from '@/hooks/useChat';
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  StopCircle,
  Bot,
  HelpCircle,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AISidePanelProps {
  getCanvasContext: () => CanvasContext | Promise<CanvasContext>;
  className?: string;
  currentMode?: 'off' | 'feedback' | 'suggest' | 'answer';
}

export function AISidePanel({ getCanvasContext, className, currentMode = 'off' }: AISidePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const getModeDescription = () => {
    switch (currentMode) {
      case 'feedback':
        return {
          title: 'Feedback Mode',
          description: 'Light annotations pointing out mistakes without giving away answers. Great for checking your work!',
          icon: <Lightbulb className="h-5 w-5 text-blue-500" />,
          color: 'bg-blue-50 border-blue-200',
        };
      case 'suggest':
        return {
          title: 'Suggest Mode',
          description: 'Hints and partial steps to nudge you in the right direction. Perfect when you\'re stuck!',
          icon: <HelpCircle className="h-5 w-5 text-amber-500" />,
          color: 'bg-amber-50 border-amber-200',
        };
      case 'answer':
        return {
          title: 'Solve Mode',
          description: 'Full worked solution overlaid on your canvas for comparison. Use when you want to see the complete answer.',
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          color: 'bg-green-50 border-green-200',
        };
      default:
        return {
          title: 'AI Assistance Off',
          description: 'Select a mode above to get AI help with your work.',
          icon: <Sparkles className="h-5 w-5 text-gray-400" />,
          color: 'bg-gray-50 border-gray-200',
        };
    }
  };

  const modeInfo = getModeDescription();

  // Toggle button when panel is closed
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
        aria-label="Open AI Assistant"
        data-tutorial="chat-button"
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

  // Slide-out panel
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[1040] animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Side Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[1050]',
          'w-[420px] max-w-[90vw]',
          'bg-white border-l shadow-2xl',
          'flex flex-col',
          'animate-in slide-in-from-right duration-300',
          className
        )}
      >
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>My files</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Whiteboard AI</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsOpen(false)}
            >
              Full view
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mode Info Card */}
        <div className={cn('mx-4 mt-4 p-4 rounded-lg border', modeInfo.color)}>
          <div className="flex items-start gap-3">
            {modeInfo.icon}
            <div>
              <h3 className="font-semibold text-sm">{modeInfo.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{modeInfo.description}</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                I can see your canvas and help explain concepts step by step.
                Ask me anything about what you're working on!
              </p>

              {/* Quick action suggestions */}
              <div className="mt-6 w-full space-y-2">
                <button
                  onClick={() => sendMessage("Can you explain what I'm working on?")}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors text-sm"
                >
                  <span className="font-medium">Explain my work</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Describe what's on my canvas</p>
                </button>
                <button
                  onClick={() => sendMessage("What should I do next?")}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors text-sm"
                >
                  <span className="font-medium">Next steps</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Guide me on what to do next</p>
                </button>
                <button
                  onClick={() => sendMessage("Is my approach correct?")}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:bg-gray-50 transition-colors text-sm"
                >
                  <span className="font-medium">Check my work</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Verify if I'm on the right track</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4">
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
        <div className="p-4 border-t bg-gray-50">
          {messages.length > 0 && (
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={clearChat}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Whiteboard AI..."
                disabled={isLoading}
                className="pr-20 bg-white border-gray-300 rounded-full py-6"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isLoading ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={stopGeneration}
                    className="h-8 w-8 rounded-full"
                    title="Stop generating"
                  >
                    <StopCircle className="h-4 w-4 text-destructive" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputValue.trim()}
                    className="h-8 w-8 rounded-full"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Whiteboard AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </>
  );
}
