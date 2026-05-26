import { NextRequest, NextResponse } from "next/server";
import { naturalLanguageQuery } from "@/lib/ai/claude-client";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const result = await naturalLanguageQuery(query, {
      storeId: "default",
      availableData: ["GA4", "Search Console", "Clarity", "Shopify"],
    });

    return NextResponse.json({ answer: result.answer, sources: result.sources });
  } catch (e: any) {
    console.error("Query failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
