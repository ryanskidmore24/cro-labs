import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [user, org] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, avatar: true, emailVerified: true },
    }),
    prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { id: true, name: true, slug: true, publicKey: true, plan: true },
    }),
  ]);

  if (!user || !org) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ user, org, orgRole: session.orgRole });
}
