import { Webhooks } from '@polar-sh/nextjs';

// Use generic types since Polar SDK exports may vary by version
type WebhookSubscriptionPayload = {
  data: {
    id: string;
    status: string;
    productId: string;
    customer: {
      id: string;
      externalId?: string | null;
    };
    endsAt?: string | null;
    currentPeriodEnd?: string | null;
  };
};

type WebhookOrderPayload = {
  data: {
    id: string;
    status: string;
    productId: string;
    amount: number;
    customer: {
      id: string;
      externalId?: string | null;
      email?: string | null;
    };
    metadata?: {
      type?: string;
      credits?: number;
    };
  };
};
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

const PREMIUM_MONTHLY_CREDITS = 500;

const productPlanMap: Record<string, string> = {};
if (process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID) {
  productPlanMap[process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID.trim()] = 'free';
}
if (process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID) {
  productPlanMap[process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID.trim()] = 'premium';
}

// Credit pack product mapping (product ID -> total credits)
const creditPackMap: Record<string, number> = {};
if (process.env.NEXT_PUBLIC_POLAR_CREDITS_50_ID) {
  creditPackMap[process.env.NEXT_PUBLIC_POLAR_CREDITS_50_ID.trim()] = 50;
}

async function grantCreditsFromOrder(payload: WebhookOrderPayload) {
  const order = payload.data;
  const customer = order.customer;
  const externalId = customer?.externalId;

  if (!externalId) {
    console.warn('Polar webhook: order has no externalId, skipping credit grant.');
    return;
  }

  // Determine credits to grant - from metadata or product mapping
  const creditsToGrant = order.metadata?.credits || creditPackMap[order.productId];

  if (!creditsToGrant) {
    console.warn('Polar webhook: unknown credit pack product', order.productId);
    return;
  }

  const supabase = createServiceRoleClient();

  // Idempotency check: ensure this order hasn't already been processed
  const { data: existingTx } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('user_id', externalId)
    .eq('transaction_type', 'purchase')
    .contains('metadata', { polar_order_id: order.id })
    .limit(1)
    .maybeSingle();

  if (existingTx) {
    console.log(`Polar webhook: order ${order.id} already processed, skipping duplicate.`);
    return;
  }

  // Use the atomic add_credits RPC to prevent race conditions
  const { data, error } = await supabase.rpc('add_credits', {
    p_user_id: externalId,
    p_amount: creditsToGrant,
    p_transaction_type: 'purchase',
    p_description: `Purchased ${creditsToGrant} credits`,
    p_metadata: {
      polar_order_id: order.id,
      polar_product_id: order.productId,
      amount_paid: order.amount,
    },
  });

  if (error) {
    console.error('Polar webhook: failed to grant credits', error);
    return;
  }

  console.log(`Polar webhook: granted ${creditsToGrant} credits to user ${externalId}, new balance: ${data?.[0]?.new_balance}`);
}

async function syncProfileFromSubscription(
  payload: WebhookSubscriptionPayload,
  status: string,
) {
  const subscription = payload.data;
  const customer = subscription.customer;
  const externalId = customer?.externalId;

  if (!externalId) {
    console.warn('Polar webhook: subscription has no externalId, skipping sync.');
    return;
  }

  const planTier = productPlanMap[subscription.productId] || 'starter';
  const supabase = createServiceRoleClient();

  const updatePayload: Record<string, any> = {
    plan_tier: planTier,
    plan_status: status,
    plan_product_id: subscription.productId,
    polar_subscription_id: subscription.id,
    polar_customer_id: customer.id,
    polar_external_id: customer.externalId,
    plan_expires_at: subscription.endsAt || subscription.currentPeriodEnd || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', externalId);

  if (error) {
    console.error('Polar webhook: failed to sync profile', error);
  }
}

async function grantSubscriptionCredits(
  payload: WebhookSubscriptionPayload,
) {
  const subscription = payload.data;
  const externalId = subscription.customer?.externalId;

  if (!externalId) return;

  const planTier = productPlanMap[subscription.productId];
  if (planTier !== 'premium') return;

  const supabase = createServiceRoleClient();

  // Idempotency: check if credits were already granted for this subscription period
  const periodEnd = subscription.currentPeriodEnd || subscription.endsAt;
  const { data: existingGrant } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('user_id', externalId)
    .eq('transaction_type', 'subscription_grant')
    .contains('metadata', { polar_subscription_id: subscription.id, period_end: periodEnd })
    .limit(1)
    .maybeSingle();

  if (existingGrant) {
    console.log(`Polar webhook: subscription credits already granted for period ${periodEnd}, skipping.`);
    return;
  }

  const { data, error } = await supabase.rpc('add_credits', {
    p_user_id: externalId,
    p_amount: PREMIUM_MONTHLY_CREDITS,
    p_transaction_type: 'subscription_grant',
    p_description: `Premium plan monthly credits (${PREMIUM_MONTHLY_CREDITS})`,
    p_metadata: {
      polar_subscription_id: subscription.id,
      period_end: periodEnd,
    },
  });

  if (error) {
    console.error('Polar webhook: failed to grant subscription credits', error);
    return;
  }

  console.log(`Polar webhook: granted ${PREMIUM_MONTHLY_CREDITS} subscription credits to user ${externalId}, new balance: ${data?.[0]?.new_balance}`);
}

const webhookHandler = webhookSecret
  ? Webhooks({
      webhookSecret,
      // Subscription events
      onSubscriptionCreated: async (payload: unknown) => {
        await syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status);
      },
      onSubscriptionUpdated: async (payload: unknown) => {
        await syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status);
      },
      onSubscriptionActive: async (payload: unknown) => {
        const sub = payload as WebhookSubscriptionPayload;
        await syncProfileFromSubscription(sub, sub.data.status ?? 'active');
        // Grant monthly credits when subscription becomes active
        await grantSubscriptionCredits(sub);
      },
      onSubscriptionCanceled: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, 'canceled'),
      onSubscriptionRevoked: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, 'revoked'),
      // One-time order events (for credit packs)
      onOrderCreated: async (payload: unknown) => {
        const orderPayload = payload as WebhookOrderPayload;
        // Check if this is a credit pack purchase
        if (creditPackMap[orderPayload.data.productId] || orderPayload.data.metadata?.type === 'credit_pack') {
          await grantCreditsFromOrder(orderPayload);
        }
      },
    })
  : null;

export async function POST(request: NextRequest) {
  if (!webhookHandler) {
    return NextResponse.json(
      { error: 'POLAR_WEBHOOK_SECRET is not configured' },
      { status: 500 },
    );
  }

  return webhookHandler(request);
}
