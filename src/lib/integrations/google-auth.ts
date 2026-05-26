import { google } from "googleapis";

const GOOGLE_SCOPES = {
  GA4: [
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
  SEARCH_CONSOLE: [
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
} as const;

export type GoogleScopeKey = keyof typeof GOOGLE_SCOPES;

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

/**
 * Build a Google OAuth consent URL for the requested scope groups.
 * @param scopeKeys - Which scope groups to request ("GA4", "SEARCH_CONSOLE", or both)
 * @param state     - Opaque state string round-tripped through the OAuth flow
 */
export function getGoogleAuthUrl(
  scopeKeys: GoogleScopeKey[],
  state?: string
): string {
  const scopes = scopeKeys.flatMap((key) => GOOGLE_SCOPES[key]);
  const client = getOAuth2Client();

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state: state ?? "",
  });
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
}

/**
 * Exchange an authorization code for access & refresh tokens.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? "",
  };
}

/**
 * Use a stored refresh token to obtain a fresh access token.
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<GoogleTokens> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  return {
    accessToken: credentials.access_token ?? "",
    refreshToken: credentials.refresh_token ?? refreshToken,
    expiresAt: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null,
    scope: credentials.scope ?? "",
  };
}

/**
 * Create an authenticated OAuth2 client from a raw access token.
 * Used internally by GA4 and Search Console clients.
 */
export function getAuthenticatedClient(accessToken: string) {
  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  return client;
}
