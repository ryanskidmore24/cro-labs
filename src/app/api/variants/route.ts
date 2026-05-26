import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SaveVariantSchema = z.object({
  testId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  name: z.string().optional(),
  domChanges: z.array(z.any()),
  cssChanges: z.string().optional(),
  jsChanges: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = SaveVariantSchema.parse(body);

    if (data.variantId) {
      // Update existing variant
      const variant = await prisma.variant.update({
        where: { id: data.variantId },
        data: {
          domChanges: data.domChanges,
          cssChanges: data.cssChanges || "",
          jsChanges: data.jsChanges || "",
        },
      });
      return NextResponse.json(variant);
    }

    // Create new variant
    const variant = await prisma.variant.create({
      data: {
        testId: data.testId,
        name: data.name || "Variant",
        isControl: false,
        trafficWeight: 50,
        domChanges: data.domChanges,
        cssChanges: data.cssChanges || "",
        jsChanges: data.jsChanges || "",
      },
    });

    return NextResponse.json(variant, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
