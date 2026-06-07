import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { generateToken, generatePublicKey, generateSlug } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/email';

const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  orgName: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, email, password, orgName } = parsed.data;

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = generateToken();
  const verificationTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

  // Determine org name/slug
  const resolvedOrgName = orgName || `${name}'s Workspace`;
  let slug = generateSlug(resolvedOrgName);

  // Make slug unique
  const slugExists = await prisma.organization.findUnique({ where: { slug } });
  if (slugExists) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const publicKey = generatePublicKey();

  // Create user + org + membership in a transaction
  const { user, org } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        verificationToken,
        verificationTokenExpiresAt,
        emailVerified: false,
      },
    });

    const org = await tx.organization.create({
      data: {
        name: resolvedOrgName,
        slug,
        publicKey,
        plan: 'FREE',
      },
    });

    await tx.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
      },
    });

    return { user, org };
  });

  if (process.env.NODE_ENV !== 'production') {
    // Auto-verify in development
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpiresAt: null },
    });
  } else {
    // Send verification email in production
    try {
      await sendVerificationEmail(user.email, user.name ?? '', verificationToken);
    } catch (e) {
      console.error('Failed to send verification email:', e);
    }
  }

  const token = await createSession({
    userId: user.id,
    orgId: org.id,
    email: user.email,
    orgRole: 'OWNER',
  });

  const response = NextResponse.json(
    {
      user: { id: user.id, name: user.name, email: user.email },
      org: { id: org.id, name: org.name, publicKey: org.publicKey },
      requiresVerification: process.env.NODE_ENV === 'production',
    },
    { status: 201 },
  );

  setSessionCookie(response, token);
  return response;
}
