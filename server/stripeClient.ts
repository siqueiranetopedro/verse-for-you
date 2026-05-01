import Stripe from 'stripe';

function getStripeKeys() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey) throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  if (!publishableKey) throw new Error('STRIPE_PUBLISHABLE_KEY environment variable is not set');

  return { secretKey, publishableKey };
}

export function getUncachableStripeClient() {
  const { secretKey } = getStripeKeys();
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

export function getStripePublishableKey() {
  return getStripeKeys().publishableKey;
}
