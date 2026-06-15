import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { IntegrationType } from "@prisma/client";

/**
 * GET /api/auth/shopify/callback?code=<code>&shop=<shop>&state=<state>&hmac=<hmac>&...
 *
 * Handles the OAuth callback from Shopify. Validates the HMAC, exchanges
 * the temporary code for a permanent access token, and stores it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const hmac = searchParams.get("hmac");
  const stateRaw = searchParams.get("state");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code || !shop || !hmac || !stateRaw) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=shopify_missing_params`
    );
  }

  // Validate HMAC
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=shopify_not_configured`
    );
  }

  const params = new URLSearchParams(searchParams.toString());
  params.delete("hmac");
  // Sort the params alphabetically for HMAC validation
  const sortedParams = new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  );
  const message = sortedParams.toString();
  const computedHmac = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(computedHmac, "hex"),
      Buffer.from(hmac, "hex")
    )
  ) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=shopify_invalid_hmac`
    );
  }

  // Parse state
  let state: { orgId: string; nonce: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=shopify_invalid_state`
    );
  }

  try {
    // Exchange code for permanent access token
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text().catch(() => "");
      console.error("Shopify token exchange failed:", errText);
      return NextResponse.redirect(
        `${appUrl}/integrations?error=shopify_token_exchange_failed`
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      scope: string;
    };

    // Upsert integration record
    const existing = await prisma.integration.findFirst({
      where: { organizationId: state.orgId, type: IntegrationType.SHOPIFY },
      select: { id: true },
    });

    await prisma.integration.upsert({
      where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: null,
        expiresAt: null,
        metadata: { shop, scope: tokenData.scope },
        enabled: true,
      },
      create: {
        organizationId: state.orgId,
        type: IntegrationType.SHOPIFY,
        accessToken: tokenData.access_token,
        refreshToken: null,
        expiresAt: null,
        metadata: { shop, scope: tokenData.scope },
        enabled: true,
      },
    });

    return NextResponse.redirect(
      `${appUrl}/integrations?success=shopify&shop=${encodeURIComponent(shop)}`
    );
  } catch (err) {
    console.error("Shopify OAuth callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/integrations?error=shopify_callback_failed`
    );
  }
}
