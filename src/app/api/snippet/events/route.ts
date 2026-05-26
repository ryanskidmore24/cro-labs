import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Event validation schema
// ---------------------------------------------------------------------------

const EventSchema = z.object({
  testId: z.string().uuid(),
  variantId: z.string().uuid(),
  visitorId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  eventType: z.enum([
    'IMPRESSION',
    'CLICK',
    'CONVERSION',
    'FORM_SUBMIT',
    'SCROLL',
    'CUSTOM',
  ]),
  eventData: z.record(z.unknown()).optional().nullable(),
  revenue: z.number().optional().nullable(),
  pageUrl: z.string().max(2048).optional().nullable(),
  device: z.string().max(32).optional().nullable(),
  source: z.string().max(128).optional().nullable(),
  timestamp: z.number().optional(), // unix ms, for ordering
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(100),
  storeId: z.string().min(1),
});

type EventInput = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per visitor)
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX = 50; // max 50 events per 10s per visitor

function checkRateLimit(visitorId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(visitorId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(visitorId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Periodically clean up stale entries (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// ---------------------------------------------------------------------------
// POST /api/snippet/events
// ---------------------------------------------------------------------------

/**
 * Receives batched events from the client-side CRO snippet.
 * Validates the event shape, checks for rate-limit abuse, then
 * inserts into the TestEvent table via Prisma.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { events } = parsed.data;

  // Rate limit check — use the first visitor ID in the batch
  const visitorIds = new Set(events.map((e) => e.visitorId));
  for (const vid of visitorIds) {
    if (!checkRateLimit(vid)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: corsHeaders() },
      );
    }
  }

  // Deduplicate: group by testId+variantId+visitorId+eventType to detect spam
  // (allow multiple of same type only for CLICK, SCROLL, CUSTOM)
  const deduped = deduplicateEvents(events);

  try {
    // Bulk insert via Prisma createMany
    const result = await prisma.testEvent.createMany({
      data: deduped.map((event) => ({
        testId: event.testId,
        variantId: event.variantId,
        visitorId: event.visitorId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventData: event.eventData ?? undefined,
        revenue: event.revenue ?? undefined,
        pageUrl: event.pageUrl ?? undefined,
        device: event.device ?? undefined,
        source: event.source ?? undefined,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json(
      { received: result.count },
      { status: 200, headers: corsHeaders() },
    );
  } catch (err) {
    console.error('[snippet/events] Insert error:', err);
    return NextResponse.json(
      { error: 'Failed to record events' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * Deduplicate events within a batch.
 * IMPRESSION and FORM_SUBMIT should only occur once per visitor+test+variant
 * per batch. CLICK, SCROLL, and CUSTOM can repeat.
 */
function deduplicateEvents(events: EventInput[]): EventInput[] {
  const seen = new Set<string>();
  const result: EventInput[] = [];

  for (const event of events) {
    // Only dedupe IMPRESSION and FORM_SUBMIT
    if (event.eventType === 'IMPRESSION' || event.eventType === 'FORM_SUBMIT') {
      const key = `${event.testId}:${event.variantId}:${event.visitorId}:${event.eventType}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    result.push(event);
  }

  return result;
}
