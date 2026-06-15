import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: session.orgId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const invites = await prisma.orgInvite.findMany({
    where: { organizationId: session.orgId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ members, invites });
}

const UpdateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.orgRole !== 'OWNER' && session.orgRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { userId, role } = parsed.data;
  if (userId === session.userId) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  const member = await prisma.organizationMember.updateMany({
    where: { organizationId: session.orgId, userId },
    data: { role },
  });

  if (member.count === 0) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

const DeleteSchema = z.object({ userId: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.orgRole !== 'OWNER' && session.orgRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { userId } = parsed.data;
  if (userId === session.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  await prisma.organizationMember.deleteMany({
    where: { organizationId: session.orgId, userId },
  });

  return NextResponse.json({ ok: true });
}
