import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const signals = await prisma.frictionSignal.findMany({
    where: { resolvedAt: null },
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    take: 50,
  });

  // Attach hypotheses for each signal
  const signalIds = signals.map((s) => s.id);
  const hypotheses = await prisma.hypothesis.findMany({
    where: {
      frictionSignal: { not: null },
      evidenceData: {
        path: ["signalId"],
        array_contains: signalIds,
      },
    },
  });

  // For now, return signals as-is (hypotheses will be generated on demand)
  return NextResponse.json({
    signals: signals.map((s) => ({
      ...s,
      detectedAt: s.detectedAt.toISOString(),
      hypotheses: [],
    })),
  });
}
