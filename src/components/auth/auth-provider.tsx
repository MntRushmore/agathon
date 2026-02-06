'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { Profile } from '@/types/database';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { mapSupabaseError } from '@/lib/error-utils';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Credits
  credits: number;
  refreshCredits: () => Promise<void>;
  // Admin features
  isAdmin: boolean;
  isImpersonating: boolean;
  impersonatedProfile: Profile | null;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Impersonation state — restore from sessionStorage on mount
  const [isImpersonating, setIsImpersonating] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('agathon_impersonating') === 'true';
  });
  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = sessionStorage.getItem('agathon_impersonated_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);

  const isAdmin = profile?.role === 'admin';

  // Credits - derived from profile but can be refreshed
  const credits = profile?.credits ?? 0;

  const refreshCredits = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error({ error }, 'Error fetching profile');
        setProfile(null);
      } else if (data && data.invite_redeemed === false) {
        // Allow users on /auth/complete-signup to stay logged in — they're about to redeem
        if (window.location.pathname === '/auth/complete-signup') {
          setProfile(data);
          return;
        }
        // User has a profile but invite_redeemed is false. Since creating an
        // account requires entering a valid invite code, this user is legitimate —
        // the redemption step likely failed (e.g., code expired between signup
        // and redemption). Auto-fix by marking them as redeemed.
        logger.warn('User has profile but invite_redeemed is false, auto-fixing');
        await supabase
          .from('profiles')
          .update({ invite_redeemed: true })
          .eq('id', userId);
        setProfile({ ...data, invite_redeemed: true });
      } else {
        setProfile(data);
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching profile');
      setProfile(null);
      try {
        toast.error('Failed to load profile');
      } catch (e) {}
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        logger.error({ error }, 'Error getting session');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch profile in the background, don't block
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsImpersonating(false);
    setImpersonatedProfile(null);
    setOriginalProfile(null);
    sessionStorage.removeItem('agathon_impersonating');
    sessionStorage.removeItem('agathon_impersonated_profile');
    // Full reload to landing page to clear all client state
    window.location.href = '/';
  };

  const startImpersonation = async (userId: string) => {
    if (!isAdmin || !user) return;

    try {
      // Store original profile
      setOriginalProfile(profile);

      // Fetch target user profile
      const { data: targetProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (targetProfile) {
        // Log impersonation to audit log — ensure it succeeds before continuing
        const { error: auditError } = await supabase.from('admin_audit_logs').insert({
          admin_id: user.id,
          action_type: 'user_impersonate',
          target_type: 'user',
          target_id: userId,
          target_details: { email: targetProfile.email },
        });

        if (auditError) {
          // Prevent impersonation if audit logging fails
          throw auditError;
        }

        setImpersonatedProfile(targetProfile);
        setIsImpersonating(true);
        sessionStorage.setItem('agathon_impersonating', 'true');
        sessionStorage.setItem('agathon_impersonated_profile', JSON.stringify(targetProfile));
      }
    } catch (error) {
      logger.error({ error }, 'Failed to start impersonation');
      const message = mapSupabaseError(error);
      try {
        toast.error(message);
      } catch (e) {}
    }
  };

  const stopImpersonation = async () => {
    if (!isImpersonating) return;

    setImpersonatedProfile(null);
    setIsImpersonating(false);
    sessionStorage.removeItem('agathon_impersonating');
    sessionStorage.removeItem('agathon_impersonated_profile');
    if (originalProfile) {
      setProfile(originalProfile);
    }
    setOriginalProfile(null);
  };

  // Get the effective profile (impersonated or real)
  const effectiveProfile = isImpersonating ? impersonatedProfile : profile;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: effectiveProfile,
        loading,
        signOut,
        refreshProfile,
        credits: effectiveProfile?.credits ?? 0,
        refreshCredits,
        isAdmin,
        isImpersonating,
        impersonatedProfile,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
