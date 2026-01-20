import { Checkout } from '@polar-sh/nextjs';
import { NextRequest, NextResponse } from 'next/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const successUrl = process.env.POLAR_SUCCESS_URL || `${siteUrl}/billing/success`;
const returnUrl = process.env.POLAR_RETURN_URL || siteUrl;
const server = process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

const checkout = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl,
  returnUrl,
  server,
  includeCheckoutId: true,
});

export async function GET(request: NextRequest) {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'POLAR_ACCESS_TOKEN is not configured' },
      { status: 500 },
    );
  }

  return checkout(request);
}
