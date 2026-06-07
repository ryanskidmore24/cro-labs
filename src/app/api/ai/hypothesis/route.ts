import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateHypotheses } from "@/lib/ai/claude-client";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { signalId } = await req.json();

    const signal = await prisma.frictionSignal.findUnique({
      where: { id: signalId, organizationId: session.orgId },
    });

    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    const hypotheses = await generateHypotheses({
      storeId: session.orgId,
      pageUrl: signal.pageUrl,
      pageType: "other",
    });

    const created = await Promise.all(
      hypotheses.map((h: any) =>
        prisma.hypothesis.create({
          data: {
            organizationId: session.orgId,
            frictionSignal: h.frictionSignal || signal.signalType,
            suggestedChange: h.suggestedChange,
            predictedKpi: h.predictedKpi || "CVR",
            predictedLift: h.predictedLift,
            confidenceScore: h.confidenceScore,
            effort: h.effort || "MEDIUM",
            aiModel: "CLAUDE",
            evidenceData: { signalId, ...h.evidenceData },
            status: "SUGGESTED",
          },
        }),
      ),
    );

    return NextResponse.json({
      hypotheses: created.map((h) => ({
        id: h.id,
        suggestedChange: h.suggestedChange,
        predictedLift: h.predictedLift,
        effort: h.effort,
      })),
    });
  } catch (e: any) {
    console.error("Hypothesis generation failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
