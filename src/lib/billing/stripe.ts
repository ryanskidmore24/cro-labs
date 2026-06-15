import Stripe from 'stripe';

function createStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_placeholder', {
    apiVersion: '2026-05-27.dahlia',
  });
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return createStripeClient()[prop as keyof Stripe];
  },
});

export const PLANS = {
  FREE: { priceId: null, name: 'Free', tests: 3, seats: 1 },
  PRO: { priceId: process.env.STRIPE_PRO_PRICE_ID ?? '', name: 'Pro', tests: 25, seats: 3 },
  TEAM: { priceId: process.env.STRIPE_TEAM_PRICE_ID ?? '', name: 'Team', tests: -1, seats: 10 },
  ENTERPRISE: { priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '', name: 'Enterprise', tests: -1, seats: -1 },
} as const;

export type PlanKey = keyof typeof PLANS;
