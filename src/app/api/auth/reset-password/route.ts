import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { resetToken: token } });

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Reset link is invalid or has expired.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });

  return NextResponse.json({ ok: true });
}
