'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { mapSupabaseError } from '@/lib/error-utils';
import { logger } from '@/lib/logger';
import {
  CaretLeft,
  SignOut,
  User,
  Envelope,
  ShieldCheck,
  CreditCard,
  CircleNotch,
  House,
  CaretRight,
  Books,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading, refreshProfile } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated successfully!');
    } catch (error) {
      logger.error({ error }, 'Failed to update profile');
      const message = mapSupabaseError(error);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      toast.error('Failed to sign out');
      setSigningOut(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return user?.email?.substring(0, 2).toUpperCase() || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" weight="duotone" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <CaretLeft className="h-5 w-5" weight="duotone" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Profile</h1>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="max-w-2xl mx-auto px-4 py-8"
      >
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-full bg-foreground text-background flex items-center justify-center text-2xl font-semibold ring-4 ring-primary/20">
            {getInitials(profile.full_name)}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {profile.full_name || 'User'}
            </h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full capitalize">
              {profile.role === 'admin' && <ShieldCheck className="h-3 w-3" weight="duotone" />}
              {profile.role}
            </span>
          </div>
        </div>

        {/* Account Section */}
        <section className="mb-8">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Account
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            {/* Full Name */}
            <div className="p-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Full Name
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="h-9"
                />
                {fullName !== (profile.full_name || '') && (
                  <Button
                    size="sm"
                    className="h-9 flex-shrink-0"
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" /> : 'Save'}
                  </Button>
                )}
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="p-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Email
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Envelope className="h-4 w-4 text-muted-foreground" weight="duotone" />
                <span className="text-sm text-muted-foreground">{profile.email}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* Role (read-only) */}
            <div className="p-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                Account Type
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" weight="duotone" />
                <span className="text-sm text-muted-foreground capitalize">{profile.role}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Credits Section */}
        <section className="mb-8">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Usage
          </h3>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" weight="duotone" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Credits</p>
                  <p className="text-sm text-muted-foreground">AI usage credits</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-foreground">{profile.credits ?? 0}</p>
                <button
                  onClick={() => router.push('/billing')}
                  className="text-sm text-primary hover:underline"
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="mb-8">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Quick Links
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            <button
              onClick={() => router.push('/billing')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left group"
            >
              <CreditCard className="h-5 w-5 text-muted-foreground" weight="duotone" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Plans & Billing</p>
                <p className="text-sm text-muted-foreground">Manage your subscription</p>
              </div>
              <CaretRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
            </button>

            <button
              onClick={() => router.push('/knowledge')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left group"
            >
              <Books className="h-5 w-5 text-primary" weight="duotone" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Knowledge Base</p>
                <p className="text-sm text-muted-foreground">Connect Google Drive & Classroom</p>
              </div>
              <CaretRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
            </button>

            {profile.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left group"
              >
                <ShieldCheck className="h-5 w-5 text-muted-foreground" weight="duotone" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Admin Console</p>
                  <p className="text-sm text-muted-foreground">Manage platform</p>
                </div>
                <CaretRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left group"
            >
              <House className="h-5 w-5 text-muted-foreground" weight="duotone" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Dashboard</p>
                <p className="text-sm text-muted-foreground">Go back to home</p>
              </div>
              <CaretRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" weight="duotone" />
            </button>
          </div>
        </section>

        {/* Sign Out */}
        <section>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full p-4 bg-card hover:bg-destructive/10 border border-border hover:border-destructive/30 rounded-xl flex items-center justify-center gap-2 text-destructive font-medium transition-colors disabled:opacity-50"
          >
            {signingOut ? (
              <>
                <CircleNotch className="h-5 w-5 animate-spin" weight="duotone" />
                Signing out...
              </>
            ) : (
              <>
                <SignOut className="h-5 w-5" weight="duotone" />
                Sign Out
              </>
            )}
          </button>
        </section>
      </motion.main>
    </div>
  );
}
