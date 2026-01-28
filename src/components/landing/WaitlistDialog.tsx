'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Check, Loader2, GraduationCap, Users, BookOpen } from 'lucide-react';

type Role = 'student' | 'teacher' | 'parent';

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: Role;
}

const roles: { value: Role; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'student',
    label: 'Student',
    icon: <GraduationCap className="w-5 h-5" />,
    description: 'Learning math or science',
  },
  {
    value: 'teacher',
    label: 'Teacher',
    icon: <Users className="w-5 h-5" />,
    description: 'Teaching students',
  },
  {
    value: 'parent',
    label: 'Parent',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'Supporting my child',
  },
];

export function WaitlistDialog({ open, onOpenChange, defaultRole = 'student' }: WaitlistDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>(defaultRole);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Update role when defaultRole changes (e.g., when opening dialog from use cases section)
  useEffect(() => {
    if (open) {
      setRole(defaultRole);
    }
  }, [open, defaultRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          // Reset form after close
          setTimeout(() => {
            setSuccess(false);
            setEmail('');
            setName('');
            setRole('student');
          }, 300);
        }, 2000);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              You're on the list!
            </h3>
            <p className="text-gray-500 text-sm">
              We'll notify you when Agathon is ready. Get excited!
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Join the Waitlist</DialogTitle>
              <DialogDescription>
                Be the first to know when Agathon launches. Early access members get special perks.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">I am a...</Label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        role === r.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="flex justify-center mb-1">{r.icon}</div>
                      <div className="text-xs font-medium">{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name (optional) */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-gray-400">(optional)</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full h-11 text-[14px] font-medium"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Get Early Access
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                No spam, ever. We'll only email you about launch updates.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
