import { NextResponse } from "next/server";
import { CROEngine } from "@/lib/ai";

export async function POST() {
  try {
    const engine = new CROEngine();
    // TODO: get storeId from session context
    const storeId = "default";
    const results = await engine.runFullAnalysis(storeId);
    return NextResponse.json({ success: true, ...results });
  } catch (e: any) {
    console.error("Analysis failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
