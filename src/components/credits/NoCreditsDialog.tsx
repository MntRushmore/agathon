'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Sparkles, AlertCircle } from 'lucide-react';

interface NoCreditsDialogProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  requiresImage?: boolean;
}

export function NoCreditsDialog({
  open,
  onClose,
  feature,
  requiresImage = false,
}: NoCreditsDialogProps) {
  const router = useRouter();

  const handleGetCredits = () => {
    onClose();
    router.push('/credits');
  };

  const handleContinueTextOnly = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>Credits Required</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {requiresImage ? (
              <>
                <strong>{feature}</strong> requires image processing which uses AI credits.
                You&apos;ve run out of credits.
              </>
            ) : (
              <>
                You&apos;re out of credits! Premium AI features with image understanding
                require credits. You can still use basic text-only AI assistance.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Purchase Credits</p>
              <p className="text-sm text-muted-foreground">
                Buy a credit pack for instant access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-medium">Upgrade to Pro</p>
              <p className="text-sm text-muted-foreground">
                Get 500 credits/month with Pro subscription
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!requiresImage && (
            <Button variant="outline" onClick={handleContinueTextOnly}>
              Continue with Text-Only
            </Button>
          )}
          <Button onClick={handleGetCredits}>
            Get Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
