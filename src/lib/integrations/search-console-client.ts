import { google, webmasters_v3 } from "googleapis";
import { z } from "zod";
import { getAuthenticatedClient } from "./google-auth";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface SearchQueryFilter {
  dimension: "query" | "page" | "country" | "device";
  operator?: "equals" | "contains" | "notContains";
  expression: string;
}

export interface SearchQueryRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export interface PagePerformanceRow {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export interface QueryTrendPoint {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

// ─── Zod Validation ─────────────────────────────────────────────────────────

const SearchAnalyticsRowSchema = z.object({
  keys: z.array(z.string()).optional(),
  clicks: z.number().optional(),
  impressions: z.number().optional(),
  ctr: z.number().optional(),
  position: z.number().optional(),
});

const SearchAnalyticsResponseSchema = z.object({
  rows: z.array(SearchAnalyticsRowSchema).optional(),
  responseAggregationType: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSearchConsoleClient(accessToken: string) {
  const auth = getAuthenticatedClient(accessToken);
  return google.searchconsole({ version: "v1", auth });
}

function buildDimensionFilterGroups(
  filters?: SearchQueryFilter[]
): webmasters_v3.Schema$ApiDimensionFilterGroup[] | undefined {
  if (!filters || filters.length === 0) return undefined;

  return [
    {
      filters: filters.map((f) => ({
        dimension: f.dimension,
        operator: f.operator ?? "equals",
        expression: f.expression,
      })),
    },
  ];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch search query performance data: impressions, clicks, CTR, position.
 */
export async function getSearchQueries(
  siteUrl: string,
  dateRange: DateRange,
  accessToken: string,
  filters?: SearchQueryFilter[]
): Promise<SearchQueryRow[]> {
  const client = getSearchConsoleClient(accessToken);

  const res = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ["query"],
      dimensionFilterGroups: buildDimensionFilterGroups(filters) as
        | undefined
        | Array<{ filters?: Array<{ dimension?: string; operator?: string; expression?: string }> }>,
      rowLimit: 1000,
      startRow: 0,
    },
  });

  const parsed = SearchAnalyticsResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/**
 * Retrieve per-page search performance (impressions, clicks, CTR, position).
 */
export async function getPagePerformance(
  siteUrl: string,
  dateRange: DateRange,
  accessToken: string
): Promise<PagePerformanceRow[]> {
  const client = getSearchConsoleClient(accessToken);

  const res = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ["page"],
      rowLimit: 1000,
      startRow: 0,
    },
  });

  const parsed = SearchAnalyticsResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => ({
    page: row.keys?.[0] ?? "",
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/**
 * Get a day-by-day time series for a specific search query.
 */
export async function getQueryTrends(
  siteUrl: string,
  query: string,
  dateRange: DateRange,
  accessToken: string
): Promise<QueryTrendPoint[]> {
  const client = getSearchConsoleClient(accessToken);

  const res = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      dimensions: ["date"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "query",
              operator: "equals",
              expression: query,
            },
          ],
        },
      ] as Array<{ filters?: Array<{ dimension?: string; operator?: string; expression?: string }> }>,
      rowLimit: 1000,
      startRow: 0,
    },
  });

  const parsed = SearchAnalyticsResponseSchema.parse(res.data);

  return (parsed.rows ?? []).map((row) => ({
    date: row.keys?.[0] ?? "",
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}
