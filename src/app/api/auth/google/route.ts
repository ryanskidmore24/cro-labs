import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl, type GoogleScopeKey } from "@/lib/integrations/google-auth";

/**
 * GET /api/auth/google?scope=ga4|search-console|both&userId=<uuid>
 *
 * Redirects the user to Google's OAuth consent screen with the
 * appropriate scopes for the requested integration.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope") ?? "both";
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required" },
      { status: 400 }
    );
  }

  let scopeKeys: GoogleScopeKey[];

  switch (scope) {
    case "ga4":
      scopeKeys = ["GA4"];
      break;
    case "search-console":
      scopeKeys = ["SEARCH_CONSOLE"];
      break;
    case "both":
      scopeKeys = ["GA4", "SEARCH_CONSOLE"];
      break;
    default:
      return NextResponse.json(
        { error: "Invalid scope. Must be ga4, search-console, or both." },
        { status: 400 }
      );
  }

  const state = JSON.stringify({ userId, scope });
  const authUrl = getGoogleAuthUrl(scopeKeys, state);

  return NextResponse.redirect(authUrl);
}
