'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';

interface ChecklistItemProps {
  done: boolean;
  label: string;
}

function ChecklistItem({ done, label }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${
          done
            ? 'bg-green-600 text-white'
            : 'bg-muted border-2 border-muted-foreground/20'
        }`}
      >
        {done && <Check className="h-3 w-3" />}
      </div>
      <span
        className={`text-sm ${
          done ? 'text-muted-foreground line-through' : 'text-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

interface ProgressChecklistProps {
  hasJoinedClass: boolean;
  hasCreatedBoard: boolean;
  hasUsedAI: boolean;
}

export function ProgressChecklist({
  hasJoinedClass,
  hasCreatedBoard,
  hasUsedAI,
}: ProgressChecklistProps) {
  const completedCount = [hasJoinedClass, hasCreatedBoard, hasUsedAI].filter(Boolean).length;
  const totalCount = 3;
  const percentage = (completedCount / totalCount) * 100;

  // Don't show the checklist if everything is complete
  if (completedCount === totalCount) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-none">
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">Getting Started Checklist</h3>
        <div className="space-y-3">
          <ChecklistItem done={hasJoinedClass} label="Join your first class" />
          <ChecklistItem done={hasCreatedBoard} label="Create a practice board" />
          <ChecklistItem done={hasUsedAI} label="Try AI tutoring" />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{completedCount} of {totalCount} completed</span>
            <span>{Math.round(percentage)}%</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
