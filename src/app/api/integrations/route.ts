import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integrations = await prisma.integration.findMany({
    where: { organizationId: session.orgId },
    orderBy: { type: "asc" },
  });

  return NextResponse.json({
    integrations: integrations.map((i) => ({
      ...i,
      accessToken: undefined,
      refreshToken: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, metadata } = body;

  const existing = await prisma.integration.findFirst({
    where: { organizationId: session.orgId, type },
  });

  const integration = await prisma.integration.upsert({
    where: { id: existing?.id ?? "00000000-0000-0000-0000-000000000000" },
    update: { metadata, enabled: true, updatedAt: new Date() },
    create: {
      organizationId: session.orgId,
      type,
      accessToken: metadata?.apiKey || "",
      metadata,
      enabled: true,
    },
  });

  return NextResponse.json({ integration: { ...integration, accessToken: undefined } });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

  await prisma.integration.updateMany({
    where: { organizationId: session.orgId, type: type as any },
    data: { enabled: false },
  });

  return NextResponse.json({ success: true });
}
