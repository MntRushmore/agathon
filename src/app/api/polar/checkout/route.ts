import { Checkout } from '@polar-sh/nextjs';

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: process.env.POLAR_SUCCESS_URL || '/billing/success?checkout_id={CHECKOUT_ID}',
  server: process.env.POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});
