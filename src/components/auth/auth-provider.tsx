'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { Profile } from '@/types/database';

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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedProfile, setImpersonatedProfile] = useState<Profile | null>(null);
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
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
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
        console.error('Error getting session:', error);
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
        // Log impersonation to audit log
        await supabase.from('admin_audit_logs').insert({
          admin_id: user.id,
          action_type: 'user_impersonate',
          target_type: 'user',
          target_id: userId,
          target_details: { email: targetProfile.email },
        });

        setImpersonatedProfile(targetProfile);
        setIsImpersonating(true);
      }
    } catch (error) {
      console.error('Failed to start impersonation:', error);
    }
  };

  const stopImpersonation = async () => {
    if (!isImpersonating) return;

    setImpersonatedProfile(null);
    setIsImpersonating(false);
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
