import { Webhooks } from '@polar-sh/nextjs';
import type {
  WebhookSubscriptionActivePayload,
  WebhookSubscriptionCanceledPayload,
  WebhookSubscriptionCreatedPayload,
  WebhookSubscriptionRevokedPayload,
  WebhookSubscriptionUpdatedPayload,
} from '@polar-sh/sdk/webhooks';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

const productPlanMap: Record<string, string> = {};
if (process.env.NEXT_PUBLIC_POLAR_PRODUCT_STARTER_ID) {
  productPlanMap[process.env.NEXT_PUBLIC_POLAR_PRODUCT_STARTER_ID] = 'starter';
}
if (process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO_ID) {
  productPlanMap[process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO_ID] = 'pro';
}

async function syncProfileFromSubscription(
  payload:
    | WebhookSubscriptionCreatedPayload
    | WebhookSubscriptionUpdatedPayload
    | WebhookSubscriptionActivePayload
    | WebhookSubscriptionCanceledPayload
    | WebhookSubscriptionRevokedPayload,
  status: string,
) {
  const subscription = payload.data;
  const customer = subscription.customer;
  const externalId = customer.externalId;

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
      onSubscriptionCreated: (payload) => syncProfileFromSubscription(payload, payload.data.status),
      onSubscriptionUpdated: (payload) => syncProfileFromSubscription(payload, payload.data.status),
      onSubscriptionActive: (payload) => syncProfileFromSubscription(payload, payload.data.status ?? 'active'),
      onSubscriptionCanceled: (payload) => syncProfileFromSubscription(payload, 'canceled'),
      onSubscriptionRevoked: (payload) => syncProfileFromSubscription(payload, 'revoked'),
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
