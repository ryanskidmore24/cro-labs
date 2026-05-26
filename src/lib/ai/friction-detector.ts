import { prisma } from "@/lib/db";
import { IntegrationType, Severity, SignalType } from "@prisma/client";
import {
  getIntegrationClient,
  type GA4Client,
  type SearchConsoleClient,
  type ClarityClient,
} from "@/lib/integrations";
import { analyzeClarityData, analyzeGA4Data } from "./gemini-client";
import { generateHypotheses } from "./claude-client";
import type {
  DateRange,
  FrictionSignalDetected,
  StoreMetrics,
  TestSuggestion,
  FrictionContext,
  Hypothesis,
} from "./types";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Thresholds used to classify friction severity */
const THRESHOLDS = {
  bounceRate: { medium: 0.55, high: 0.70, critical: 0.85 },
  dropoffRate: { medium: 0.50, high: 0.65, critical: 0.80 },
  rageClicksPerSession: { medium: 0.02, high: 0.05, critical: 0.10 },
  deadClicksPerSession: { medium: 0.03, high: 0.08, critical: 0.15 },
  mobileDesktopCvrGap: { medium: 0.40, high: 0.60, critical: 0.75 },
  scrollDepth: { medium: 0.40, high: 0.25, critical: 0.15 },
  ctr: { medium: 0.02, high: 0.01, critical: 0.005 },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function classifySeverity(
  value: number,
  thresholds: { medium: number; high: number; critical: number },
  /** If true, lower values are worse (e.g., scroll depth, CTR) */
  inverted = false
): Severity {
  if (inverted) {
    if (value <= thresholds.critical) return Severity.CRITICAL;
    if (value <= thresholds.high) return Severity.HIGH;
    if (value <= thresholds.medium) return Severity.MEDIUM;
    return Severity.LOW;
  }
  if (value >= thresholds.critical) return Severity.CRITICAL;
  if (value >= thresholds.high) return Severity.HIGH;
  if (value >= thresholds.medium) return Severity.MEDIUM;
  return Severity.LOW;
}

// ─── Main Detection ─────────────────────────────────────────────────────────

/**
 * Pull data from all connected integrations for a store,
 * run through AI analysis, and return detected friction signals
 * with severity scores.
 */
export async function detectFrictionSignals(
  storeId: string
): Promise<FrictionSignalDetected[]> {
  const dateRange = defaultDateRange();
  const signals: FrictionSignalDetected[] = [];

  // Fetch the store owner to load integrations
  const store = await prisma.user.findUnique({
    where: { id: storeId },
    include: {
      integrations: { where: { enabled: true } },
    },
  });

  if (!store) {
    throw new Error(`Store/user not found: ${storeId}`);
  }

  // ── GA4 Analysis ──────────────────────────────────────────────────────

  const hasGA4 = store.integrations.some(
    (i) => i.type === IntegrationType.GA4
  );

  if (hasGA4) {
    try {
      const ga4Client = (await getIntegrationClient(
        IntegrationType.GA4,
        storeId
      )) as GA4Client;

      const propertyId = getPropertyId(store.integrations, IntegrationType.GA4);

      const [pageMetrics, deviceBreakdown, funnelData] = await Promise.all([
        ga4Client.getPageMetrics(propertyId, dateRange),
        ga4Client.getDeviceBreakdown(propertyId, dateRange),
        ga4Client.getFunnelData(
          propertyId,
          [
            { name: "Page View", eventName: "page_view" },
            { name: "Add to Cart", eventName: "add_to_cart" },
            { name: "Begin Checkout", eventName: "begin_checkout" },
            { name: "Purchase", eventName: "purchase" },
          ],
          dateRange
        ),
      ]);

      // Detect high bounce rate pages
      for (const page of pageMetrics) {
        if (page.bounceRate >= THRESHOLDS.bounceRate.medium && page.pageViews >= 100) {
          const severity = classifySeverity(page.bounceRate, THRESHOLDS.bounceRate);
          signals.push({
            id: `bounce-${page.pagePath}`,
            pageUrl: page.pagePath,
            signalType: SignalType.HIGH_BOUNCE,
            severity,
            metric: page.bounceRate,
            baseline: 0.45, // industry average
            description: `High bounce rate (${(page.bounceRate * 100).toFixed(1)}%) on ${page.pagePath} with ${page.pageViews.toLocaleString()} views`,
            evidencePoints: [
              `Bounce rate: ${(page.bounceRate * 100).toFixed(1)}% (baseline: 45%)`,
              `Page views: ${page.pageViews.toLocaleString()}`,
              `Avg session duration: ${page.avgSessionDuration.toFixed(0)}s`,
            ],
          });
        }
      }

      // Detect funnel drop-offs
      for (let i = 1; i < funnelData.length; i++) {
        const step = funnelData[i];
        if (step.dropoffRate >= THRESHOLDS.dropoffRate.medium) {
          const severity = classifySeverity(step.dropoffRate, THRESHOLDS.dropoffRate);
          const prevStep = funnelData[i - 1];
          signals.push({
            id: `dropoff-${step.eventName}`,
            pageUrl: `funnel:${prevStep.stepName}-to-${step.stepName}`,
            signalType: SignalType.HIGH_DROPOFF,
            severity,
            metric: step.dropoffRate,
            baseline: 0.40,
            description: `${(step.dropoffRate * 100).toFixed(1)}% drop-off from ${prevStep.stepName} to ${step.stepName}`,
            evidencePoints: [
              `Users at ${prevStep.stepName}: ${prevStep.activeUsers.toLocaleString()}`,
              `Users at ${step.stepName}: ${step.activeUsers.toLocaleString()}`,
              `Drop-off rate: ${(step.dropoffRate * 100).toFixed(1)}%`,
              `Users lost: ${(prevStep.activeUsers - step.activeUsers).toLocaleString()}`,
            ],
          });
        }
      }

      // Detect mobile/desktop CVR gap
      const mobileDevice = deviceBreakdown.find(
        (d) => d.deviceCategory === "mobile"
      );
      const desktopDevice = deviceBreakdown.find(
        (d) => d.deviceCategory === "desktop"
      );

      if (mobileDevice && desktopDevice && desktopDevice.conversionRate > 0) {
        const gap =
          1 - mobileDevice.conversionRate / desktopDevice.conversionRate;
        if (gap >= THRESHOLDS.mobileDesktopCvrGap.medium) {
          const severity = classifySeverity(gap, THRESHOLDS.mobileDesktopCvrGap);
          signals.push({
            id: "mobile-cvr-gap",
            pageUrl: "sitewide",
            signalType: SignalType.HIGH_DROPOFF,
            severity,
            metric: gap,
            baseline: 0.35,
            description: `Mobile CVR is ${(gap * 100).toFixed(0)}% lower than desktop (mobile: ${(mobileDevice.conversionRate * 100).toFixed(2)}%, desktop: ${(desktopDevice.conversionRate * 100).toFixed(2)}%)`,
            evidencePoints: [
              `Mobile CVR: ${(mobileDevice.conversionRate * 100).toFixed(2)}%`,
              `Desktop CVR: ${(desktopDevice.conversionRate * 100).toFixed(2)}%`,
              `Mobile sessions: ${mobileDevice.sessions.toLocaleString()}`,
              `Gap: ${(gap * 100).toFixed(0)}% (industry typical: ~35%)`,
            ],
          });
        }
      }

      // Run AI-powered pattern detection on GA4 data
      try {
        const ga4Insights = await analyzeGA4Data({
          funnelData,
          pageMetrics,
          deviceBreakdown,
          dateRange,
        });

        // Convert AI anomalies to friction signals
        for (const anomaly of ga4Insights.anomalies) {
          if (anomaly.severity === "high") {
            signals.push({
              id: `ga4-anomaly-${anomaly.metric}`,
              pageUrl: "sitewide",
              signalType: SignalType.HIGH_DROPOFF,
              severity: Severity.HIGH,
              metric: anomaly.actual,
              baseline: anomaly.expected,
              description: `GA4 anomaly: ${anomaly.metric} is ${anomaly.deviationPercent.toFixed(0)}% ${anomaly.actual > anomaly.expected ? "above" : "below"} expected`,
              evidencePoints: [
                `Expected: ${anomaly.expected}`,
                `Actual: ${anomaly.actual}`,
                `Deviation: ${anomaly.deviationPercent.toFixed(1)}%`,
                ...anomaly.possibleCauses.slice(0, 2),
              ],
            });
          }
        }
      } catch {
        // AI analysis is supplementary; don't fail the whole detection
        console.warn("GA4 AI analysis failed, continuing with rule-based signals");
      }
    } catch (error) {
      console.error("GA4 friction detection failed:", error);
    }
  }

  // ── Clarity Analysis ──────────────────────────────────────────────────

  const hasClarity = store.integrations.some(
    (i) => i.type === IntegrationType.CLARITY
  );

  if (hasClarity) {
    try {
      const clarityClient = (await getIntegrationClient(
        IntegrationType.CLARITY,
        storeId
      )) as ClarityClient;

      const [smartEvents, dashboardMetrics] = await Promise.all([
        clarityClient.getSmartEvents(dateRange),
        clarityClient.getDashboardMetrics(dateRange),
      ]);

      // Detect rage clicks
      const rageClicks = smartEvents.filter(
        (e) => e.eventType === "rage_click"
      );
      for (const event of rageClicks) {
        const ratePerSession =
          dashboardMetrics.totalSessions > 0
            ? event.affectedSessions / dashboardMetrics.totalSessions
            : 0;
        const severity = classifySeverity(
          ratePerSession,
          THRESHOLDS.rageClicksPerSession
        );

        if (severity !== Severity.LOW) {
          signals.push({
            id: `rage-click-${event.pageUrl}-${event.selector ?? "unknown"}`,
            pageUrl: event.pageUrl,
            signalType: SignalType.RAGE_CLICK,
            severity,
            metric: event.count,
            baseline: 0,
            description: `Rage clicks detected on ${event.pageUrl}${event.selector ? ` (${event.selector})` : ""}: ${event.count} occurrences across ${event.affectedSessions} sessions`,
            evidencePoints: [
              `Occurrences: ${event.count}`,
              `Affected sessions: ${event.affectedSessions}`,
              `Rate: ${(ratePerSession * 100).toFixed(2)}% of sessions`,
              event.selector ? `Element: ${event.selector}` : "Element: unknown",
            ],
            metadata: { selector: event.selector },
          });
        }
      }

      // Detect dead clicks
      const deadClicks = smartEvents.filter(
        (e) => e.eventType === "dead_click"
      );
      for (const event of deadClicks) {
        const ratePerSession =
          dashboardMetrics.totalSessions > 0
            ? event.affectedSessions / dashboardMetrics.totalSessions
            : 0;
        const severity = classifySeverity(
          ratePerSession,
          THRESHOLDS.deadClicksPerSession
        );

        if (severity !== Severity.LOW) {
          signals.push({
            id: `dead-click-${event.pageUrl}-${event.selector ?? "unknown"}`,
            pageUrl: event.pageUrl,
            signalType: SignalType.RAGE_CLICK, // Closest signal type
            severity,
            metric: event.count,
            baseline: 0,
            description: `Dead clicks on ${event.pageUrl}${event.selector ? ` (${event.selector})` : ""}: ${event.count} clicks with no response`,
            evidencePoints: [
              `Occurrences: ${event.count}`,
              `Affected sessions: ${event.affectedSessions}`,
              `Element: ${event.selector ?? "unknown"}`,
              "Users clicking non-interactive elements — possible design confusion",
            ],
            metadata: { selector: event.selector, subtype: "dead_click" },
          });
        }
      }

      // Detect low scroll depth from dashboard
      if (dashboardMetrics.scrollDepthAvg < THRESHOLDS.scrollDepth.medium) {
        const severity = classifySeverity(
          dashboardMetrics.scrollDepthAvg,
          THRESHOLDS.scrollDepth,
          true
        );
        signals.push({
          id: "low-scroll-depth-sitewide",
          pageUrl: "sitewide",
          signalType: SignalType.HIGH_BOUNCE,
          severity,
          metric: dashboardMetrics.scrollDepthAvg,
          baseline: 0.55,
          description: `Low average scroll depth: ${(dashboardMetrics.scrollDepthAvg * 100).toFixed(1)}% (benchmark: 55%)`,
          evidencePoints: [
            `Avg scroll depth: ${(dashboardMetrics.scrollDepthAvg * 100).toFixed(1)}%`,
            `Total sessions: ${dashboardMetrics.totalSessions.toLocaleString()}`,
            "Content below fold may not be seen by most visitors",
          ],
        });
      }

      // Run AI-powered behavior analysis
      try {
        const behaviorInsights = await analyzeClarityData({
          smartEvents,
          dashboardMetrics,
          dateRange,
        });

        for (const friction of behaviorInsights.frictionPoints) {
          if (
            friction.severity === "high" ||
            friction.severity === "critical"
          ) {
            signals.push({
              id: `clarity-ai-${friction.type}-${friction.pageUrl}`,
              pageUrl: friction.pageUrl,
              signalType: mapBehaviorTypeToSignalType(friction.type),
              severity:
                friction.severity === "critical"
                  ? Severity.CRITICAL
                  : Severity.HIGH,
              metric: friction.affectedSessions,
              baseline: 0,
              description: friction.description,
              evidencePoints: [
                `Type: ${friction.type}`,
                `Affected sessions: ${friction.affectedSessions}`,
                `Recommendation: ${friction.recommendation}`,
              ],
              metadata: { selector: friction.selector },
            });
          }
        }
      } catch {
        console.warn(
          "Clarity AI analysis failed, continuing with rule-based signals"
        );
      }
    } catch (error) {
      console.error("Clarity friction detection failed:", error);
    }
  }

  // ── Search Console (low CTR detection) ────────────────────────────────

  const hasSC = store.integrations.some(
    (i) => i.type === IntegrationType.SEARCH_CONSOLE
  );

  if (hasSC) {
    try {
      const scClient = (await getIntegrationClient(
        IntegrationType.SEARCH_CONSOLE,
        storeId
      )) as SearchConsoleClient;

      const meta = store.integrations.find(
        (i) => i.type === IntegrationType.SEARCH_CONSOLE
      )?.metadata as { siteUrl?: string } | null;
      const siteUrl = meta?.siteUrl ?? "";

      if (siteUrl) {
        const pagePerformance = await scClient.getPagePerformance(
          siteUrl,
          dateRange
        );

        for (const page of pagePerformance) {
          if (
            page.impressions >= 500 &&
            page.ctr < THRESHOLDS.ctr.medium
          ) {
            const severity = classifySeverity(
              page.ctr,
              THRESHOLDS.ctr,
              true
            );
            signals.push({
              id: `low-ctr-${page.page}`,
              pageUrl: page.page,
              signalType: SignalType.LOW_CTR,
              severity,
              metric: page.ctr,
              baseline: 0.035,
              description: `Low organic CTR (${(page.ctr * 100).toFixed(1)}%) for ${page.page} despite ${page.impressions.toLocaleString()} impressions`,
              evidencePoints: [
                `CTR: ${(page.ctr * 100).toFixed(1)}%`,
                `Impressions: ${page.impressions.toLocaleString()}`,
                `Clicks: ${page.clicks.toLocaleString()}`,
                `Avg position: ${page.position.toFixed(1)}`,
              ],
            });
          }
        }
      }
    } catch (error) {
      console.error("Search Console friction detection failed:", error);
    }
  }

  // Persist signals to database
  await persistSignals(signals);

  return signals;
}

// ─── Ranking ────────────────────────────────────────────────────────────────

/**
 * Rank friction signals by projected revenue impact.
 *
 * Impact = affectedSessions * baselineCVR * estimatedLiftIfFixed * AOV
 */
export function rankByImpact(
  signals: FrictionSignalDetected[],
  storeMetrics: StoreMetrics
): FrictionSignalDetected[] {
  const severityMultiplier: Record<Severity, number> = {
    [Severity.CRITICAL]: 4,
    [Severity.HIGH]: 3,
    [Severity.MEDIUM]: 2,
    [Severity.LOW]: 1,
  };

  return [...signals].sort((a, b) => {
    const impactA = computeImpactScore(a, storeMetrics, severityMultiplier);
    const impactB = computeImpactScore(b, storeMetrics, severityMultiplier);
    return impactB - impactA;
  });
}

function computeImpactScore(
  signal: FrictionSignalDetected,
  metrics: StoreMetrics,
  severityMultiplier: Record<Severity, number>
): number {
  // Estimate affected sessions (use metric as proxy if it represents session count)
  const affectedSessions =
    signal.metric > 1
      ? signal.metric // likely a count (rage clicks, dead clicks)
      : signal.metric * metrics.totalSessions; // likely a rate (bounce rate, drop-off)

  const estimatedLift = severityToEstimatedLift(signal.severity);

  return (
    affectedSessions *
    metrics.conversionRate *
    estimatedLift *
    metrics.averageOrderValue *
    severityMultiplier[signal.severity]
  );
}

function severityToEstimatedLift(severity: Severity): number {
  switch (severity) {
    case Severity.CRITICAL:
      return 0.15;
    case Severity.HIGH:
      return 0.10;
    case Severity.MEDIUM:
      return 0.05;
    case Severity.LOW:
      return 0.02;
  }
}

// ─── Test Suggestion Generation ─────────────────────────────────────────────

/**
 * For each friction signal, generate ranked test suggestions
 * with projected dollar impact.
 *
 * projectedRevenueLift = projectedSessions * baselineCvr * estimatedLift * aov
 */
export async function generateTestSuggestions(
  signals: FrictionSignalDetected[],
  storeMetrics?: StoreMetrics
): Promise<TestSuggestion[]> {
  const suggestions: TestSuggestion[] = [];

  // Group signals by page to batch hypothesis generation
  const signalsByPage = new Map<string, FrictionSignalDetected[]>();
  for (const signal of signals) {
    const existing = signalsByPage.get(signal.pageUrl) ?? [];
    existing.push(signal);
    signalsByPage.set(signal.pageUrl, existing);
  }

  for (const [pageUrl, pageSignals] of signalsByPage) {
    // Build friction context for Claude
    const frictionContext: FrictionContext = {
      storeId: storeMetrics?.storeId ?? "unknown",
      pageUrl,
      pageType: inferPageType(pageUrl),
      notes: pageSignals
        .map(
          (s) =>
            `[${s.severity}] ${s.signalType}: ${s.description}\nEvidence: ${s.evidencePoints.join("; ")}`
        )
        .join("\n\n"),
    };

    try {
      const hypotheses = await generateHypotheses(frictionContext);

      for (const hypothesis of hypotheses) {
        const projectedSessions = storeMetrics?.totalSessions
          ? estimatePageSessions(pageUrl, storeMetrics.totalSessions)
          : 1000;

        const baselineCvr = storeMetrics?.conversionRate ?? 0.03;
        const aov = storeMetrics?.averageOrderValue ?? 50;
        const estimatedLift = hypothesis.predictedLift;

        const projectedRevenueLift =
          projectedSessions * baselineCvr * estimatedLift * aov;

        const effortMultiplier =
          hypothesis.effort === "LOW"
            ? 3
            : hypothesis.effort === "MEDIUM"
              ? 2
              : 1;
        const priorityScore =
          projectedRevenueLift * hypothesis.confidenceScore * effortMultiplier;

        suggestions.push({
          title: `Test: ${hypothesis.suggestedChange.substring(0, 80)}`,
          description: hypothesis.evidenceData?.reasoning ?? hypothesis.suggestedChange,
          frictionSignalId: pageSignals[0].id,
          targetUrl: pageUrl,
          pageType: frictionContext.pageType,
          hypothesis,
          projectedSessions,
          baselineCvr,
          estimatedLift,
          aov,
          projectedRevenueLift,
          effort: hypothesis.effort,
          priorityScore,
        });
      }
    } catch (error) {
      console.error(
        `Failed to generate hypotheses for ${pageUrl}:`,
        error
      );
    }
  }

  // Sort by priority score descending
  return suggestions.sort((a, b) => b.priorityScore - a.priorityScore);
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function getPropertyId(
  integrations: Array<{ type: IntegrationType; metadata: unknown }>,
  type: IntegrationType
): string {
  const integration = integrations.find((i) => i.type === type);
  const metadata = integration?.metadata as { propertyId?: string } | null;
  return metadata?.propertyId ?? "";
}

function mapBehaviorTypeToSignalType(
  type: string
): SignalType {
  switch (type) {
    case "rage_click":
    case "dead_click":
    case "error_click":
      return SignalType.RAGE_CLICK;
    case "excessive_scroll":
      return SignalType.HIGH_BOUNCE;
    case "quick_back":
      return SignalType.HIGH_BOUNCE;
    case "low_scroll_depth":
      return SignalType.HIGH_BOUNCE;
    case "high_bounce":
      return SignalType.HIGH_BOUNCE;
    default:
      return SignalType.HIGH_DROPOFF;
  }
}

function inferPageType(
  url: string
): "homepage" | "collection" | "product" | "cart" | "checkout" | "landing" | "other" {
  const path = url.toLowerCase();
  if (path === "/" || path === "" || path === "sitewide") return "homepage";
  if (path.includes("/collections")) return "collection";
  if (path.includes("/products/")) return "product";
  if (path.includes("/cart")) return "cart";
  if (path.includes("/checkout")) return "checkout";
  if (path.startsWith("funnel:")) return "other";
  return "landing";
}

function estimatePageSessions(
  pageUrl: string,
  totalSessions: number
): number {
  // Rough heuristic: homepage gets ~30% of traffic, product pages ~5%, etc.
  const pageType = inferPageType(pageUrl);
  switch (pageType) {
    case "homepage":
      return Math.round(totalSessions * 0.3);
    case "collection":
      return Math.round(totalSessions * 0.15);
    case "product":
      return Math.round(totalSessions * 0.05);
    case "cart":
      return Math.round(totalSessions * 0.08);
    case "checkout":
      return Math.round(totalSessions * 0.05);
    default:
      return Math.round(totalSessions * 0.03);
  }
}

async function persistSignals(
  signals: FrictionSignalDetected[]
): Promise<void> {
  try {
    await prisma.$transaction(
      signals.map((signal) =>
        prisma.frictionSignal.upsert({
          where: { id: signal.id },
          create: {
            id: signal.id,
            pageUrl: signal.pageUrl,
            signalType: signal.signalType,
            severity: signal.severity,
            metric: signal.metric,
            baseline: signal.baseline,
            metadata: {
              description: signal.description,
              evidencePoints: signal.evidencePoints,
              ...(signal.metadata ?? {}),
            },
          },
          update: {
            severity: signal.severity,
            metric: signal.metric,
            metadata: {
              description: signal.description,
              evidencePoints: signal.evidencePoints,
              ...(signal.metadata ?? {}),
            },
          },
        })
      )
    );
  } catch (error) {
    // Don't fail detection if persistence fails — signals are still returned
    console.error("Failed to persist friction signals:", error);
  }
}
