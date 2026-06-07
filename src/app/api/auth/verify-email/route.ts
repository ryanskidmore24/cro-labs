import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: token } });

  if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login?error=token_expired', req.url));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null, verificationTokenExpiresAt: null },
  });

  return NextResponse.redirect(new URL('/dashboard?verified=1', req.url));
}
