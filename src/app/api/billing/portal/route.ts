import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/billing/stripe';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
