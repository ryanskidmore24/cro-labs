import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const EventSchema = z.object({
  testId: z.string().uuid(),
  variantId: z.string().uuid(),
  visitorId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  eventType: z.enum(['IMPRESSION', 'CLICK', 'CONVERSION', 'FORM_SUBMIT', 'SCROLL', 'CUSTOM']),
  eventData: z.record(z.unknown()).optional().nullable(),
  revenue: z.number().optional().nullable(),
  pageUrl: z.string().max(2048).optional().nullable(),
  device: z.string().max(32).optional().nullable(),
  source: z.string().max(128).optional().nullable(),
  timestamp: z.number().optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
  // Accept either key (new) or storeId (legacy) for backwards compat
  key: z.string().optional(),
  storeId: z.string().optional(),
});

type EventInput = z.infer<typeof EventSchema>;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 50;

function checkRateLimit(visitorId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(visitorId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(visitorId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 60_000);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
  }

  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { events } = parsed.data;

  const visitorIds = new Set(events.map((e) => e.visitorId));
  for (const vid of visitorIds) {
    if (!checkRateLimit(vid)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: corsHeaders() });
    }
  }

  const deduped = deduplicateEvents(events);

  try {
    const result = await prisma.testEvent.createMany({
      data: deduped.map((event) => ({
        testId: event.testId,
        variantId: event.variantId,
        visitorId: event.visitorId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventData: event.eventData as any ?? undefined,
        revenue: event.revenue ?? undefined,
        pageUrl: event.pageUrl ?? undefined,
        device: event.device ?? undefined,
        source: event.source ?? undefined,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ received: result.count }, { status: 200, headers: corsHeaders() });
  } catch (err) {
    console.error('[snippet/events] Insert error:', err);
    return NextResponse.json({ error: 'Failed to record events' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(), 'Access-Control-Max-Age': '86400' },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function deduplicateEvents(events: EventInput[]): EventInput[] {
  const seen = new Set<string>();
  const result: EventInput[] = [];
  for (const event of events) {
    if (event.eventType === 'IMPRESSION' || event.eventType === 'FORM_SUBMIT') {
      const key = `${event.testId}:${event.variantId}:${event.visitorId}:${event.eventType}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(event);
  }
  return result;
}
