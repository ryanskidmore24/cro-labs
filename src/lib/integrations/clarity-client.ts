import { z } from "zod";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface HeatmapClick {
  x: number;
  y: number;
  count: number;
  selector?: string;
}

export interface ScrollDepthBucket {
  depthPercent: number;
  usersReached: number;
  percentageOfTotal: number;
}

export interface HeatmapData {
  pageUrl: string;
  clicks: HeatmapClick[];
  scrollDepth: ScrollDepthBucket[];
  totalSessions: number;
}

export interface SessionRecordingFilter {
  pageUrl?: string;
  hasRageClicks?: boolean;
  hasDeadClicks?: boolean;
  hasErrors?: boolean;
  device?: "mobile" | "desktop" | "tablet";
  minDuration?: number;
  maxDuration?: number;
}

export interface SessionRecording {
  sessionId: string;
  startTime: string;
  duration: number;
  pagesViewed: number;
  device: string;
  country: string;
  hasRageClicks: boolean;
  hasDeadClicks: boolean;
  hasErrors: boolean;
  playbackUrl: string;
}

export interface SmartEvent {
  eventType: "rage_click" | "dead_click" | "excessive_scroll" | "quick_back" | "error_click";
  pageUrl: string;
  selector?: string;
  count: number;
  affectedSessions: number;
  firstSeen: string;
  lastSeen: string;
}

export interface DashboardMetrics {
  totalSessions: number;
  totalPageViews: number;
  distinctUsers: number;
  avgSessionDuration: number;
  bounceRate: number;
  scrollDepthAvg: number;
  rageClicks: number;
  deadClicks: number;
  excessiveScrolls: number;
  quickBacks: number;
  errorClicks: number;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const HeatmapClickSchema = z.object({
  x: z.number(),
  y: z.number(),
  count: z.number(),
  selector: z.string().optional(),
});

const ScrollDepthBucketSchema = z.object({
  depthPercent: z.number(),
  usersReached: z.number(),
  percentageOfTotal: z.number(),
});

const HeatmapResponseSchema = z.object({
  pageUrl: z.string(),
  clicks: z.array(HeatmapClickSchema),
  scrollDepth: z.array(ScrollDepthBucketSchema),
  totalSessions: z.number(),
});

const SessionRecordingSchema = z.object({
  sessionId: z.string(),
  startTime: z.string(),
  duration: z.number(),
  pagesViewed: z.number(),
  device: z.string(),
  country: z.string(),
  hasRageClicks: z.boolean(),
  hasDeadClicks: z.boolean(),
  hasErrors: z.boolean(),
  playbackUrl: z.string(),
});

const SessionRecordingsResponseSchema = z.object({
  recordings: z.array(SessionRecordingSchema),
  totalCount: z.number(),
});

const SmartEventSchema = z.object({
  eventType: z.enum([
    "rage_click",
    "dead_click",
    "excessive_scroll",
    "quick_back",
    "error_click",
  ]),
  pageUrl: z.string(),
  selector: z.string().optional(),
  count: z.number(),
  affectedSessions: z.number(),
  firstSeen: z.string(),
  lastSeen: z.string(),
});

const SmartEventsResponseSchema = z.object({
  events: z.array(SmartEventSchema),
});

const DashboardMetricsSchema = z.object({
  totalSessions: z.number(),
  totalPageViews: z.number(),
  distinctUsers: z.number(),
  avgSessionDuration: z.number(),
  bounceRate: z.number(),
  scrollDepthAvg: z.number(),
  rageClicks: z.number(),
  deadClicks: z.number(),
  excessiveScrolls: z.number(),
  quickBacks: z.number(),
  errorClicks: z.number(),
});

// ─── Internal Helpers ───────────────────────────────────────────────────────

const CLARITY_API_BASE = "https://www.clarity.ms/api/v1";

interface ClarityRequestOptions {
  projectId: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  method?: "GET" | "POST";
}

async function clarityRequest<T>(
  options: ClarityRequestOptions,
  schema: z.ZodType<T>
): Promise<T> {
  const apiKey = process.env.CLARITY_API_KEY;
  if (!apiKey) {
    throw new Error("CLARITY_API_KEY environment variable is not set");
  }

  const url = new URL(
    `${CLARITY_API_BASE}/projects/${options.projectId}${options.path}`
  );

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Clarity API error ${res.status}: ${errorText}`
    );
  }

  const data = await res.json();
  return schema.parse(data);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Retrieve click heatmap and scroll depth data for a specific page.
 */
export async function getHeatmapData(
  projectId: string,
  pageUrl: string,
  dateRange: DateRange
): Promise<HeatmapData> {
  return clarityRequest(
    {
      projectId,
      path: "/heatmaps",
      params: {
        url: pageUrl,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    },
    HeatmapResponseSchema
  );
}

/**
 * List session recordings matching optional filters.
 */
export async function getSessionRecordings(
  projectId: string,
  filters?: SessionRecordingFilter
): Promise<{ recordings: SessionRecording[]; totalCount: number }> {
  const params: Record<string, string> = {};

  if (filters?.pageUrl) params.url = filters.pageUrl;
  if (filters?.hasRageClicks !== undefined)
    params.rageClicks = String(filters.hasRageClicks);
  if (filters?.hasDeadClicks !== undefined)
    params.deadClicks = String(filters.hasDeadClicks);
  if (filters?.hasErrors !== undefined)
    params.errors = String(filters.hasErrors);
  if (filters?.device) params.device = filters.device;
  if (filters?.minDuration !== undefined)
    params.minDuration = String(filters.minDuration);
  if (filters?.maxDuration !== undefined)
    params.maxDuration = String(filters.maxDuration);

  return clarityRequest(
    { projectId, path: "/recordings", params },
    SessionRecordingsResponseSchema
  );
}

/**
 * Fetch Clarity's auto-detected smart events (rage clicks, dead clicks, etc.)
 */
export async function getSmartEvents(
  projectId: string,
  dateRange: DateRange
): Promise<SmartEvent[]> {
  const result = await clarityRequest(
    {
      projectId,
      path: "/smart-events",
      params: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    },
    SmartEventsResponseSchema
  );

  return result.events;
}

/**
 * Overview dashboard metrics for a project.
 */
export async function getDashboardMetrics(
  projectId: string,
  dateRange: DateRange
): Promise<DashboardMetrics> {
  return clarityRequest(
    {
      projectId,
      path: "/dashboard",
      params: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    },
    DashboardMetricsSchema
  );
}
