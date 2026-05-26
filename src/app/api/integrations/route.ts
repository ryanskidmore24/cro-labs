import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET: List all integrations for the current user
export async function GET() {
  // TODO: get actual userId from session
  const integrations = await prisma.integration.findMany({
    orderBy: { type: "asc" },
  });

  return NextResponse.json({
    integrations: integrations.map((i) => ({
      ...i,
      accessToken: undefined, // Never expose tokens
      refreshToken: undefined,
    })),
  });
}

// POST: Create/update an integration (used for API-key-based ones like Clarity)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, metadata } = body;

  // TODO: get actual userId from session
  const userId = body.userId || undefined;

  const integration = await prisma.integration.upsert({
    where: {
      // Use a unique compound — for now just find first of this type
      id: (
        await prisma.integration.findFirst({ where: { type } })
      )?.id || "00000000-0000-0000-0000-000000000000",
    },
    update: {
      metadata,
      enabled: true,
      updatedAt: new Date(),
    },
    create: {
      type,
      accessToken: metadata.apiKey || "",
      metadata,
      enabled: true,
      ...(userId ? { userId } : {}),
    },
  });

  return NextResponse.json({ integration: { ...integration, accessToken: undefined } });
}

// DELETE: Disconnect an integration
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

  await prisma.integration.updateMany({
    where: { type: type as any },
    data: { enabled: false },
  });

  return NextResponse.json({ success: true });
}
