'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  History,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Loader2,
  Brain,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface TimelineEvent {
  type: 'start' | 'ai_usage' | 'struggle' | 'submit';
  timestamp: string;
  title: string;
  description?: string | null;
  mode?: string;
  color?: string;
  prompt?: string;
  response?: string;
  concepts?: string[];
  severity?: string;
  resolved?: boolean;
  details?: any;
}

interface AISummary {
  totalAIInteractions: number;
  feedbackCount: number;
  suggestCount: number;
  answerCount: number;
  chatCount: number;
  timeSpentMinutes: number;
  isStruggling: boolean;
  struggleCount: number;
  status: string;
}

interface AIHistoryTimelineProps {
  submissionId: string;
  studentName: string;
  trigger?: React.ReactNode;
}

export function AIHistoryTimeline({ submissionId, studentName, trigger }: AIHistoryTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/ai-history?submissionId=${submissionId}`);
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setTimeline(data.timeline || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Load AI history error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, submissionId]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  const getEventIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case 'start':
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'submit':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'struggle':
        return <AlertTriangle className={`h-4 w-4 ${event.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />;
      case 'ai_usage':
        switch (event.mode) {
          case 'feedback':
            return <Lightbulb className="h-4 w-4 text-blue-500" />;
          case 'suggest':
            return <Brain className="h-4 w-4 text-amber-500" />;
          case 'answer':
            return <BookOpen className="h-4 w-4 text-red-500" />;
          case 'chat':
            return <MessageSquare className="h-4 w-4 text-purple-500" />;
          default:
            return <Sparkles className="h-4 w-4 text-gray-500" />;
        }
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEventBadge = (event: TimelineEvent) => {
    if (event.type === 'ai_usage') {
      const variants: Record<string, string> = {
        feedback: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        suggest: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        answer: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
        chat: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      };
      const labels: Record<string, string> = {
        feedback: 'Light Hint',
        suggest: 'Guided Hint',
        answer: 'Full Solution',
        chat: 'Chat',
      };
      return (
        <Badge className={`text-[10px] ${variants[event.mode || ''] || 'bg-gray-100 text-gray-700'}`}>
          {labels[event.mode || ''] || event.mode}
        </Badge>
      );
    }
    if (event.type === 'struggle') {
      return (
        <Badge variant={event.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
          {event.severity === 'high' ? 'High Priority' : 'Needs Attention'}
        </Badge>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-1" />
            AI History
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Learning Journey: {studentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.timeSpentMinutes}</div>
                  <div className="text-xs text-muted-foreground">Minutes Spent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.totalAIInteractions}</div>
                  <div className="text-xs text-muted-foreground">AI Interactions</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${summary.answerCount > 0 ? 'text-red-600' : ''}`}>
                    {summary.answerCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Solutions Used</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${summary.isStruggling ? 'text-amber-600' : 'text-green-600'}`}>
                    {summary.isStruggling ? 'Yes' : 'No'}
                  </div>
                  <div className="text-xs text-muted-foreground">Struggling</div>
                </div>
              </div>
            )}

            {summary && summary.totalAIInteractions > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {summary.feedbackCount > 0 && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    {summary.feedbackCount} Light Hints
                  </Badge>
                )}
                {summary.suggestCount > 0 && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                    <Brain className="h-3 w-3 mr-1" />
                    {summary.suggestCount} Guided Hints
                  </Badge>
                )}
                {summary.answerCount > 0 && (
                  <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {summary.answerCount} Solutions
                  </Badge>
                )}
                {summary.chatCount > 0 && (
                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {summary.chatCount} Chats
                  </Badge>
                )}
              </div>
            )}

            <ScrollArea className="h-[400px] pr-4">
              <div className="relative">
                <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />
                
                <div className="space-y-1">
                  {timeline.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No activity recorded yet</p>
                    </div>
                  ) : (
                    timeline.map((event, index) => {
                      const hasDetails = event.type === 'ai_usage' && (event.prompt || event.response);
                      const isExpanded = expandedEvents.has(index);

                      return (
                        <div key={index} className="relative pl-10">
                          <div className="absolute left-2 top-2 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center z-10">
                            {getEventIcon(event)}
                          </div>

                          <Collapsible open={isExpanded} onOpenChange={() => hasDetails && toggleExpand(index)}>
                            <div 
                              className={`p-3 rounded-lg border ${hasDetails ? 'cursor-pointer hover:bg-muted/50' : ''} ${
                                event.type === 'struggle' ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30' :
                                event.type === 'ai_usage' && event.mode === 'answer' ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/30' :
                                'bg-card'
                              }`}
                            >
                              <CollapsibleTrigger asChild>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">{event.title}</span>
                                      {getEventBadge(event)}
                                      {hasDetails && (
                                        isExpanded ? 
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    {event.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {event.description}
                                      </p>
                                    )}
                                    {event.concepts && event.concepts.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {event.concepts.map((concept, i) => (
                                          <Badge key={i} variant="outline" className="text-[10px]">
                                            {concept}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {format(new Date(event.timestamp), 'h:mm a')}
                                  </span>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                {hasDetails && (
                                  <div className="mt-3 pt-3 border-t space-y-3">
                                    {event.prompt && (
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">Student Asked:</div>
                                        <div className="text-sm bg-muted/50 p-2 rounded text-foreground">
                                          {event.prompt}
                                        </div>
                                      </div>
                                    )}
                                    {event.response && (
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">AI Response Summary:</div>
                                        <div className="text-sm bg-muted/50 p-2 rounded text-foreground whitespace-pre-wrap">
                                          {event.response}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </CollapsibleContent>
                            </div>
                          </Collapsible>

                          <div className="text-[10px] text-muted-foreground mt-1 ml-1">
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
