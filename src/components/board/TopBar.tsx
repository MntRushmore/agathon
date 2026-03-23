'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { BookOpen, Check, Info, ChevronDown, Sparkles, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StatusIndicator, type StatusIndicatorState } from '@/components/StatusIndicator';
import { AdminPlanToggle } from './AdminPlanToggle';

interface TopBarProps {
  // Navigation
  onBack: () => void;

  // Assignment
  assignmentTitle?: string;
  assignmentSubject?: string;
  assignmentGradeLevel?: string;
  assignmentInstructions?: string;
  submissionStatus?: 'not_started' | 'in_progress' | 'submitted' | null;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  isAssignmentBoard?: boolean;

  // AI mode
  assistanceMode: string;
  onModeChange: (mode: string) => void;
  aiAllowed: boolean;
  isModeAllowed: (mode: string) => boolean;

  // Status
  status: StatusIndicatorState;
  statusMessage?: string;
  errorMessage?: string;

  // Hints
  hintLimit?: number | null;
  hintsRemaining?: number | null;

  // Visibility
  isTeacherViewing: boolean;
  isVoiceSessionActive: boolean;
  bannerOffset: number;
  isDocPanelOpen: boolean;

}

function ModeInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="no-enlarge w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 transition-all duration-150"
          aria-label="How the help modes work"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Help modes</DialogTitle>
          <DialogDescription>
            Choose how strongly the tutor helps on your canvas. Quick mode is a fast on-canvas calculator that only runs when selected.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-6">
          {/* Feedback mode disabled — kept for potential re-enable
          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/feedback.png"
              alt="Feedback mode example"
              className="h-48 w-auto rounded-md border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-medium mb-1">Feedback</p>
            <p className="text-sm text-muted-foreground">
              Light annotations pointing out mistakes without giving away answers.
            </p>
          </div>
          */}
          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/suggest.png"
              alt="Suggest mode example"
              className="h-48 w-auto rounded-xl border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-semibold mb-1">Suggest</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hints and partial steps to nudge you in the right direction.
            </p>
          </div>
          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/solve.png"
              alt="Solve mode example"
              className="h-48 w-auto rounded-xl border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-semibold mb-1">Solve</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Full worked solution overlaid on your canvas for comparison.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TopBar({
  onBack,
  assignmentTitle,
  assignmentSubject,
  assignmentGradeLevel,
  assignmentInstructions,
  submissionStatus,
  onSubmit,
  isSubmitting,
  isAssignmentBoard,
  assistanceMode,
  onModeChange,
  aiAllowed,
  isModeAllowed,
  status,
  statusMessage,
  errorMessage,
  hintLimit,
  hintsRemaining,
  isTeacherViewing,
  isVoiceSessionActive,
  bannerOffset,
  isDocPanelOpen,
}: TopBarProps) {
  // Auto-open assignment instructions for 4 seconds on first load
  const [assignmentPopoverOpen, setAssignmentPopoverOpen] = useState(false);
  useEffect(() => {
    if (isAssignmentBoard && assignmentInstructions) {
      const openTimer = setTimeout(() => setAssignmentPopoverOpen(true), 800);
      const closeTimer = setTimeout(() => setAssignmentPopoverOpen(false), 5000);
      return () => { clearTimeout(openTimer); clearTimeout(closeTimer); };
    }
  }, [isAssignmentBoard, assignmentInstructions]);

  if (isVoiceSessionActive) return null;

  return (
    <div
      className={cn(
        'top-bar fixed left-0 right-0 h-12 z-[var(--z-topbar)]',
        'bg-white border-b border-gray-200/60',
        'flex items-center px-3 gap-2',
        'pointer-events-auto'
      )}
      style={{ top: bannerOffset }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* LEFT: Back + Assignment */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onBack}
          className="no-enlarge w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100/80 hover:text-gray-700 transition-all duration-150 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft01Icon size={18} strokeWidth={2} />
        </button>

        {/* Assignment pill */}
        {isAssignmentBoard && assignmentTitle && (
          <Popover open={assignmentPopoverOpen} onOpenChange={setAssignmentPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="no-enlarge flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200/80 hover:bg-gray-50 hover:border-gray-300/60 transition-all duration-150 max-w-[220px] group">
                <BookOpen className="h-3.5 w-3.5 text-[#007ba5] flex-shrink-0" />
                <span className="text-xs font-medium truncate label-text text-gray-700">{assignmentTitle}</span>
                {submissionStatus && (
                  <Badge
                    variant={
                      submissionStatus === 'submitted' ? 'default' :
                      submissionStatus === 'in_progress' ? 'secondary' :
                      'outline'
                    }
                    className="text-[9px] px-1.5 py-0 h-4 hide-mobile rounded-full"
                  >
                    {submissionStatus === 'submitted' ? 'Submitted' :
                     submissionStatus === 'in_progress' ? 'In Progress' :
                     'Not Started'}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="w-80 p-0 bg-white rounded-xl shadow-xl border border-gray-200/50 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm leading-tight text-gray-900">{assignmentTitle}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {assignmentSubject || 'Subject'}{assignmentGradeLevel ? ` \u00b7 ${assignmentGradeLevel}` : ''}
                  </p>
                </div>
                {assignmentInstructions && (
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {assignmentInstructions}
                    </p>
                  </div>
                )}
              </div>
              {submissionStatus && (
                <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100">
                  {submissionStatus !== 'submitted' && onSubmit ? (
                    <Button
                      size="sm"
                      onClick={onSubmit}
                      disabled={isSubmitting}
                      className="w-full h-9 text-xs font-medium rounded-lg"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                    </Button>
                  ) : submissionStatus === 'submitted' ? (
                    <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium justify-center">
                      <Check className="h-3.5 w-3.5" />
                      Submitted successfully
                    </div>
                  ) : null}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Vertical separator */}
      {!isDocPanelOpen && <div className="w-px h-5 bg-gray-200/60 flex-shrink-0 mx-0.5" />}

      {/* CENTER: Drawing tools (rendered by tldraw via CustomToolbar component slot) */}
      <div className="flex-1 min-w-0 flex items-center justify-center overflow-x-auto scrollbar-hide">
        <div data-topbar-tools className="flex items-center" />
      </div>

      {/* Vertical separator */}
      {!isTeacherViewing && <div className="w-px h-5 bg-gray-200/60 flex-shrink-0 mx-0.5" />}

      {/* RIGHT: AI mode + Status + Hints + Admin */}
      {!isTeacherViewing && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* AI Mode selector */}
          {!aiAllowed ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50/80 border border-amber-200/60 rounded-lg text-amber-700 text-[11px] font-medium hide-mobile">
              <ShieldOff className="h-3 w-3" />
              AI off
            </div>
          ) : (
            <div className="flex items-center gap-1.5" data-tutorial="ai-mode-selector">
              <Sparkles className="h-3.5 w-3.5 text-gray-400 hide-mobile" />
              <Tabs
                value={assistanceMode}
                onValueChange={(value) => {
                  if (isModeAllowed(value)) {
                    onModeChange(value);
                  }
                }}
                className="w-auto"
              >
                <TabsList className="h-8 gap-0.5 p-0.5 bg-gray-100/60 border border-gray-200/40 shadow-none rounded-lg">
                  <TabsTrigger
                    value="off"
                    className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm data-[state=active]:bg-white font-medium transition-all duration-150"
                  >
                    Off
                  </TabsTrigger>
                  {isModeAllowed('suggest') && (
                    <TabsTrigger
                      value="suggest"
                      className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm data-[state=active]:bg-white hide-mobile font-medium transition-all duration-150"
                    >
                      Suggest
                    </TabsTrigger>
                  )}
                  {isModeAllowed('answer') && (
                    <TabsTrigger
                      value="answer"
                      className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm data-[state=active]:bg-white hide-mobile font-medium transition-all duration-150"
                    >
                      Solve
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>
          )}

          <ModeInfoDialog />

          {/* Status */}
          <StatusIndicator
            status={status}
            errorMessage={errorMessage}
            customMessage={statusMessage}
            disableAbsolute
            className="!fixed-none !relative !translate-x-0 !translate-y-0 !shadow-none !border-0 !bg-transparent !px-0 !py-0"
          />

          {/* Hint counter */}
          {hintLimit !== null && hintLimit !== undefined && (
            <div className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap hide-mobile border transition-colors",
              hintsRemaining === 0
                ? "bg-red-50/80 border-red-200/60 text-red-600"
                : hintsRemaining != null && hintsRemaining <= 2
                  ? "bg-amber-50/80 border-amber-200/60 text-amber-700"
                  : "bg-gray-50/80 border-gray-200/60 text-gray-600"
            )}>
              {hintsRemaining} hint{hintsRemaining === 1 ? '' : 's'}
            </div>
          )}

          {/* Admin toggle */}
          <AdminPlanToggle />
        </div>
      )}
    </div>
  );
}
