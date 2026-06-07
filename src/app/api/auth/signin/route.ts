import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';

const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SigninSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  const INVALID_MSG = 'Invalid email or password.';

  if (!user || !user.passwordHash) {
    // Constant-time-safe: still run verification to prevent timing attacks
    await verifyPassword(password, 'dummy:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000');
    return NextResponse.json({ error: INVALID_MSG }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: INVALID_MSG }, { status: 401 });
  }

  const membership = user.memberships[0];
  if (!membership) {
    return NextResponse.json({ error: 'No organization found for this account.' }, { status: 403 });
  }

  const token = await createSession({
    userId: user.id,
    orgId: membership.organizationId,
    email: user.email,
    orgRole: membership.role,
  });

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    org: { id: membership.organization.id, name: membership.organization.name },
  });

  setSessionCookie(response, token);
  return response;
}
