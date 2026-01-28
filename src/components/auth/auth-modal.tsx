'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SignInForm } from './sign-in-form';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Agathon</DialogTitle>
          <DialogDescription>
            Sign in to save your work and access it from anywhere
          </DialogDescription>
        </DialogHeader>
        <SignInForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
