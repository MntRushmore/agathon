'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

interface WaitlistFormProps {
  variant?: 'inline' | 'stacked';
  buttonText?: string;
  onSuccess?: () => void;
  dark?: boolean;
}

export function WaitlistForm({
  variant = 'inline',
  buttonText = 'Join Waitlist',
  onSuccess,
  dark = false,
}: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setMessage(data.message);
        setEmail('');
        onSuccess?.();
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
      <div className={`flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
        <span className="text-[14px] font-medium">{message}</span>
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-sm">
        <Input
          type="email"
          placeholder="Enter your email"
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
          disabled={loading}
          className={`w-full h-12 text-[14px] font-medium rounded-lg ${
            dark
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-[#1a1a1a] text-white hover:bg-[#333]'
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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <Input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`flex-1 h-11 text-[14px] ${
          dark
            ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50'
            : 'bg-white border-gray-200'
        }`}
        required
      />
      <Button
        type="submit"
        disabled={loading}
        className={`h-11 px-5 text-[14px] font-medium rounded-lg ${
          dark
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-[#1a1a1a] text-white hover:bg-[#333]'
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
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </form>
  );
}
