import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import TestDetailClient from "./TestDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TestDetailPage({ params }: Props) {
  const { id } = await params;

  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      variants: true,
      results: {
        include: { variant: { select: { name: true, isControl: true } } },
        orderBy: { computedAt: "desc" },
      },
      guardrails: true,
      owner: { select: { name: true, email: true } },
      hypotheses: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!test) return notFound();

  // Get event counts per variant for the conversion chart
  const events = await prisma.testEvent.groupBy({
    by: ["variantId", "eventType"],
    where: { testId: id },
    _count: true,
  });

  // Get daily conversion data for chart
  const dailyEvents = await prisma.testEvent.findMany({
    where: { testId: id, eventType: { in: ["IMPRESSION", "CONVERSION"] } },
    select: { variantId: true, eventType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <TestDetailClient
      test={JSON.parse(JSON.stringify(test))}
      eventCounts={JSON.parse(JSON.stringify(events))}
      dailyEvents={JSON.parse(JSON.stringify(dailyEvents))}
    />
  );
}
