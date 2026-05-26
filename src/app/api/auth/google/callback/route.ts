import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/integrations/google-auth";
import { prisma } from "@/lib/db";
import { IntegrationType } from "@prisma/client";

/**
 * GET /api/auth/google/callback?code=<code>&state=<state>
 *
 * Handles the OAuth callback from Google. Exchanges the authorization
 * code for tokens and stores them in the database.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${appUrl}/integrations?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=missing_code_or_state`
    );
  }

  let state: { userId: string; scope: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=invalid_state`
    );
  }

  try {
    const tokens = await exchangeGoogleCode(code);

    // Determine which integration types to create/update based on granted scopes
    const grantedScopes = tokens.scope.split(" ");
    const integrationTypes: IntegrationType[] = [];

    if (
      grantedScopes.some((s) =>
        s.includes("analytics.readonly")
      )
    ) {
      integrationTypes.push(IntegrationType.GA4);
    }

    if (
      grantedScopes.some((s) =>
        s.includes("webmasters.readonly")
      )
    ) {
      integrationTypes.push(IntegrationType.SEARCH_CONSOLE);
    }

    // Upsert an Integration record for each granted scope group
    for (const type of integrationTypes) {
      await prisma.integration.upsert({
        where: {
          // Use a compound lookup: find existing integration for this user+type
          id: (
            await prisma.integration.findFirst({
              where: { userId: state.userId, type },
              select: { id: true },
            })
          )?.id ?? "00000000-0000-0000-0000-000000000000",
        },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          enabled: true,
        },
        create: {
          userId: state.userId,
          type,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          enabled: true,
        },
      });
    }

    return NextResponse.redirect(
      `${appUrl}/integrations?success=google&types=${integrationTypes.join(",")}`
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/integrations?error=token_exchange_failed`
    );
  }
}
