import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const SHOPIFY_SCOPES = [
  "read_orders",
  "read_products",
  "read_customers",
].join(",");

/**
 * GET /api/auth/shopify?shop=<mystore.myshopify.com>&userId=<uuid>
 *
 * Redirects the user to Shopify's OAuth install/authorize URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const userId = searchParams.get("userId");

  if (!shop) {
    return NextResponse.json(
      { error: "shop query parameter is required (e.g. mystore.myshopify.com)" },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SHOPIFY_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/shopify/callback`;

  // Generate a nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = JSON.stringify({ userId, nonce });

  const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  installUrl.searchParams.set("client_id", apiKey);
  installUrl.searchParams.set("scope", SHOPIFY_SCOPES);
  installUrl.searchParams.set("redirect_uri", redirectUri);
  installUrl.searchParams.set("state", state);

  return NextResponse.redirect(installUrl.toString());
}
