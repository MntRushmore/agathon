'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, Loader2, Copy, Link } from 'lucide-react';

interface WaitlistFormProps {
  variant?: 'inline' | 'stacked';
  buttonText?: string;
  onSuccess?: (referralCode?: string) => void;
  dark?: boolean;
}

export function WaitlistForm({
  variant = 'inline',
  buttonText = 'Join Waitlist',
  onSuccess,
  dark = false,
}: WaitlistFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();

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
        body: JSON.stringify({ email: sanitize(email.trim()), name: sanitize(name.trim()), ref }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setMessage(data.message);
        setEmail('');
        if (data.referralCode) {
          setReferralCode(data.referralCode);
        }
        onSuccess?.(data.referralCode);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-3">
        <div className={`flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-white" />
          </div>
          <span className="text-[14px] font-medium">{message}</span>
        </div>
        {referralCode && (
          <div className={`p-3 rounded-lg border ${dark ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-xs font-medium mb-2 ${dark ? 'text-white/70' : 'text-gray-500'}`}>
              Share your referral link to move up the leaderboard:
            </p>
            <div className="flex gap-2">
              <div className={`flex-1 text-xs px-3 py-2 rounded font-mono truncate ${dark ? 'bg-white/10 text-white/90' : 'bg-white text-gray-700 border border-gray-200'}`}>
                {getReferralLink(referralCode)}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyReferralLink}
                className="flex-shrink-0 h-8 px-3"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <a
              href="/referral/leaderboard"
              className={`inline-flex items-center gap-1 text-xs mt-2 font-medium hover:underline ${dark ? 'text-white/70' : 'text-gray-500'}`}
            >
              <Link className="w-3 h-3" />
              View Leaderboard
            </a>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-sm">
        <Input
          type="text"
          placeholder="Your name"
          aria-label="Name for waitlist"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`h-12 text-[15px] ${
            dark
              ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
              : 'bg-white border-gray-200'
          }`}
          required
        />
        <Input
          type="email"
          placeholder="Enter your email"
          aria-label="Email address for waitlist"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`h-12 text-[15px] ${
            dark
              ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
              : 'bg-white border-gray-200'
          }`}
          required
        />
        <Button
          type="submit"
          disabled={loading || !name.trim()}
          className={`w-full h-12 text-[14px] font-medium rounded-lg ${
            dark
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-[#007ba5] text-white hover:bg-[#006080]'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {buttonText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md flex-wrap">
      <Input
        type="text"
        placeholder="Your name"
        aria-label="Name for waitlist"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`flex-1 min-w-[120px] h-11 text-[14px] ${
          dark
            ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
            : 'bg-white border-gray-200'
        }`}
        required
      />
      <Input
        type="email"
        placeholder="Enter your email"
        aria-label="Email address for waitlist"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`flex-1 min-w-[180px] h-11 text-[14px] ${
          dark
            ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
            : 'bg-white border-gray-200'
        }`}
        required
      />
      <Button
        type="submit"
        disabled={loading || !name.trim()}
        className={`h-11 px-5 text-[14px] font-medium rounded-lg ${
          dark
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-[#007ba5] text-white hover:bg-[#006080]'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {buttonText}
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
      {error && <p className="text-red-500 text-sm mt-2 w-full">{error}</p>}
    </form>
  );
}
