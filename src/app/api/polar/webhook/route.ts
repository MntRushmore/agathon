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
import { createServerSupabaseClient } from '@/lib/supabase/server';

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

const productPlanMap: Record<string, string> = {};
if (process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID) {
  productPlanMap[process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID] = 'free';
}
if (process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID) {
  productPlanMap[process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID] = 'premium';
}

// Credit pack product mapping (product ID -> total credits including bonus)
const creditPackMap: Record<string, number> = {};
if (process.env.NEXT_PUBLIC_POLAR_CREDITS_50_ID) {
  creditPackMap[process.env.NEXT_PUBLIC_POLAR_CREDITS_50_ID] = 50;
}
if (process.env.NEXT_PUBLIC_POLAR_CREDITS_150_ID) {
  creditPackMap[process.env.NEXT_PUBLIC_POLAR_CREDITS_150_ID] = 175; // 150 + 25 bonus
}
if (process.env.NEXT_PUBLIC_POLAR_CREDITS_500_ID) {
  creditPackMap[process.env.NEXT_PUBLIC_POLAR_CREDITS_500_ID] = 600; // 500 + 100 bonus
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
  let creditsToGrant = order.metadata?.credits || creditPackMap[order.productId];

  if (!creditsToGrant) {
    console.warn('Polar webhook: unknown credit pack product', order.productId);
    return;
  }

  const supabase = await createServerSupabaseClient();

  // Get current user credits
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', externalId)
    .single();

  if (fetchError) {
    console.error('Polar webhook: failed to fetch profile for credit grant', fetchError);
    return;
  }

  const currentCredits = profile?.credits || 0;
  const newCredits = currentCredits + creditsToGrant;

  // Update credits
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      credits: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', externalId);

  if (updateError) {
    console.error('Polar webhook: failed to update credits', updateError);
    return;
  }

  // Log the transaction
  const { error: txError } = await supabase.from('credit_transactions').insert({
    user_id: externalId,
    amount: creditsToGrant,
    balance_after: newCredits,
    transaction_type: 'purchase',
    description: `Purchased ${creditsToGrant} credits`,
    metadata: {
      polar_order_id: order.id,
      polar_product_id: order.productId,
      amount_paid: order.amount,
    },
  });

  if (txError) {
    console.error('Polar webhook: failed to log credit transaction', txError);
  }

  console.log(`Polar webhook: granted ${creditsToGrant} credits to user ${externalId}`);
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
  const supabase = await createServerSupabaseClient();

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

const webhookHandler = webhookSecret
  ? Webhooks({
      webhookSecret,
      // Subscription events
      onSubscriptionCreated: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status),
      onSubscriptionUpdated: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status),
      onSubscriptionActive: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status ?? 'active'),
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
