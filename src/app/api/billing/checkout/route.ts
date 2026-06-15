import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { stripe, PLANS, type PlanKey } from '@/lib/billing/stripe';

const Schema = z.object({
  plan: z.enum(['PRO', 'TEAM', 'ENTERPRISE']),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const { plan } = parsed.data;
  const priceId = PLANS[plan as PlanKey].priceId;
  if (!priceId) return NextResponse.json({ error: 'Plan not configured' }, { status: 400 });

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, name: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Get or create Stripe customer
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email,
      name: org.name,
      metadata: { orgId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/settings/billing?canceled=1`,
    metadata: { orgId: org.id, plan },
    subscription_data: { metadata: { orgId: org.id, plan } },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
