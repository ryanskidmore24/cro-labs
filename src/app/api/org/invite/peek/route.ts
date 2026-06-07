import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const invite = await prisma.orgInvite.findUnique({ where: { token } });
  if (!invite || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  return NextResponse.json({ email: invite.email, hasAccount: !!existing });
}
