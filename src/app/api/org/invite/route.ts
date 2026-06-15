import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth/tokens';
import { sendInviteEmail } from '@/lib/email';

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.orgRole !== 'OWNER' && session.orgRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = InviteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { email, role } = parsed.data;

  // Check if already a member
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { organizationId: session.orgId } } },
  });
  if (existing?.memberships.length) {
    return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 });
  }

  const [org, inviter] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.orgId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }),
  ]);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.orgInvite.upsert({
    where: { organizationId_email: { organizationId: session.orgId, email } },
    update: { token, role, expiresAt },
    create: { organizationId: session.orgId, email, role, token, expiresAt },
  });

  try {
    await sendInviteEmail(email, inviter?.name ?? inviter?.email ?? 'A teammate', org?.name ?? 'your team', token);
  } catch (e) {
    console.error('Failed to send invite email:', e);
  }

  return NextResponse.json({ ok: true });
}

// DELETE to revoke a pending invite
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.orgRole !== 'OWNER' && session.orgRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  await prisma.orgInvite.deleteMany({
    where: { organizationId: session.orgId, email },
  });

  return NextResponse.json({ ok: true });
}
