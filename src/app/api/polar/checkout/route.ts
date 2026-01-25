import { Checkout } from '@polar-sh/nextjs';
import { NextRequest } from 'next/server';

// Credit pack product IDs - check if product is a credit pack
const creditPackProducts = new Set([
  process.env.NEXT_PUBLIC_POLAR_CREDITS_50_ID,
  process.env.NEXT_PUBLIC_POLAR_CREDITS_150_ID,
  process.env.NEXT_PUBLIC_POLAR_CREDITS_500_ID,
].filter(Boolean));

const baseCheckout = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.POLAR_SUCCESS_URL || '/billing/success?checkout_id={CHECKOUT_ID}',
  server: process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

const creditsCheckout = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.POLAR_CREDITS_SUCCESS_URL || '/credits/success?checkout_id={CHECKOUT_ID}',
  server: process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('products');

  // Use credits checkout for credit pack purchases
  if (productId && creditPackProducts.has(productId)) {
    return creditsCheckout(request);
  }

  return baseCheckout(request);
}
