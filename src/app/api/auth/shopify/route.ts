import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionFromRequest } from "@/lib/auth/session";

const SHOPIFY_SCOPES = ["read_orders", "read_products", "read_customers"].join(",");

/**
 * GET /api/auth/shopify?shop=<mystore.myshopify.com>
 *
 * Redirects to Shopify's OAuth authorize URL. orgId is taken from session.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "shop query parameter is required" }, { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SHOPIFY_API_KEY is not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/shopify/callback`;

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = JSON.stringify({ orgId: session.orgId, nonce });

  const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  installUrl.searchParams.set("client_id", apiKey);
  installUrl.searchParams.set("scope", SHOPIFY_SCOPES);
  installUrl.searchParams.set("redirect_uri", redirectUri);
  installUrl.searchParams.set("state", state);

  return NextResponse.redirect(installUrl.toString());
}
