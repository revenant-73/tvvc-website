import Stripe from 'stripe';

export function createStripeClient(secretKey: string): Stripe {
  const apiBase = import.meta.env.STRIPE_API_BASE || process.env.STRIPE_API_BASE;
  const options: Stripe.StripeConfig = {
    apiVersion: '2025-01-27.acacia' as any,
  };

  if (apiBase) {
    const url = new URL(apiBase);
    options.host = url.hostname;
    options.port = url.port || (url.protocol === 'https:' ? 443 : 80);
    options.protocol = url.protocol === 'https:' ? 'https' : 'http';
  }

  return new Stripe(secretKey, options);
}
