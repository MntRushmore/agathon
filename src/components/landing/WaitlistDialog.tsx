'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { ArrowRight, Check, Loader2, GraduationCap, Users, BookOpen, Copy, Link } from 'lucide-react';

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
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();

  // Update role when defaultRole changes (e.g., when opening dialog from use cases section)
  useEffect(() => {
    if (open) {
      setRole(defaultRole);
    }
  }, [open, defaultRole]);

  // Sanitize text input to prevent XSS
  const sanitize = (input: string): string =>
    input.replace(/[<>"'&]/g, (char) => {
      const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
      return entities[char] || char;
    });

  const getReferralLink = (code: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}?ref=${code}`;
  };

  const copyReferralLink = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(getReferralLink(referralCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const ref = searchParams.get('ref') || localStorage.getItem('agathon_referral_code') || undefined;

      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sanitize(email.trim()), name: sanitize(name.trim()), role, ref }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        if (data.referralCode) {
          setReferralCode(data.referralCode);
        }
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after close
    setTimeout(() => {
      setSuccess(false);
      setEmail('');
      setName('');
      setRole('student');
      setReferralCode(null);
      setCopied(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {success ? (
          <div className="py-6 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                You&apos;re on the list!
              </h3>
              <p className="text-gray-500 text-sm">
                We&apos;ll notify you when Agathon is ready. Get excited!
              </p>
            </div>

            {referralCode && (
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  Want to move up the list? Share your referral link:
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 text-xs px-3 py-2.5 rounded bg-white text-gray-600 border border-gray-200 font-mono truncate">
                    {getReferralLink(referralCode)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyReferralLink}
                    className="flex-shrink-0 h-9 px-3"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <a
                  href="/referral/leaderboard"
                  className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium hover:underline"
                >
                  <Link className="w-3 h-3" />
                  View Leaderboard
                </a>
              </div>
            )}

            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
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

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                  required
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
                disabled={loading || !email || !name.trim()}
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
                No spam, ever. We&apos;ll only email you about launch updates.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
