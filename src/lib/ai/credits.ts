import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { CreditTransaction, CreditTransactionType } from '@/types/database';

export interface CreditDeductionResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

// Cost per AI operation (in credits) — only enterprise features remain credit-gated
// TODO: M7 — Consider adding credit costs for expensive operations (TTS, voice, OCR)
// Currently only generate-solution is credit-gated. See AUDIT_REPORT.md for details.
export const CREDIT_COSTS = {
  'generate-solution': 2,
} as const;

export type AIRouteKey = keyof typeof CREDIT_COSTS;

/**
 * Deduct credits for an AI operation
 * Uses database function for atomic operation to prevent race conditions
 */
export async function deductCredits(
  userId: string,
  route: AIRouteKey,
  description?: string
): Promise<CreditDeductionResult> {
  const supabase = await createServerSupabaseClient();
  const cost = CREDIT_COSTS[route];

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: cost,
    p_ai_route: route,
    p_description: description || `AI ${route} usage`,
  });

  if (error) {
    console.error('Credit deduction error:', error);
    return { success: false, newBalance: 0, error: error.message };
  }

  const result = data?.[0];
  if (!result?.success) {
    return {
      success: false,
      newBalance: result?.new_balance || 0,
      error: result?.error_message || 'Failed to deduct credits',
    };
  }

  return { success: true, newBalance: result.new_balance };
}

/**
 * Grant credits to a user (for purchases, subscriptions, bonuses)
 */
export async function grantCredits(
  userId: string,
  amount: number,
  transactionType: CreditTransactionType,
  description?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance: number }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_transaction_type: transactionType,
    p_description: description,
    p_metadata: metadata,
  });

  if (error) {
    console.error('Credit grant error:', error);
    return { success: false, newBalance: 0 };
  }

  return { success: true, newBalance: data?.[0]?.new_balance || 0 };
}

/**
 * Get user's credit balance
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  return data?.credits ?? 0;
}

/**
 * Get credit transaction history
 */
export async function getCreditHistory(
  userId: string,
  limit = 50
): Promise<CreditTransaction[]> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data as CreditTransaction[]) || [];
}

/**
 * Check credits and deduct if available - single atomic operation for API routes.
 * Uses deductCredits directly which performs FOR UPDATE row locking to prevent
 * race conditions. No separate check step needed — the DB function handles both.
 */
export async function checkAndDeductCredits(
  userId: string,
  route: AIRouteKey,
  description?: string
): Promise<{
  usePremium: boolean;
  creditBalance: number;
  deductionResult?: CreditDeductionResult;
}> {
  // Single atomic call — deduct_credits checks balance AND deducts under row lock
  const deductionResult = await deductCredits(userId, route, description);

  if (!deductionResult.success) {
    return {
      usePremium: false,
      creditBalance: deductionResult.newBalance,
    };
  }

  return {
    usePremium: true,
    creditBalance: deductionResult.newBalance,
    deductionResult,
  };
}
