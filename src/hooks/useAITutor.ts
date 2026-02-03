import { useState, useCallback, useRef } from 'react';
import { Message, CanvasContext } from './useChat';

export type AITutorTab = 'chat' | 'analysis';

interface Step {
  number: number;
  explanation: string;
  latex?: string;
}

interface SocraticQuestion {
  question: string;
  hint: string;
  followUp: string;
}

export interface GoDeepData {
  steps: Step[];
  socraticQuestions: SocraticQuestion[];
  conceptsInvolved: string[];
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface UseAITutorOptions {
  getCanvasContext: () => CanvasContext | Promise<CanvasContext>;
}

export function useAITutor({ getCanvasContext }: UseAITutorOptions) {
  // Shared state
  const [activeTab, setActiveTab] = useState<AITutorTab>('chat');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSocratic, setIsSocratic] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Analysis state
  const [analysisData, setAnalysisData] = useState<GoDeepData | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisConversation, setAnalysisConversation] = useState<ConversationMessage[]>([]);
  const [isAnalysisStreaming, setIsAnalysisStreaming] = useState(false);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisImageRef = useRef<string | null>(null);
  const analysisAnswerRef = useRef<string>('');

  // ─── Chat Methods ───

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isChatLoading) return;
      setChatError(null);

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsChatLoading(true);

      const assistantMessageId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() },
      ]);

      try {
        if (chatAbortRef.current) chatAbortRef.current.abort();
        chatAbortRef.current = new AbortController();

        const canvasContext = await getCanvasContext();
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages, canvasContext, isSocratic }),
          signal: chatAbortRef.current.signal,
        });

        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const d = line.slice(6);
              if (d === '[DONE]') continue;
              try {
                const parsed = JSON.parse(d);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, content: fullContent } : m
                    )
                  );
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }

        if (!fullContent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: "I couldn't generate a response. Please try again." }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
          return;
        }
        setChatError('Failed to send message. Please try again.');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
              : m
          )
        );
      } finally {
        setIsChatLoading(false);
      }
    },
    [messages, isChatLoading, isSocratic, getCanvasContext]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setChatError(null);
    if (chatAbortRef.current) chatAbortRef.current.abort();
  }, []);

  const stopChatGeneration = useCallback(() => {
    if (chatAbortRef.current) chatAbortRef.current.abort();
    setIsChatLoading(false);
  }, []);

  const checkWork = useCallback(() => {
    sendMessage(
      'Please evaluate my reasoning on the canvas. Am I on the right track? Check for any logical errors in my steps.'
    );
  }, [sendMessage]);

  // ─── Analysis Methods ───

  const buildGoDeepContext = useCallback(() => {
    if (!analysisData) return '';
    const parts: string[] = [];
    if (analysisData.steps.length > 0) {
      parts.push(
        'Steps:\n' +
          analysisData.steps
            .map((s) => `${s.number}. ${s.explanation}${s.latex ? ` (${s.latex})` : ''}`)
            .join('\n')
      );
    }
    if (analysisData.socraticQuestions.length > 0) {
      parts.push(
        'Socratic Questions:\n' +
          analysisData.socraticQuestions
            .map((q) => `- ${typeof q === 'string' ? q : q.question}`)
            .join('\n')
      );
    }
    if (analysisData.conceptsInvolved.length > 0) {
      parts.push('Concepts: ' + analysisData.conceptsInvolved.join(', '));
    }
    return parts.join('\n\n');
  }, [analysisData]);

  const fetchAnalysis = useCallback(
    async (image: string, answer?: string) => {
      analysisImageRef.current = image;
      analysisAnswerRef.current = answer || '';
      setIsAnalysisLoading(true);
      setAnalysisError(null);
      setAnalysisData(null);
      setAnalysisConversation([]);
      setActiveTab('analysis');

      try {
        const response = await fetch('/api/go-deeper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, originalAnswer: answer || '', mode: 'both' }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get explanation');
        }

        const result = await response.json();
        setAnalysisData(result);
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : 'Failed to load explanation. Please try again.'
        );
      } finally {
        setIsAnalysisLoading(false);
      }
    },
    []
  );

  const sendAnalysisFollowUp = useCallback(
    async (content: string) => {
      if (!content.trim() || isAnalysisStreaming || !analysisImageRef.current) return;

      const userMsg: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: ConversationMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
      };

      setAnalysisConversation((prev) => [...prev, userMsg, assistantMsg]);
      setIsAnalysisStreaming(true);

      if (analysisAbortRef.current) analysisAbortRef.current.abort();
      analysisAbortRef.current = new AbortController();

      try {
        const history = [...analysisConversation, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/go-deeper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: analysisImageRef.current,
            originalAnswer: analysisAnswerRef.current,
            conversationHistory: history,
            goDeepContext: buildGoDeepContext(),
          }),
          signal: analysisAbortRef.current.signal,
        });

        if (!response.ok) throw new Error('Failed to get response');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const d = line.slice(6);
              if (d === '[DONE]') continue;
              try {
                const parsed = JSON.parse(d);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  setAnalysisConversation((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: fullContent } : m
                    )
                  );
                }
              } catch { /* skip invalid JSON */ }
            }
          }
        }

        if (!fullContent) {
          setAnalysisConversation((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: "I couldn't generate a response. Please try again." }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setAnalysisConversation((prev) => prev.filter((m) => m.id !== assistantMsgId));
          return;
        }
        setAnalysisConversation((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
              : m
          )
        );
      } finally {
        setIsAnalysisStreaming(false);
      }
    },
    [isAnalysisStreaming, analysisConversation, buildGoDeepContext]
  );

  const resetAnalysis = useCallback(() => {
    setAnalysisData(null);
    setAnalysisError(null);
    setAnalysisConversation([]);
    setIsAnalysisStreaming(false);
    analysisImageRef.current = null;
    analysisAnswerRef.current = '';
    if (analysisAbortRef.current) analysisAbortRef.current.abort();
  }, []);

  return {
    // Shared
    activeTab,
    setActiveTab,

    // Chat
    messages,
    isChatLoading,
    isSocratic,
    setIsSocratic,
    chatError,
    sendMessage,
    checkWork,
    clearChat,
    stopChatGeneration,

    // Analysis
    analysisData,
    isAnalysisLoading,
    analysisError,
    analysisConversation,
    isAnalysisStreaming,
    fetchAnalysis,
    sendAnalysisFollowUp,
    resetAnalysis,
  };
}
