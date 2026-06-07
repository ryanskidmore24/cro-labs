import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/auth/tokens';

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { id: true, name: true, slug: true, publicKey: true, plan: true, createdAt: true },
  });

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ org });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.orgRole !== 'OWNER' && session.orgRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.name) {
    updates.name = parsed.data.name;
    const newSlug = generateSlug(parsed.data.name);
    const conflict = await prisma.organization.findFirst({
      where: { slug: newSlug, id: { not: session.orgId } },
    });
    updates.slug = conflict ? `${newSlug}-${Date.now().toString(36)}` : newSlug;
  }

  const org = await prisma.organization.update({
    where: { id: session.orgId },
    data: updates,
    select: { id: true, name: true, slug: true, publicKey: true, plan: true },
  });

  return NextResponse.json({ org });
}
