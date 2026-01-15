import { useState, useCallback, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface CanvasContext {
  subject?: string;
  gradeLevel?: string;
  instructions?: string;
  description?: string;
}

interface UseChatOptions {
  getCanvasContext: () => CanvasContext;
}

export function useChat({ getCanvasContext }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocratic, setIsSocratic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);

      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create assistant message placeholder
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const canvasContext = getCanvasContext();

        // Prepare messages for API (exclude the empty assistant message we just added)
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: apiMessages,
            canvasContext,
            isSocratic,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  // Update the assistant message with streamed content
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // If we got no content, show an error message
        if (!fullContent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: "I'm sorry, I couldn't generate a response. Please try again." }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // Request was cancelled, remove the empty assistant message
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
          return;
        }

        console.error('Chat error:', err);
        setError('Failed to send message. Please try again.');
        // Update the assistant message with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, getCanvasContext]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    isSocratic,
    setIsSocratic,
    error,
    sendMessage,
    checkWork: () => sendMessage("Please evaluate my reasoning on the canvas. Am I on the right track? Check for any logical errors in my steps."),
    clearChat,
    stopGeneration,
  };
}
