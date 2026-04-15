'use client';

/**
 * AFFiNE-style Settings Dialog
 * Two-column layout: sidebar nav on left, content panel on right.
 * Triggered via ⌘, or from the command palette.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import { sileo } from 'sileo';
import {
  X, User, Palette, PenNib, Keyboard, Info,
  Sun, Moon, DesktopTower, CircleNotch, SignOut,
  CaretRight, CheckCircle, CreditCard,
} from '@phosphor-icons/react';

// ── Preference helpers ──────────────────────────────────────

const PREF_KEYS = {
  AI_MODE: 'agathon_pref_ai_mode',
  ANIMATIONS: 'agathon_pref_animations',
  BOARD_TEMPLATE: 'agathon_pref_board_template',
  FONT: 'agathon_pref_editor_font',
  FONT_SIZE: 'agathon_pref_editor_font_size',
  SPELLCHECK: 'agathon_pref_spellcheck',
} as const;

function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
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

// ── Nav sections ────────────────────────────────────────────

type Section = 'account' | 'appearance' | 'editor' | 'shortcuts' | 'about';

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <User className="h-4 w-4" weight="duotone" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" weight="duotone" /> },
  { id: 'editor', label: 'Editor', icon: <PenNib className="h-4 w-4" weight="duotone" /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="h-4 w-4" weight="duotone" /> },
  { id: 'about', label: 'About', icon: <Info className="h-4 w-4" weight="duotone" /> },
];

// ── Props ───────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialSection?: Section;
}

// ── Main component ──────────────────────────────────────────

export function SettingsDialog({ open, onClose, initialSection = 'account' }: SettingsDialogProps) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [section, setSection] = useState<Section>(initialSection);

  // Reset section on open
  useEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[300] flex items-center justify-center',
        'transition-all duration-150',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        className={cn(
          'relative flex w-full max-w-[720px] h-[520px] mx-4 rounded-2xl overflow-hidden',
          'bg-white border border-[#e2e4e8] shadow-2xl',
          'transition-all duration-150',
          open ? 'scale-100 translate-y-0' : 'scale-95 translate-y-1'
        )}
      >
        {/* Left sidebar nav */}
        <div className="w-[196px] flex-shrink-0 bg-[#f8f9fa] border-r border-[#e2e4e8] flex flex-col py-4">
          <div className="px-4 mb-4">
            <span className="text-[11px] font-semibold text-[#9096a2] uppercase tracking-wider">Settings</span>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left',
                  'text-[13px] font-medium transition-colors duration-100',
                  section === item.id
                    ? 'bg-white text-[#1a1d2b] shadow-sm border border-[#e2e4e8]'
                    : 'text-[#4a4f5c] hover:bg-white/60 hover:text-[#1a1d2b]'
                )}
              >
                <span className={cn(section === item.id ? 'text-[#1e6ee8]' : 'text-[#9096a2]')}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Sign out at bottom */}
          {user && (
            <div className="px-2 mt-2">
              <button
                onClick={() => { onClose(); signOut(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <SignOut className="h-4 w-4" weight="duotone" />
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Right content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f1f3]">
            <h2 className="text-[15px] font-semibold text-[#1a1d2b]">
              {NAV_ITEMS.find(n => n.id === section)?.label}
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#9096a2] hover:text-[#1a1d2b] hover:bg-[#f0f1f3] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === 'account' && <AccountSection user={user} profile={profile} refreshProfile={refreshProfile} />}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'editor' && <EditorSection />}
            {section === 'shortcuts' && <ShortcutsSection />}
            {section === 'about' && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Account ────────────────────────────────────────

function AccountSection({
  user,
  profile,
  refreshProfile,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  refreshProfile: () => Promise<void>;
}) {
  const sb = createClient();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setChanged(false);
  }, [profile]);

  const handleSave = async () => {
    if (!user || !changed) return;
    setSaving(true);
    try {
      const { error } = await sb.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setChanged(false);
      sileo.success({ title: 'Name updated' });
    } catch {
      sileo.error({ title: 'Failed to save name' });
    } finally {
      setSaving(false);
    }
  };

  const planLabel = profile?.plan_tier === 'premium' || profile?.plan_tier === 'enterprise' ? 'Enterprise' : 'Free';

  return (
    <div className="space-y-6">
      {/* Avatar + name */}
      <SettingRow label="Display name" description="How you appear across Agathon">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setChanged(true); }}
            placeholder="Your name"
            className="flex-1 h-8 px-3 text-[13px] rounded-lg border border-[#e2e4e8] bg-white text-[#1a1d2b] placeholder:text-[#c4c7cd] focus:outline-none focus:ring-2 focus:ring-[#1e6ee8]/20 focus:border-[#1e6ee8] transition-all"
          />
          {changed && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#1e6ee8] text-white text-[12px] font-semibold hover:bg-[#1a5fcf] transition-colors disabled:opacity-60"
            >
              {saving ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" /> : <CheckCircle className="h-3.5 w-3.5" weight="duotone" />}
              Save
            </button>
          )}
        </div>
      </SettingRow>

      <SettingRow label="Email" description="Your sign-in address">
        <div className="h-8 px-3 flex items-center text-[13px] text-[#4a4f5c] rounded-lg bg-[#f8f9fa] border border-[#e2e4e8]">
          {user?.email ?? '—'}
        </div>
      </SettingRow>

      <Divider />

      {/* Plan */}
      <SettingRow label="Plan" description={`You are on the ${planLabel} plan`}>
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold',
            planLabel === 'Free'
              ? 'bg-[#f0f1f3] text-[#4a4f5c]'
              : 'bg-[#1e6ee8]/10 text-[#1e6ee8]'
          )}>
            {planLabel}
          </span>
          {planLabel === 'Free' && (
            <button className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[#1e6ee8] text-white text-[11px] font-semibold hover:bg-[#1a5fcf] transition-colors">
              <CreditCard className="h-3 w-3" weight="duotone" />
              Upgrade
            </button>
          )}
        </div>
      </SettingRow>

      <SettingRow label="AI Credits" description="Credits reset monthly">
        <span className="text-[13px] font-semibold text-[#1a1d2b]">
          {profile?.credits ?? 0} <span className="font-normal text-[#9096a2]">remaining</span>
        </span>
      </SettingRow>

      <Divider />

      <SettingRow label="Role" description="Your account type">
        <span className="capitalize text-[13px] text-[#4a4f5c]">{profile?.role ?? '—'}</span>
      </SettingRow>

      <SettingRow label="Member since" description="Account creation date">
        <span className="text-[13px] text-[#4a4f5c]">
          {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
        </span>
      </SettingRow>
    </div>
  );
}

// ── Section: Appearance ────────────────────────────────────

function AppearanceSection() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    else setTheme('system');
  }, []);

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else if (t === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.removeItem('theme');
      document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  };

  const [animations, setAnimations] = usePref<'on' | 'off'>(PREF_KEYS.ANIMATIONS, 'on');

  return (
    <div className="space-y-6">
      <SettingRow label="Theme" description="Choose your preferred color scheme">
        <div className="flex gap-2">
          {([
            { id: 'light' as const, label: 'Light', icon: <Sun className="h-4 w-4" weight="duotone" /> },
            { id: 'dark' as const, label: 'Dark', icon: <Moon className="h-4 w-4" weight="duotone" /> },
            { id: 'system' as const, label: 'System', icon: <DesktopTower className="h-4 w-4" weight="duotone" /> },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => applyTheme(opt.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border text-[12px] font-medium transition-all',
                theme === opt.id
                  ? 'border-[#1e6ee8] bg-[#eef3fd] text-[#1e6ee8]'
                  : 'border-[#e2e4e8] bg-white text-[#4a4f5c] hover:border-[#c4c7cd]'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      <Divider />

      <SettingRow label="Animations" description="Motion and transition effects throughout the UI">
        <Toggle value={animations === 'on'} onChange={(v) => setAnimations(v ? 'on' : 'off')} />
      </SettingRow>
    </div>
  );
}

// ── Section: Editor ────────────────────────────────────────

function EditorSection() {
  const [font, setFont] = usePref<string>(PREF_KEYS.FONT, 'sans');
  const [fontSize, setFontSize] = usePref<string>(PREF_KEYS.FONT_SIZE, 'medium');
  const [spellcheck, setSpellcheck] = usePref<'on' | 'off'>(PREF_KEYS.SPELLCHECK, 'on');
  const [aiMode, setAiMode] = usePref<'suggest' | 'answer'>(PREF_KEYS.AI_MODE, 'suggest');

  return (
    <div className="space-y-6">
      <SettingRow label="Font family" description="Typeface used in the journal editor">
        <div className="flex gap-1.5">
          {([
            { id: 'sans', label: 'Sans-serif' },
            { id: 'serif', label: 'Serif' },
            { id: 'mono', label: 'Mono' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFont(opt.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all',
                font === opt.id
                  ? 'border-[#1e6ee8] bg-[#eef3fd] text-[#1e6ee8]'
                  : 'border-[#e2e4e8] bg-white text-[#4a4f5c] hover:border-[#c4c7cd]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Font size" description="Base text size in the editor">
        <div className="flex gap-1.5">
          {([
            { id: 'small', label: 'Small' },
            { id: 'medium', label: 'Medium' },
            { id: 'large', label: 'Large' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFontSize(opt.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all',
                fontSize === opt.id
                  ? 'border-[#1e6ee8] bg-[#eef3fd] text-[#1e6ee8]'
                  : 'border-[#e2e4e8] bg-white text-[#4a4f5c] hover:border-[#c4c7cd]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      <Divider />

      <SettingRow label="Spell check" description="Underline misspelled words in the editor">
        <Toggle value={spellcheck === 'on'} onChange={(v) => setSpellcheck(v ? 'on' : 'off')} />
      </SettingRow>

      <Divider />

      <SettingRow label="Default AI mode" description="How Agathon responds to your questions">
        <div className="flex gap-1.5">
          {([
            { id: 'suggest' as const, label: 'Suggest', desc: 'Step-by-step hints' },
            { id: 'answer' as const, label: 'Answer', desc: 'Direct solutions' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAiMode(opt.id)}
              className={cn(
                'flex-1 px-3 py-2 rounded-lg border text-left transition-all',
                aiMode === opt.id
                  ? 'border-[#1e6ee8] bg-[#eef3fd]'
                  : 'border-[#e2e4e8] bg-white hover:border-[#c4c7cd]'
              )}
            >
              <div className={cn('text-[12px] font-semibold', aiMode === opt.id ? 'text-[#1e6ee8]' : 'text-[#1a1d2b]')}>{opt.label}</div>
              <div className="text-[11px] text-[#9096a2]">{opt.desc}</div>
            </button>
          ))}
        </div>
      </SettingRow>
    </div>
  );
}

// ── Section: Shortcuts ────────────────────────────────────

const SHORTCUTS = [
  { category: 'Global', items: [
    { keys: ['⌘', 'K'], action: 'Open command palette' },
    { keys: ['⌘', ','], action: 'Open settings' },
    { keys: ['⌘', 'N'], action: 'New journal' },
  ]},
  { category: 'Journal editor', items: [
    { keys: ['⌘', 'B'], action: 'Bold' },
    { keys: ['⌘', 'I'], action: 'Italic' },
    { keys: ['⌘', 'Z'], action: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], action: 'Redo' },
    { keys: ['/'], action: 'Insert block' },
  ]},
  { category: 'Navigation', items: [
    { keys: ['⌘', '['], action: 'Go back' },
    { keys: ['⌘', ']'], action: 'Go forward' },
  ]},
];

function ShortcutsSection() {
  return (
    <div className="space-y-6">
      {SHORTCUTS.map((group) => (
        <div key={group.category}>
          <h3 className="text-[11px] font-semibold text-[#9096a2] uppercase tracking-wider mb-3">{group.category}</h3>
          <div className="rounded-xl border border-[#e2e4e8] divide-y divide-[#f0f1f3] overflow-hidden">
            {group.items.map((item) => (
              <div key={item.action} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-[#f8f9fa] transition-colors">
                <span className="text-[13px] text-[#1a1d2b]">{item.action}</span>
                <div className="flex items-center gap-1">
                  {item.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-[#f0f1f3] border border-[#e2e4e8] text-[11px] font-mono text-[#4a4f5c]"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section: About ────────────────────────────────────────

function AboutSection() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1e6ee8] to-[#7c3aed] flex items-center justify-center shadow-lg">
          <span className="text-white text-2xl font-bold">A</span>
        </div>
        <div className="text-center">
          <div className="text-[15px] font-semibold text-[#1a1d2b]">Agathon</div>
          <div className="text-[12px] text-[#9096a2] mt-0.5">Version 1.0</div>
        </div>
      </div>

      <Divider />

      <SettingRow label="Version" description="Current application build">
        <span className="text-[13px] font-mono text-[#4a4f5c]">1.0.0</span>
      </SettingRow>

      <SettingRow label="Build" description="Release channel">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
          Beta
        </span>
      </SettingRow>

      <Divider />

      <div className="flex gap-2">
        <a
          href="https://github.com/agathon-app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e2e4e8] text-[12px] font-medium text-[#4a4f5c] hover:bg-[#f8f9fa] transition-colors"
        >
          GitHub
          <CaretRight className="h-3 w-3" weight="duotone" />
        </a>
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-shrink-0 min-w-0">
        <div className="text-[13px] font-medium text-[#1a1d2b]">{label}</div>
        {description && <div className="text-[12px] text-[#9096a2] mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#f0f1f3]" />;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors duration-150',
        value ? 'bg-[#1e6ee8]' : 'bg-[#d1d5db]'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          value ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}
