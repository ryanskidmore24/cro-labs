import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl, type GoogleScopeKey } from "@/lib/integrations/google-auth";
import { getSessionFromRequest } from "@/lib/auth/session";

/**
 * GET /api/auth/google?scope=ga4|search-console|both
 *
 * Redirects to Google's OAuth consent screen. orgId is taken from the
 * authenticated session rather than a query parameter.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope") ?? "both";

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
      return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }

  const state = JSON.stringify({ orgId: session.orgId, scope });
  const authUrl = getGoogleAuthUrl(scopeKeys, state);

  return NextResponse.redirect(authUrl);
}
