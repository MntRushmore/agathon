'use client';

import { cn } from '@/lib/utils';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { BookOpen, Check, Info, ChevronDown } from 'lucide-react';
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
          className="no-enlarge w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
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
              className="h-48 w-auto rounded-md border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-medium mb-1">Suggest</p>
            <p className="text-sm text-muted-foreground">
              Hints and partial steps to nudge you in the right direction.
            </p>
          </div>
          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/solve.png"
              alt="Solve mode example"
              className="h-48 w-auto rounded-md border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-medium mb-1">Solve</p>
            <p className="text-sm text-muted-foreground">
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
  if (isVoiceSessionActive) return null;

  return (
    <div
      className={cn(
        'top-bar fixed left-0 right-0 h-12 z-[var(--z-topbar)]',
        'bg-white border-b border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        'flex items-center px-3 gap-2',
        'pointer-events-auto'
      )}
      style={{ top: bannerOffset }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* LEFT: Back + Assignment */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="no-enlarge w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft01Icon size={18} strokeWidth={2} />
        </button>

        {/* Assignment pill */}
        {isAssignmentBoard && assignmentTitle && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="no-enlarge flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors max-w-[200px]">
                <BookOpen className="h-3.5 w-3.5 text-[#007ba5] flex-shrink-0" />
                <span className="text-xs font-medium truncate label-text">{assignmentTitle}</span>
                {submissionStatus && (
                  <Badge
                    variant={
                      submissionStatus === 'submitted' ? 'default' :
                      submissionStatus === 'in_progress' ? 'secondary' :
                      'outline'
                    }
                    className="text-[9px] px-1 py-0 h-4 hide-mobile"
                  >
                    {submissionStatus === 'submitted' ? 'Submitted' :
                     submissionStatus === 'in_progress' ? 'In Progress' :
                     'Not Started'}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="w-72 p-4 bg-white rounded-xl shadow-lg border border-gray-200/50"
            >
              <div className="space-y-2">
                <p className="font-semibold text-sm leading-tight">{assignmentTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {assignmentSubject || 'Subject'}{assignmentGradeLevel ? ` - ${assignmentGradeLevel}` : ''}
                </p>
                {assignmentInstructions && (
                  <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-2 mt-2">
                    {assignmentInstructions}
                  </p>
                )}
                {submissionStatus && submissionStatus !== 'submitted' && onSubmit && (
                  <Button
                    size="sm"
                    onClick={onSubmit}
                    disabled={isSubmitting}
                    className="w-full mt-2 h-8 text-xs"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                  </Button>
                )}
                {submissionStatus === 'submitted' && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium mt-1">
                    <Check className="h-3.5 w-3.5" />
                    Submitted
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Vertical separator */}
      {!isDocPanelOpen && <div className="w-px h-6 bg-gray-200 flex-shrink-0" />}

      {/* CENTER: Drawing tools (rendered by tldraw via CustomToolbar component slot) */}
      {/* The CustomToolbar renders inline here automatically via tldraw's component override */}
      {/* This space is intentionally left for the toolbar to fill */}
      <div className="flex-1 min-w-0 flex items-center justify-center overflow-x-auto scrollbar-hide">
        {/* tldraw renders CustomToolbar here via the Toolbar component slot */}
        {/* We add a data attribute so we can reference this in CSS if needed */}
        <div data-topbar-tools className="flex items-center" />
      </div>

      {/* Vertical separator */}
      {!isTeacherViewing && <div className="w-px h-6 bg-gray-200 flex-shrink-0" />}

      {/* RIGHT: AI mode + Status + Hints + Admin */}
      {!isTeacherViewing && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* AI Mode selector */}
          {!aiAllowed ? (
            <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-[11px] font-medium hide-mobile">
              AI off
            </div>
          ) : (
            <Tabs
              value={assistanceMode}
              onValueChange={(value) => {
                if (isModeAllowed(value)) {
                  onModeChange(value);
                }
              }}
              className="w-auto"
              data-tutorial="ai-mode-selector"
            >
              <TabsList className="h-8 gap-0.5 p-0.5 bg-gray-100/80 border border-gray-200/50 shadow-none">
                <TabsTrigger value="off" className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm">Off</TabsTrigger>
                {/* Feedback tab disabled — kept for potential re-enable
                {isModeAllowed('feedback') && (
                  <TabsTrigger value="feedback" className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm hide-mobile">Feedback</TabsTrigger>
                )}
                */}
                {isModeAllowed('suggest') && (
                  <TabsTrigger value="suggest" className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm hide-mobile">Suggest</TabsTrigger>
                )}
                {isModeAllowed('answer') && (
                  <TabsTrigger value="answer" className="no-enlarge h-7 px-2.5 text-[11px] rounded-md data-[state=active]:shadow-sm hide-mobile">Solve</TabsTrigger>
                )}
              </TabsList>
            </Tabs>
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
            <div className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold whitespace-nowrap hide-mobile">
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
