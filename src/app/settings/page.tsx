'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sileo } from 'sileo';
import {
  ArrowLeft,
  CaretRight,
  CircleNotch,
  SignOut,
  Books,
} from '@phosphor-icons/react';

// Preference keys in localStorage
const PREF_KEYS = {
  AI_MODE: 'agathon_pref_ai_mode',
  ANIMATIONS: 'agathon_pref_animations',
  BOARD_TEMPLATE: 'agathon_pref_board_template',
} as const;

type AiMode = /* 'feedback' | */ 'suggest' | 'answer';
type BoardTemplate = 'blank' | 'lined' | 'graph';

function useLocalPref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) setValue(stored as T);
  }, [key]);
  const set = useCallback((v: T) => {
    setValue(v);
    localStorage.setItem(key, v);
    window.dispatchEvent(new Event('agathon-pref-change'));
  }, [key]);
  return [value, set];
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nameChanged, setNameChanged] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Local preferences
  const [aiMode, setAiMode] = useLocalPref<AiMode>(PREF_KEYS.AI_MODE, 'suggest');
  const [animations, setAnimations] = useLocalPref<'on' | 'off'>(PREF_KEYS.ANIMATIONS, 'on');
  const [boardTemplate, setBoardTemplate] = useLocalPref<BoardTemplate>(PREF_KEYS.BOARD_TEMPLATE, 'blank');

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) {
      router.push('/?auth=required');
    }
  }, [user, router]);

  const handleSaveName = async () => {
    if (!user || !nameChanged) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setNameChanged(false);
      sileo.success({ title: 'Name updated' });
    } catch {
      sileo.error({ title: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      sileo.error({ title: 'Failed to sign out' });
      setSigningOut(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" weight="duotone" />
      </div>
    );
  }

  const planLabel = profile.plan_tier === 'premium' || profile.plan_tier === 'enterprise'
    ? 'Enterprise'
    : 'Free';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" weight="duotone" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            Settings
          </h1>
        </div>

        {/* Account */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Account</h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {/* Name */}
            <div className="px-4 py-3.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Name</label>
              <div className="flex items-center gap-2">
                <Input
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setNameChanged(true); }}
                  placeholder="Your name"
                  className="h-9 text-sm bg-transparent border-border"
                />
                {nameChanged && (
                  <Button
                    size="sm"
                    className="h-9 flex-shrink-0"
                    onClick={handleSaveName}
                    disabled={saving}
                  >
                    {saving ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" /> : 'Save'}
                  </Button>
                )}
              </div>
            </div>
            {/* Email */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">Email</span>
                <span className="text-sm text-foreground">{user.email}</span>
              </div>
            </div>
            {/* Role */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">Role</span>
                <span className="text-sm text-foreground capitalize">{profile.role}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Plan & Credits */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Plan</h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            <button
              onClick={() => router.push('/billing')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors rounded-t-lg group"
            >
              <div>
                <span className="text-sm font-medium text-foreground block">Subscription</span>
                <span className="text-xs text-muted-foreground">{planLabel} plan</span>
              </div>
              <CaretRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
            </button>
            <button
              onClick={() => router.push('/credits')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors rounded-b-lg group"
            >
              <div>
                <span className="text-sm font-medium text-foreground block">AI Credits</span>
                <span className="text-xs text-muted-foreground">{profile.credits ?? 0} credits available</span>
              </div>
              <CaretRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
            </button>
          </div>
        </section>

        {/* Knowledge Base */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Knowledge Base</h2>
          <div className="border border-border rounded-lg bg-card">
            <button
              onClick={() => router.push('/knowledge')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-muted/30 transition-colors rounded-lg group"
            >
              <div className="flex items-center gap-3">
                <Books className="h-5 w-5 text-primary" weight="duotone" />
                <div>
                  <span className="text-sm font-medium text-foreground block">Connected Sources</span>
                  <span className="text-xs text-muted-foreground">Google Drive, Classroom &mdash; let the AI reference your notes</span>
                </div>
              </div>
              <CaretRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
            </button>
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Preferences</h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {/* Default AI Mode */}
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-foreground block">Default AI mode</span>
                  <span className="text-xs text-muted-foreground">How AI responds when you draw</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                {([
                  // { value: 'feedback' as AiMode, label: 'Feedback', desc: 'Hints & guidance' },
                  { value: 'suggest' as AiMode, label: 'Suggest', desc: 'Step-by-step help' },
                  { value: 'answer' as AiMode, label: 'Answer', desc: 'Direct solutions' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAiMode(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-md text-left transition-colors ${
                      aiMode === opt.value
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/50 border border-transparent hover:bg-muted'
                    }`}
                  >
                    <span className={`text-xs font-medium block ${aiMode === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground/70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Board Template */}
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-foreground block">Default board template</span>
                  <span className="text-xs text-muted-foreground">Background for new boards</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                {([
                  { value: 'blank' as BoardTemplate, label: 'Blank' },
                  { value: 'lined' as BoardTemplate, label: 'Lined' },
                  { value: 'graph' as BoardTemplate, label: 'Graph' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setBoardTemplate(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-md text-center transition-colors ${
                      boardTemplate === opt.value
                        ? 'bg-primary/10 border border-primary/20 text-primary'
                        : 'bg-muted/50 border border-transparent text-foreground hover:bg-muted'
                    } text-xs font-medium`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Animations */}
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground block">Animations</span>
                <span className="text-xs text-muted-foreground">Interface motion and transitions</span>
              </div>
              <button
                onClick={() => setAnimations(animations === 'on' ? 'off' : 'on')}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  animations === 'on' ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    animations === 'on' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Keyboard Shortcuts Reference */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Keyboard shortcuts</h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {[
              { keys: '\u2318 A', action: 'New board' },
              { keys: '\u2318 J', action: 'Open journal' },
              { keys: '\u2318 K', action: 'Search' },
              { keys: '\u2318 N', action: 'Quick note' },
            ].map((shortcut) => (
              <div key={shortcut.keys} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-foreground">{shortcut.action}</span>
                <kbd className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">{shortcut.keys}</kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Sign Out */}
        <section>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-left"
          >
            {signingOut ? (
              <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" weight="duotone" />
            ) : (
              <SignOut className="h-4 w-4 text-muted-foreground" weight="duotone" />
            )}
            <span className="text-sm text-foreground">{signingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </section>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Agathon v1.0
        </p>
      </div>
    </div>
  );
}
