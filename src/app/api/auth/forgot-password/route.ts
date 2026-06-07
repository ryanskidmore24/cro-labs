import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth/tokens';

const Schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always return 200 to prevent email enumeration
  if (user && user.passwordHash) {
    const resetToken = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
      },
    });

    // TODO: send email with reset link
    // resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset token for ${user.email}: ${resetToken}`);
    }
  }

  return NextResponse.json({ ok: true, message: 'If an account exists, a reset link was sent.' });
}
