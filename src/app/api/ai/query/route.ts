import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { naturalLanguageQuery } from "@/lib/ai/claude-client";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const result = await naturalLanguageQuery(query, {
      storeId: session.orgId,
      storeName: "",
    });

    return NextResponse.json({ answer: result.answer, suggestedFollowUps: result.suggestedFollowUps });
  } catch (e: any) {
    console.error("Query failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
