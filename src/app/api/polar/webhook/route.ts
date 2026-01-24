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
      onSubscriptionCreated: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status),
      onSubscriptionUpdated: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status),
      onSubscriptionActive: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, (payload as WebhookSubscriptionPayload).data.status ?? 'active'),
      onSubscriptionCanceled: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, 'canceled'),
      onSubscriptionRevoked: (payload: unknown) => syncProfileFromSubscription(payload as WebhookSubscriptionPayload, 'revoked'),
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
