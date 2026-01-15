'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Sparkles, Send, Edit2, Loader2, Clock, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AIFeedbackPanelProps {
  submissionId: string;
  studentName: string;
  boardPreview?: string | null;
  onFeedbackSent?: () => void;
}

export function AIFeedbackPanel({
  submissionId,
  studentName,
  boardPreview,
  onFeedbackSent,
}: AIFeedbackPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [editedFeedback, setEditedFeedback] = useState('');
  const [stats, setStats] = useState<{
    aiHelpCount: number;
    solveCount: number;
    timeMinutes: number;
  } | null>(null);

  const generateFeedback = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/teacher/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          boardImage: boardPreview,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate feedback');

      const data = await res.json();
      setAiDraft(data.feedback);
      setEditedFeedback(data.feedback);
      setStats({
        aiHelpCount: data.aiHelpCount,
        solveCount: data.solveCount,
        timeMinutes: data.timeMinutes,
      });
    } catch (error) {
      console.error('Generate feedback error:', error);
      toast.error('Failed to generate feedback');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveFeedback = async (sendToStudent: boolean) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/teacher/generate-feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          feedback: editedFeedback,
          sendToStudent,
        }),
      });

      if (!res.ok) throw new Error('Failed to save feedback');

      toast.success(sendToStudent ? 'Feedback sent to student!' : 'Feedback saved');
      setIsOpen(false);
      onFeedbackSent?.();
    } catch (error) {
      console.error('Save feedback error:', error);
      toast.error('Failed to save feedback');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 mr-1" />
          AI Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Feedback for {studentName}</DialogTitle>
          <DialogDescription>
            Use AI to draft personalized feedback based on the student's work and activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {boardPreview ? (
            <div className="border rounded-lg overflow-hidden">
              <img
                src={boardPreview}
                alt="Student work preview"
                className="w-full max-h-48 object-contain bg-white"
              />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden h-48 flex flex-col items-center justify-center bg-muted text-muted-foreground gap-2">
              <FileText className="h-12 w-12 opacity-20" />
              <span className="text-sm font-medium opacity-50">No preview available</span>
            </div>
          )}

          {stats && (
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {stats.timeMinutes} min spent
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                {stats.aiHelpCount} AI helps used
              </Badge>
              {stats.solveCount > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {stats.solveCount} solves used
                </Badge>
              )}
            </div>
          )}

          {!aiDraft ? (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Click below to generate AI-drafted feedback based on the student's work and activity.
              </p>
              <Button onClick={generateFeedback} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Feedback
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">AI Draft</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateFeedback}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {aiDraft}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Edit2 className="h-4 w-4" />
                  <label className="text-sm font-medium">Edit Feedback</label>
                </div>
                <Textarea
                  value={editedFeedback}
                  onChange={(e) => setEditedFeedback(e.target.value)}
                  rows={6}
                  placeholder="Edit the feedback before sending..."
                />
              </div>
            </div>
          )}
        </div>

        {aiDraft && (
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => saveFeedback(false)}
              disabled={isSaving || !editedFeedback.trim()}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => saveFeedback(true)}
              disabled={isSaving || !editedFeedback.trim()}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send to Student
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
