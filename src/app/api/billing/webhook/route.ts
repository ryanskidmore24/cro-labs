import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/billing/stripe';
import { prisma } from '@/lib/prisma';
import type Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const plan = session.metadata?.plan;
        if (orgId && plan && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan: plan as any,
              stripeSubscriptionId: sub.id,
              subscriptionStatus: sub.status,
              subscriptionPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;
        if (orgId) {
          const isActive = sub.status === 'active' || sub.status === 'trialing';
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              subscriptionStatus: sub.status,
              subscriptionPeriodEnd: new Date((sub as any).current_period_end * 1000),
              plan: isActive ? (sub.metadata?.plan as any ?? 'FREE') : 'FREE',
            },
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
