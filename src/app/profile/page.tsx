'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  ChevronLeft,
  LogOut,
  User,
  Mail,
  Shield,
  CreditCard,
  Bell,
  Moon,
  Sun,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, signOut, loading: authLoading, refreshProfile } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Initialize form with profile data
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
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // The signOut function in auth-provider already redirects to /login
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

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't render if not logged in (will redirect)
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
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
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
              {profile.role === 'admin' && <Shield className="h-3 w-3" />}
              {profile.role}
            </span>
          </div>
        </div>

        {/* Account Section */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Account
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Full Name */}
            <div className="p-4 border-b border-border">
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email (read-only) */}
            <div className="p-4 border-b border-border">
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{profile.email}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* Role (read-only) */}
            <div className="p-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Account Type
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground capitalize">{profile.role}</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {fullName !== (profile.full_name || '') && (
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="mt-4 w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </section>

        {/* Credits Section */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Usage
          </h3>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
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
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Quick Links
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => router.push('/billing')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted transition-colors text-left border-b border-border"
            >
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Plans & Billing</p>
                <p className="text-sm text-muted-foreground">Manage your subscription</p>
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground rotate-180" />
            </button>

            {profile.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted transition-colors text-left border-b border-border"
              >
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Admin Console</p>
                  <p className="text-sm text-muted-foreground">Manage platform</p>
                </div>
                <ChevronLeft className="h-5 w-5 text-muted-foreground rotate-180" />
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted transition-colors text-left"
            >
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Dashboard</p>
                <p className="text-sm text-muted-foreground">Go back to home</p>
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground rotate-180" />
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
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="h-5 w-5" />
                Sign Out
              </>
            )}
          </button>
        </section>
      </main>
    </div>
  );
}
