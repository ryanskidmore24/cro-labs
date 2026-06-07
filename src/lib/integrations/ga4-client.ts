import { google } from "googleapis";
import { z } from "zod";
import { getAuthenticatedClient } from "./google-auth";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface FunnelStep {
  name: string;
  /** GA4 event name (e.g. "page_view", "add_to_cart", "purchase") */
  eventName: string;
  /** Optional filter expression for the step */
  filterExpression?: string;
}

export interface FunnelStepResult {
  stepName: string;
  eventName: string;
  activeUsers: number;
  conversionRate: number; // relative to first step
  dropoffRate: number;    // relative to previous step
}

export interface PageMetric {
  pagePath: string;
  pageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
  uniqueUsers: number;
  [dimension: string]: string | number;
}

export interface UserFlowPath {
  pagePath: string;
  previousPagePath: string;
  sessions: number;
  percentage: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  conversions: number;
  bounceRate: number;
}

export interface DeviceMetric {
  deviceCategory: string;
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
  conversionRate: number;
}

export interface ConversionEvent {
  eventName: string;
  eventCount: number;
  totalRevenue: number;
  uniqueUsers: number;
}

// ─── Zod Schemas for API Response Validation ────────────────────────────────

const GA4RowSchema = z.object({
  dimensionValues: z.array(z.object({ value: z.string().optional() })).optional(),
  metricValues: z.array(z.object({ value: z.string().optional() })).optional(),
});

const GA4ReportResponseSchema = z.object({
  rows: z.array(GA4RowSchema).optional(),
  rowCount: z.number().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAnalyticsDataClient(accessToken: string) {
  const auth = getAuthenticatedClient(accessToken);
  return google.analyticsdata({ version: "v1beta", auth });
}

function dimVal(row: z.infer<typeof GA4RowSchema>, index: number): string {
  return row.dimensionValues?.[index]?.value ?? "";
}

function metricVal(row: z.infer<typeof GA4RowSchema>, index: number): number {
  return parseFloat(row.metricValues?.[index]?.value ?? "0");
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Simulate funnel analysis by running one report per step and comparing
 * active-user counts sequentially.
 */
export async function getFunnelData(
  propertyId: string,
  funnelSteps: FunnelStep[],
  dateRange: DateRange,
  accessToken: string
): Promise<FunnelStepResult[]> {
  const client = getAnalyticsDataClient(accessToken);
  const results: FunnelStepResult[] = [];
  let firstStepUsers = 0;
  let prevStepUsers = 0;

  for (let i = 0; i < funnelSteps.length; i++) {
    const step = funnelSteps[i];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (client.properties as any).runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
        metrics: [{ name: "activeUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: { matchType: "EXACT", value: step.eventName },
          },
        },
      },
    });

    const parsed = GA4ReportResponseSchema.parse(res.data);
    const activeUsers = parsed.rows?.[0]
      ? metricVal(parsed.rows[0], 0)
      : 0;

    if (i === 0) firstStepUsers = activeUsers;

    results.push({
      stepName: step.name,
      eventName: step.eventName,
      activeUsers,
      conversionRate: firstStepUsers > 0 ? activeUsers / firstStepUsers : 0,
      dropoffRate:
        i === 0
          ? 0
          : prevStepUsers > 0
            ? 1 - activeUsers / prevStepUsers
            : 0,
    });

    prevStepUsers = activeUsers;
  }

  return results;
}

/**
 * Retrieve per-page metrics: page views, bounce rate, average session
 * duration, and unique users.
 */
export async function getPageMetrics(
  propertyId: string,
  dateRange: DateRange,
  accessToken: string,
  dimensions?: string[]
): Promise<PageMetric[]> {
  const client = getAnalyticsDataClient(accessToken);

  const dims = [
    { name: "pagePath" },
    ...(dimensions ?? []).map((d) => ({ name: d })),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (client.properties as any).runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: dims,
      metrics: [
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "activeUsers" },
      ],
      limit: 1000,
    },
  });

  const parsed = GA4ReportResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => {
    const base: PageMetric = {
      pagePath: dimVal(row, 0),
      pageViews: metricVal(row, 0),
      bounceRate: metricVal(row, 1),
      avgSessionDuration: metricVal(row, 2),
      uniqueUsers: metricVal(row, 3),
    };

    // Attach any extra dimensions requested
    (dimensions ?? []).forEach((d, idx) => {
      base[d] = dimVal(row, idx + 1);
    });

    return base;
  });
}

/**
 * Retrieve user navigation flow between pages (previous page -> current page).
 */
export async function getUserFlowData(
  propertyId: string,
  dateRange: DateRange,
  accessToken: string
): Promise<UserFlowPath[]> {
  const client = getAnalyticsDataClient(accessToken);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (client.properties as any).runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [
        { name: "pagePath" },
        { name: "pageReferrer" },
      ],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 500,
    },
  });

  const parsed = GA4ReportResponseSchema.parse(res.data);
  const rows = parsed.rows ?? [];
  const totalSessions = rows.reduce((sum, r) => sum + metricVal(r, 0), 0);

  return rows.map((row) => ({
    pagePath: dimVal(row, 0),
    previousPagePath: dimVal(row, 1),
    sessions: metricVal(row, 0),
    percentage: totalSessions > 0 ? metricVal(row, 0) / totalSessions : 0,
  }));
}

/**
 * Break down traffic by source and medium.
 */
export async function getTrafficSources(
  propertyId: string,
  dateRange: DateRange,
  accessToken: string
): Promise<TrafficSource[]> {
  const client = getAnalyticsDataClient(accessToken);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (client.properties as any).runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "conversions" },
        { name: "bounceRate" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 200,
    },
  });

  const parsed = GA4ReportResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => ({
    source: dimVal(row, 0),
    medium: dimVal(row, 1),
    sessions: metricVal(row, 0),
    users: metricVal(row, 1),
    conversions: metricVal(row, 2),
    bounceRate: metricVal(row, 3),
  }));
}

/**
 * Device category breakdown (mobile / desktop / tablet).
 */
export async function getDeviceBreakdown(
  propertyId: string,
  dateRange: DateRange,
  accessToken: string
): Promise<DeviceMetric[]> {
  const client = getAnalyticsDataClient(accessToken);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (client.properties as any).runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "conversions" },
      ],
    },
  });

  const parsed = GA4ReportResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => {
    const sessions = metricVal(row, 0);
    const conversions = metricVal(row, 4);
    return {
      deviceCategory: dimVal(row, 0),
      sessions,
      users: metricVal(row, 1),
      bounceRate: metricVal(row, 2),
      avgSessionDuration: metricVal(row, 3),
      conversions,
      conversionRate: sessions > 0 ? conversions / sessions : 0,
    };
  });
}

/**
 * Retrieve e-commerce conversion events with revenue totals.
 */
export async function getConversionEvents(
  propertyId: string,
  dateRange: DateRange,
  accessToken: string
): Promise<ConversionEvent[]> {
  const client = getAnalyticsDataClient(accessToken);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (client.properties as any).runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [
        { name: "eventCount" },
        { name: "eventValue" },
        { name: "activeUsers" },
      ],
      dimensionFilter: {
        filter: {
          fieldName: "isConversionEvent",
          stringFilter: { matchType: "EXACT", value: "true" },
        },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    },
  });

  const parsed = GA4ReportResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => ({
    eventName: dimVal(row, 0),
    eventCount: metricVal(row, 0),
    totalRevenue: metricVal(row, 1),
    uniqueUsers: metricVal(row, 2),
  }));
}
