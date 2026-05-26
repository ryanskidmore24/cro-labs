import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreateTestSchema = z.object({
  name: z.string().min(1),
  targetUrl: z.string().url(),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  primaryKpi: z.enum(["CVR", "REVENUE", "AOV", "SUBSCRIPTION_RATE", "CUSTOM"]).default("CVR"),
  deviceTarget: z.enum(["ALL", "MOBILE", "DESKTOP", "TABLET"]).default("ALL"),
  trafficPercent: z.number().min(1).max(100).default(100),
  effortEstimate: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  ownerId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const tests = await prisma.test.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      results: { orderBy: { computedAt: "desc" }, take: 1 },
      variants: { select: { id: true, name: true, isControl: true } },
      owner: { select: { name: true } },
      _count: { select: { events: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ tests });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateTestSchema.parse(body);

    const test = await prisma.test.create({
      data: {
        name: data.name,
        targetUrl: data.targetUrl,
        description: data.description || "",
        hypothesis: data.hypothesis || "",
        primaryKpi: data.primaryKpi,
        deviceTarget: data.deviceTarget,
        trafficPercent: data.trafficPercent,
        effortEstimate: data.effortEstimate || "MEDIUM",
        status: "DRAFT",
        trafficSplit: { control: 50, variant: 50 },
        audienceFilters: {},
        priority: 0,
        ...(data.ownerId ? { ownerId: data.ownerId } : {}),
        variants: {
          create: [
            { name: "Control", isControl: true, trafficWeight: 50, domChanges: [] },
            { name: "Variant A", isControl: false, trafficWeight: 50, domChanges: [] },
          ],
        },
      },
      include: { variants: true },
    });

    return NextResponse.json(test, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
