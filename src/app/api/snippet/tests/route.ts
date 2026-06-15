import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/snippet/tests
 *
 * Returns active (RUNNING) tests for a given org public key + URL + device.
 * Called by the client-side CRO snippet.
 *
 * Query params:
 *   key    — organization public key (data-key on the script tag)
 *   url    — current page URL on the customer's site
 *   device — "mobile" | "desktop" | "tablet"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const key = searchParams.get('key');
  const url = searchParams.get('url');
  const device = searchParams.get('device') ?? 'desktop';

  if (!key || !url) {
    return NextResponse.json(
      { error: 'Missing required parameters: key, url' },
      { status: 400 },
    );
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { publicKey: key },
      select: { id: true },
    });

    if (!org) {
      // Return empty silently — don't leak whether key exists
      return NextResponse.json({ tests: [] }, {
        status: 200,
        headers: corsHeaders(),
      });
    }

    const tests = await prisma.test.findMany({
      where: { organizationId: org.id, status: 'RUNNING' },
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

    const matchingTests = tests.filter((test) => {
      if (test.targetUrl && !matchUrl(url, test.targetUrl)) return false;
      if (test.deviceTarget !== 'ALL' && test.deviceTarget.toLowerCase() !== device.toLowerCase()) return false;
      return true;
    });

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

    return NextResponse.json({ tests: response }, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (err) {
    console.error('[snippet/tests] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function matchUrl(currentUrl: string, pattern: string): boolean {
  try {
    const currentPath = new URL(currentUrl).pathname;
    let targetPath: string;
    try {
      targetPath = new URL(pattern).pathname;
    } catch {
      targetPath = pattern;
    }

    if (currentPath === targetPath) return true;

    if (targetPath.includes('*')) {
      const regexStr =
        '^' +
        targetPath.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') +
        '$';
      return new RegExp(regexStr).test(currentPath);
    }

    return false;
  } catch {
    return currentUrl.includes(pattern);
  }
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...corsHeaders(), 'Access-Control-Max-Age': '86400' } });
}
