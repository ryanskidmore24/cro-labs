import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateHypotheses } from "@/lib/ai/claude-client";

export async function POST(req: NextRequest) {
  try {
    const { signalId } = await req.json();

    const signal = await prisma.frictionSignal.findUnique({
      where: { id: signalId },
    });

    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    const hypotheses = await generateHypotheses({
      pageUrl: signal.pageUrl,
      signalType: signal.signalType,
      severity: signal.severity,
      metric: signal.metric,
      baseline: signal.baseline,
      metadata: signal.metadata as Record<string, any>,
    });

    // Store hypotheses in DB
    const created = await Promise.all(
      hypotheses.map((h) =>
        prisma.hypothesis.create({
          data: {
            frictionSignal: h.suggestedChange,
            suggestedChange: h.suggestedChange,
            predictedKpi: h.predictedKpi || "CVR",
            predictedLift: h.predictedLift,
            confidenceScore: h.confidenceScore,
            effort: h.effort || "MEDIUM",
            aiModel: "CLAUDE",
            evidenceData: { signalId, ...h.evidenceData },
            status: "SUGGESTED",
          },
        })
      )
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
