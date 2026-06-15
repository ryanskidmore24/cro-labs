import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, createSession, setSessionCookie } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';

const Schema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { token, name, password } = parsed.data;

  const invite = await prisma.orgInvite.findUnique({ where: { token } });
  if (!invite || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invite link is invalid or has expired.' }, { status: 400 });
  }

  // Check if the session user already exists
  const session = await getSessionFromRequest(req);
  let userId: string;

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create account for new user
    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required for new accounts.' }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: { email: invite.email, name, passwordHash, emailVerified: true },
    });
    userId = newUser.id;
  }

  // Check not already a member
  const already = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
  });

  if (!already) {
    await prisma.organizationMember.create({
      data: { organizationId: invite.organizationId, userId, role: invite.role },
    });
  }

  // Delete the invite
  await prisma.orgInvite.delete({ where: { token } });

  // Issue a session for the invited user
  const jwtToken = await createSession({
    userId,
    orgId: invite.organizationId,
    email: invite.email,
    orgRole: invite.role,
  });

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, jwtToken);
  return response;
}
