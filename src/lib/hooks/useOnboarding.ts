import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const ONBOARDING_VERSION = 'v1';
const ONBOARDING_KEY = `onboarding_completed_${ONBOARDING_VERSION}`;

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  hasJoinedClass: boolean;
  hasCreatedBoard: boolean;
  hasUsedAI: boolean;
}

export function useOnboarding() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Check onboarding status from both localStorage and database
  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        // Check localStorage first for immediate feedback
        const localStatus = localStorage.getItem(ONBOARDING_KEY);

        // Check database for persistent cross-device state
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsOnboardingComplete(false);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        // If database says completed, trust that
        if (profile?.onboarding_completed) {
          setIsOnboardingComplete(true);
          localStorage.setItem(ONBOARDING_KEY, 'true');
        }
        // If localStorage says completed but DB doesn't, sync to DB
        else if (localStatus === 'true') {
          setIsOnboardingComplete(true);
          await syncOnboardingToDB(true);
        }
        // Neither source has completion - show onboarding
        else {
          setIsOnboardingComplete(false);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setIsOnboardingComplete(false);
      } finally {
        setLoading(false);
      }
    }

    checkOnboardingStatus();
  }, [supabase]);

  // Sync onboarding completion to database
  const syncOnboardingToDB = async (completed: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({
          onboarding_completed: completed,
          onboarding_completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error syncing onboarding to database:', error);
    }
  };

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    // Update localStorage immediately
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOnboardingComplete(true);

    // Sync to database in background
    await syncOnboardingToDB(true);
  }, []);

  // Skip onboarding (same as complete, but semantically different)
  const skipOnboarding = useCallback(async () => {
    await completeOnboarding();
  }, [completeOnboarding]);

  // Reset onboarding (for testing/debugging)
  const resetOnboarding = useCallback(async () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setIsOnboardingComplete(false);
    await syncOnboardingToDB(false);
  }, []);

  // Check if user has achieved specific milestones
  const checkMilestones = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { hasJoinedClass: false, hasCreatedBoard: false, hasUsedAI: false };

      // Check if user has joined any classes
      const { data: classMemberships } = await supabase
        .from('class_members')
        .select('id')
        .eq('student_id', user.id)
        .limit(1);

      // Check if user has created any boards
      const { data: boards } = await supabase
        .from('whiteboards')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      // Check if user has used AI
      const { data: aiUsage } = await supabase
        .from('ai_usage')
        .select('id')
        .eq('student_id', user.id)
        .limit(1);

      return {
        hasJoinedClass: (classMemberships?.length ?? 0) > 0,
        hasCreatedBoard: (boards?.length ?? 0) > 0,
        hasUsedAI: (aiUsage?.length ?? 0) > 0,
      };
    } catch (error) {
      console.error('Error checking milestones:', error);
      return { hasJoinedClass: false, hasCreatedBoard: false, hasUsedAI: false };
    }
  }, [supabase]);

  // Track milestone achievement
  const trackMilestone = useCallback(async (milestone: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('milestones_achieved')
        .eq('id', user.id)
        .single();

      const currentMilestones = (profile?.milestones_achieved as string[]) || [];

      // Don't add duplicate milestones
      if (currentMilestones.includes(milestone)) return;

      const updatedMilestones = [...currentMilestones, milestone];

      await supabase
        .from('profiles')
        .update({ milestones_achieved: updatedMilestones })
        .eq('id', user.id);

      return true;
    } catch (error) {
      console.error('Error tracking milestone:', error);
      return false;
    }
  }, [supabase]);

  return {
    isOnboardingComplete,
    loading,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
    checkMilestones,
    trackMilestone,
  };
}
