import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/integrations/google-auth";
import { prisma } from "@/lib/prisma";
import { IntegrationType } from "@prisma/client";

/**
 * GET /api/auth/google/callback?code=<code>&state=<state>
 *
 * Handles the Google OAuth callback for analytics integrations.
 * State now carries { orgId, scope } instead of userId.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${encodeURIComponent(error)}`);
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${appUrl}/integrations?error=missing_code_or_state`);
  }

  let state: { orgId: string; scope: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return NextResponse.redirect(`${appUrl}/integrations?error=invalid_state`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);

    const grantedScopes = tokens.scope.split(" ");
    const integrationTypes: IntegrationType[] = [];

    if (grantedScopes.some((s) => s.includes("analytics.readonly"))) {
      integrationTypes.push(IntegrationType.GA4);
    }
    if (grantedScopes.some((s) => s.includes("webmasters.readonly"))) {
      integrationTypes.push(IntegrationType.SEARCH_CONSOLE);
    }

    for (const type of integrationTypes) {
      const existing = await prisma.integration.findFirst({
        where: { organizationId: state.orgId, type },
        select: { id: true },
      });

      await prisma.integration.upsert({
        where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          enabled: true,
        },
        create: {
          organizationId: state.orgId,
          type,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          enabled: true,
        },
      });
    }

    return NextResponse.redirect(
      `${appUrl}/integrations?success=google&types=${integrationTypes.join(",")}`,
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`);
  }
}
