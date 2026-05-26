import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/snippet/tests
 *
 * Returns active (RUNNING) tests for a given store + URL + device.
 * Called by the client-side CRO snippet to fetch test configuration.
 *
 * Query params:
 *   storeId  — Shopify store identifier (from integration metadata)
 *   url      — current page URL on the merchant's store
 *   device   — "mobile" | "desktop" | "tablet"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const storeId = searchParams.get('storeId');
  const url = searchParams.get('url');
  const device = searchParams.get('device') ?? 'desktop';

  if (!storeId || !url) {
    return NextResponse.json(
      { error: 'Missing required parameters: storeId, url' },
      { status: 400 },
    );
  }

  try {
    // Find the integration for this store
    const integration = await prisma.integration.findFirst({
      where: {
        type: 'SHOPIFY',
        enabled: true,
        metadata: {
          path: ['storeId'],
          equals: storeId,
        },
      },
      select: { userId: true },
    });

    if (!integration) {
      return NextResponse.json({ tests: [] }, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fetch all running tests owned by this user
    const tests = await prisma.test.findMany({
      where: {
        ownerId: integration.userId,
        status: 'RUNNING',
      },
      include: {
        variants: {
          select: {
            id: true,
            name: true,
            isControl: true,
            trafficWeight: true,
            domChanges: true,
            cssChanges: true,
            jsChanges: true,
          },
        },
      },
    });

    // Filter by URL pattern and device target
    const matchingTests = tests.filter((test) => {
      // URL matching: support exact match, glob patterns, and regex
      if (test.targetUrl) {
        if (!matchUrl(url, test.targetUrl)) return false;
      }

      // Device matching
      if (test.deviceTarget !== 'ALL') {
        if (test.deviceTarget.toLowerCase() !== device.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Shape the response for the snippet
    const response = matchingTests.map((test) => ({
      id: test.id,
      name: test.name,
      trafficPercent: test.trafficPercent,
      variants: test.variants.map((v) => ({
        id: v.id,
        name: v.name,
        isControl: v.isControl,
        weight: v.trafficWeight,
        domChanges: v.domChanges ?? [],
        cssChanges: v.cssChanges ?? null,
        jsChanges: v.jsChanges ?? null,
      })),
    }));

    return NextResponse.json(
      { tests: response },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      },
    );
  } catch (err) {
    console.error('[snippet/tests] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Match a URL against a target pattern.
 * Supports:
 *   - Exact match
 *   - Wildcard (*) glob patterns (e.g. /collections/*)
 *   - Starts-with patterns ending with *
 */
function matchUrl(currentUrl: string, pattern: string): boolean {
  try {
    // Normalise: strip protocol + host to compare just pathnames
    const currentPath = new URL(currentUrl).pathname;
    let targetPath: string;

    try {
      targetPath = new URL(pattern).pathname;
    } catch {
      // Pattern is already just a path
      targetPath = pattern;
    }

    // Exact match
    if (currentPath === targetPath) return true;

    // Glob matching: convert * to regex
    if (targetPath.includes('*')) {
      const regexStr =
        '^' +
        targetPath
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$';
      return new RegExp(regexStr).test(currentPath);
    }

    return false;
  } catch {
    // If URL parsing fails, fall back to string comparison
    return currentUrl.includes(pattern);
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
