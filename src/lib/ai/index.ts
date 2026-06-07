// ─── Re-exports ─────────────────────────────────────────────────────────────

export {
  generateHypotheses,
  generateTestVariant,
  analyzeTestResults,
  naturalLanguageQuery,
} from "./claude-client";

export {
  analyzeGA4Data,
  analyzeSearchConsoleData,
  analyzeClarityData,
  crossPlatformAnalysis,
} from "./gemini-client";

export {
  detectFrictionSignals,
  rankByImpact,
  generateTestSuggestions,
} from "./friction-detector";

export type {
  // Brand / Store
  BrandContext,
  DateRange,
  StoreMetrics,

  // Friction
  FrictionContext,
  FrictionSignalDetected,

  // Hypothesis
  Hypothesis,

  // Variant / DOM
  DomMutation,
  DomMutationAction,
  VariantChanges,

  // Test Results
  TestResultData,
  TestResultVariant,
  GuardrailResult,
  ResultAnalysis,
  FollowUpSuggestion,

  // GA4 Analysis
  GA4AnalysisInput,
  DataInsights,
  DataPattern,
  DataAnomaly,
  FunnelAnalysis,
  DeviceInsight,
  TrafficQualityInsight,

  // Search Console Analysis
  SearchConsoleInput,
  SearchInsights,
  KeywordOpportunity,
  ContentGap,
  UnderperformingPage,
  QuickWin,

  // Clarity Analysis
  ClarityInput,
  BehaviorInsights,
  BehaviorFrictionPoint,
  ScrollAnalysis,
  ClickPattern,
  SessionPattern,

  // Cross-Platform
  CrossPlatformInput,
  UnifiedInsights,
  CorroboratedFinding,
  PrioritizedAction,
  RevenueOpportunity,

  // Natural Language
  DataContext,
  QueryResponse,

  // Test Suggestions
  TestSuggestion,

  // Full Analysis
  FullAnalysisResult,
} from "./types";

// ─── CRO Engine ─────────────────────────────────────────────────────────────

import { IntegrationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getIntegrationClient,
  type GA4Client,
  type SearchConsoleClient,
  type ClarityClient,
  type ShopifyClient,
} from "@/lib/integrations";

import { generateHypotheses, generateTestVariant } from "./claude-client";
import {
  analyzeGA4Data,
  analyzeSearchConsoleData,
  analyzeClarityData,
  crossPlatformAnalysis,
} from "./gemini-client";
import {
  detectFrictionSignals,
  rankByImpact,
  generateTestSuggestions,
} from "./friction-detector";

import type {
  FullAnalysisResult,
  TestSuggestion,
  Hypothesis,
  BrandContext,
  VariantChanges,
  StoreMetrics,
  GA4AnalysisInput,
  SearchConsoleInput,
  ClarityInput,
  DataInsights,
  SearchInsights,
  BehaviorInsights,
  UnifiedInsights,
  DateRange,
  FrictionSignalDetected,
} from "./types";

/**
 * CROEngine orchestrates both AI models (Claude + Gemini) to provide
 * end-to-end conversion rate optimization analysis and test generation.
 *
 * Usage:
 *   const engine = new CROEngine();
 *   const analysis = await engine.runFullAnalysis("store-id-123");
 *   const topTests = await engine.suggestNextTests("store-id-123", 5);
 */
export class CROEngine {
  // ── Full Analysis Pipeline ────────────────────────────────────────────

  /**
   * Run a complete analysis pipeline:
   * 1. Fetch all data from connected integrations
   * 2. Run Gemini analysis on each data source
   * 3. Run cross-platform synthesis
   * 4. Detect friction signals (rule-based + AI)
   * 5. Generate Claude hypotheses for top friction signals
   * 6. Produce ranked test suggestions with revenue projections
   */
  async runFullAnalysis(storeId: string): Promise<FullAnalysisResult> {
    const dateRange = this.defaultDateRange();

    // Step 1: Gather store context and integrations (storeId is orgId)
    const store = await prisma.organization.findUnique({
      where: { id: storeId },
      include: { integrations: { where: { enabled: true } } },
    });

    if (!store) {
      throw new Error(`Organization not found: ${storeId}`);
    }

    const storeMetrics = await this.buildStoreMetrics(storeId, dateRange);

    // Step 2: Fetch and analyze each data source in parallel
    const [ga4Analysis, searchAnalysis, clarityAnalysis] = await Promise.all([
      this.analyzeGA4(storeId, dateRange).catch((e) => {
        console.warn("GA4 analysis skipped:", e);
        return null;
      }),
      this.analyzeSearchConsole(storeId, dateRange).catch((e) => {
        console.warn("Search Console analysis skipped:", e);
        return null;
      }),
      this.analyzeClarity(storeId, dateRange).catch((e) => {
        console.warn("Clarity analysis skipped:", e);
        return null;
      }),
    ]);

    // Step 3: Cross-platform synthesis
    const unifiedInsights = await crossPlatformAnalysis({
      ga4Data: ga4Analysis?.input,
      searchConsoleData: searchAnalysis?.input,
      clarityData: clarityAnalysis?.input,
      storeMetrics,
      dateRange,
    });

    // Step 4: Detect friction signals
    const frictionSignals = await detectFrictionSignals(storeId);
    const rankedSignals = rankByImpact(frictionSignals, storeMetrics);

    // Step 5: Generate hypotheses for top friction signals
    const topSignals = rankedSignals.slice(0, 10);
    const testSuggestions = await generateTestSuggestions(
      topSignals,
      storeMetrics
    );

    // Collect all hypotheses from test suggestions
    const hypotheses = testSuggestions.map((s) => s.hypothesis);

    return {
      storeId,
      analyzedAt: new Date().toISOString(),
      dataInsights: ga4Analysis?.insights ?? {
        summary: "GA4 data not available",
        patterns: [],
        anomalies: [],
      },
      searchInsights: searchAnalysis?.insights,
      behaviorInsights: clarityAnalysis?.insights,
      unifiedInsights,
      frictionSignals: rankedSignals,
      hypotheses,
      testSuggestions,
    };
  }

  // ── Top Test Suggestions ──────────────────────────────────────────────

  /**
   * Return the top N test suggestions ranked by projected revenue impact.
   * This is a lighter-weight call than runFullAnalysis — it reuses cached
   * friction signals if available.
   */
  async suggestNextTests(
    storeId: string,
    count: number = 5
  ): Promise<TestSuggestion[]> {
    const dateRange = this.defaultDateRange();
    const storeMetrics = await this.buildStoreMetrics(storeId, dateRange);

    // Detect or refresh friction signals
    const signals = await detectFrictionSignals(storeId);
    const ranked = rankByImpact(signals, storeMetrics);

    // Generate suggestions for the top signals
    const suggestions = await generateTestSuggestions(
      ranked.slice(0, Math.max(count, 5)),
      storeMetrics
    );

    return suggestions.slice(0, count);
  }

  // ── Automatic Test Builder ────────────────────────────────────────────

  /**
   * Given a hypothesis, fetch the target page HTML, build brand context,
   * and have Claude generate the actual DOM changes for the variant.
   */
  async buildTestAutomatically(
    hypothesis: Hypothesis,
    storeId: string
  ): Promise<VariantChanges> {
    // Fetch brand context
    const store = await prisma.organization.findUnique({
      where: { id: storeId },
      include: { integrations: { where: { enabled: true } } },
    });

    if (!store) {
      throw new Error(`Organization not found: ${storeId}`);
    }

    const shopifyIntegration = store.integrations.find(
      (i) => i.type === IntegrationType.SHOPIFY
    );
    const shopMeta = shopifyIntegration?.metadata as {
      shop?: string;
      storeName?: string;
      industry?: string;
    } | null;

    const brandContext: BrandContext = {
      storeName: shopMeta?.storeName ?? store.name ?? "Store",
      storeUrl: shopMeta?.shop
        ? `https://${shopMeta.shop}`
        : "https://example.com",
      industry: shopMeta?.industry ?? "e-commerce",
      averageOrderValue: 50, // Default; ideally computed from order data
    };

    // Try to compute real AOV from Shopify data
    if (shopifyIntegration) {
      try {
        const shopifyClient = (await getIntegrationClient(
          IntegrationType.SHOPIFY,
          storeId
        )) as ShopifyClient;

        const dateRange = this.defaultDateRange();
        const orders = await shopifyClient.getOrders({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });

        if (orders.length > 0) {
          const totalRevenue = orders.reduce(
            (sum, o) => sum + parseFloat(String(o.totalPrice ?? 0)),
            0
          );
          brandContext.averageOrderValue = totalRevenue / orders.length;
        }
      } catch {
        // Use default AOV
      }
    }

    // Fetch page HTML
    const targetUrl = hypothesis.targetSelector
      ? brandContext.storeUrl
      : brandContext.storeUrl;

    let pageHtml = "";
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CROPlatformBot/1.0; +https://croplatform.com/bot)",
        },
      });
      pageHtml = await response.text();
    } catch {
      pageHtml = "<html><body><!-- Page HTML could not be fetched --></body></html>";
    }

    return generateTestVariant(hypothesis, pageHtml, brandContext);
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private defaultDateRange(): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }

  private async buildStoreMetrics(
    storeId: string,
    dateRange: DateRange
  ): Promise<StoreMetrics> {
    const defaults: StoreMetrics = {
      storeId,
      totalSessions: 0,
      totalRevenue: 0,
      totalOrders: 0,
      conversionRate: 0,
      averageOrderValue: 0,
    };

    try {
      const store = await prisma.organization.findUnique({
        where: { id: storeId },
        include: { integrations: { where: { enabled: true } } },
      });

      if (!store) return defaults;

      // Try to get session data from GA4
      const hasGA4 = store.integrations.some(
        (i) => i.type === IntegrationType.GA4
      );
      if (hasGA4) {
        try {
          const ga4Client = (await getIntegrationClient(
            IntegrationType.GA4,
            storeId
          )) as GA4Client;

          const meta = store.integrations.find(
            (i) => i.type === IntegrationType.GA4
          )?.metadata as { propertyId?: string } | null;
          const propertyId = meta?.propertyId ?? "";

          const devices = await ga4Client.getDeviceBreakdown(
            propertyId,
            dateRange
          );
          defaults.totalSessions = devices.reduce(
            (sum, d) => sum + d.sessions,
            0
          );
        } catch {
          // Skip GA4 metrics
        }
      }

      // Try to get order data from Shopify
      const hasShopify = store.integrations.some(
        (i) => i.type === IntegrationType.SHOPIFY
      );
      if (hasShopify) {
        try {
          const shopifyClient = (await getIntegrationClient(
            IntegrationType.SHOPIFY,
            storeId
          )) as ShopifyClient;

          const orders = await shopifyClient.getOrders({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          });

          defaults.totalOrders = orders.length;
          defaults.totalRevenue = orders.reduce(
            (sum, o) => sum + parseFloat(String(o.totalPrice ?? 0)),
            0
          );
          defaults.averageOrderValue =
            defaults.totalOrders > 0
              ? defaults.totalRevenue / defaults.totalOrders
              : 0;
          defaults.conversionRate =
            defaults.totalSessions > 0
              ? defaults.totalOrders / defaults.totalSessions
              : 0;
        } catch {
          // Skip Shopify metrics
        }
      }
    } catch {
      // Return defaults if anything fails
    }

    return defaults;
  }

  private async analyzeGA4(
    storeId: string,
    dateRange: DateRange
  ): Promise<{ input: GA4AnalysisInput; insights: DataInsights } | null> {
    const ga4Client = (await getIntegrationClient(
      IntegrationType.GA4,
      storeId
    )) as GA4Client;

    const store = await prisma.organization.findUnique({
      where: { id: storeId },
      include: { integrations: { where: { enabled: true } } },
    });

    const meta = store?.integrations.find(
      (i) => i.type === IntegrationType.GA4
    )?.metadata as { propertyId?: string } | null;
    const propertyId = meta?.propertyId ?? "";

    const [funnelData, pageMetrics, deviceBreakdown, trafficSources, conversionEvents] =
      await Promise.all([
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
        ga4Client.getPageMetrics(propertyId, dateRange),
        ga4Client.getDeviceBreakdown(propertyId, dateRange),
        ga4Client.getTrafficSources(propertyId, dateRange),
        ga4Client.getConversionEvents(propertyId, dateRange),
      ]);

    const input: GA4AnalysisInput = {
      funnelData,
      pageMetrics,
      deviceBreakdown,
      trafficSources,
      conversionEvents,
      dateRange,
    };

    const insights = await analyzeGA4Data(input);
    return { input, insights };
  }

  private async analyzeSearchConsole(
    storeId: string,
    dateRange: DateRange
  ): Promise<{ input: SearchConsoleInput; insights: SearchInsights } | null> {
    const scClient = (await getIntegrationClient(
      IntegrationType.SEARCH_CONSOLE,
      storeId
    )) as SearchConsoleClient;

    const store = await prisma.organization.findUnique({
      where: { id: storeId },
      include: { integrations: { where: { enabled: true } } },
    });

    const meta = store?.integrations.find(
      (i) => i.type === IntegrationType.SEARCH_CONSOLE
    )?.metadata as { siteUrl?: string } | null;
    const siteUrl = meta?.siteUrl ?? "";

    const [searchQueries, pagePerformance] = await Promise.all([
      scClient.getSearchQueries(siteUrl, dateRange),
      scClient.getPagePerformance(siteUrl, dateRange),
    ]);

    const input: SearchConsoleInput = {
      searchQueries,
      pagePerformance,
      dateRange,
      storeUrl: siteUrl,
    };

    const insights = await analyzeSearchConsoleData(input);
    return { input, insights };
  }

  private async analyzeClarity(
    storeId: string,
    dateRange: DateRange
  ): Promise<{ input: ClarityInput; insights: BehaviorInsights } | null> {
    const clarityClient = (await getIntegrationClient(
      IntegrationType.CLARITY,
      storeId
    )) as ClarityClient;

    const [smartEvents, dashboardMetrics] = await Promise.all([
      clarityClient.getSmartEvents(dateRange),
      clarityClient.getDashboardMetrics(dateRange),
    ]);

    const input: ClarityInput = {
      smartEvents,
      dashboardMetrics,
      dateRange,
    };

    const insights = await analyzeClarityData(input);
    return { input, insights };
  }
}
