'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lightning, Trash, Sparkle } from '@phosphor-icons/react';

interface UpgradeLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'board' | 'journal';
  limit: number;
  onDelete?: () => void;
}

export function UpgradeLimitDialog({
  open,
  onOpenChange,
  type,
  limit,
  onDelete,
}: UpgradeLimitDialogProps) {
  const label = type === 'board' ? 'boards' : 'journals';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border">
        <DialogHeader>
          <div className="icon-container icon-container-lg mx-auto mb-3" style={{ background: 'oklch(0.94 0.03 225)', color: 'oklch(0.52 0.11 225)' }}>
            <Lightning size={24} weight="duotone" />
          </div>
          <DialogTitle className="text-center text-lg">
            You&apos;ve hit the {limit}-{type} limit
          </DialogTitle>
          <DialogDescription className="text-center">
            During the alpha, free accounts include up to {limit} {label}. Delete an existing one to make room for a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="icon-container icon-container-sm flex-shrink-0" style={{ background: 'oklch(0.95 0.04 285)', color: 'oklch(0.45 0.14 285)' }}>
              <Sparkle size={14} weight="duotone" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Expanded limits and paid plans are coming soon. As an early alpha user, you&apos;ll be the first to know!
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {onDelete && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onDelete();
              }}
              className="w-full h-11 gap-2"
            >
              <Trash size={16} weight="duotone" />
              Manage {type === 'board' ? 'Boards' : 'Journals'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full h-11"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
