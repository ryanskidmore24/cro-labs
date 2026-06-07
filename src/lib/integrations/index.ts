// ─── Re-exports ─────────────────────────────────────────────────────────────

export {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  getAuthenticatedClient,
  type GoogleScopeKey,
  type GoogleTokens,
} from "./google-auth";

export {
  getFunnelData,
  getPageMetrics,
  getUserFlowData,
  getTrafficSources,
  getDeviceBreakdown,
  getConversionEvents,
  type FunnelStep,
  type FunnelStepResult,
  type PageMetric,
  type UserFlowPath,
  type TrafficSource,
  type DeviceMetric,
  type ConversionEvent,
  type DateRange,
} from "./ga4-client";

export {
  getSearchQueries,
  getPagePerformance,
  getQueryTrends,
  type SearchQueryFilter,
  type SearchQueryRow,
  type PagePerformanceRow,
  type QueryTrendPoint,
} from "./search-console-client";

export {
  getHeatmapData,
  getSessionRecordings,
  getSmartEvents,
  getDashboardMetrics,
  type HeatmapData,
  type HeatmapClick,
  type ScrollDepthBucket,
  type SessionRecording,
  type SessionRecordingFilter,
  type SmartEvent,
  type DashboardMetrics,
} from "./clarity-client";

export {
  getOrders,
  getOrderById,
  getProducts,
  getCustomers,
  matchOrdersToVariant,
  type ShopifyOrder,
  type ShopifyLineItem,
  type ShopifyProduct,
  type ShopifyCustomer,
  type TestExposureEvent,
  type AttributedOrder,
  type OrderListParams,
  type CustomerListParams,
} from "./shopify-client";

// ─── Integration Client Helper ─────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { IntegrationType } from "@prisma/client";
import { refreshGoogleToken } from "./google-auth";

import * as ga4 from "./ga4-client";
import * as searchConsole from "./search-console-client";
import * as clarity from "./clarity-client";
import * as shopify from "./shopify-client";

export interface GA4Client {
  type: "GA4";
  accessToken: string;
  getFunnelData: (
    propertyId: string,
    funnelSteps: ga4.FunnelStep[],
    dateRange: ga4.DateRange
  ) => Promise<ga4.FunnelStepResult[]>;
  getPageMetrics: (
    propertyId: string,
    dateRange: ga4.DateRange,
    dimensions?: string[]
  ) => Promise<ga4.PageMetric[]>;
  getUserFlowData: (
    propertyId: string,
    dateRange: ga4.DateRange
  ) => Promise<ga4.UserFlowPath[]>;
  getTrafficSources: (
    propertyId: string,
    dateRange: ga4.DateRange
  ) => Promise<ga4.TrafficSource[]>;
  getDeviceBreakdown: (
    propertyId: string,
    dateRange: ga4.DateRange
  ) => Promise<ga4.DeviceMetric[]>;
  getConversionEvents: (
    propertyId: string,
    dateRange: ga4.DateRange
  ) => Promise<ga4.ConversionEvent[]>;
}

export interface SearchConsoleClient {
  type: "SEARCH_CONSOLE";
  accessToken: string;
  getSearchQueries: (
    siteUrl: string,
    dateRange: searchConsole.DateRange,
    filters?: searchConsole.SearchQueryFilter[]
  ) => Promise<searchConsole.SearchQueryRow[]>;
  getPagePerformance: (
    siteUrl: string,
    dateRange: searchConsole.DateRange
  ) => Promise<searchConsole.PagePerformanceRow[]>;
  getQueryTrends: (
    siteUrl: string,
    query: string,
    dateRange: searchConsole.DateRange
  ) => Promise<searchConsole.QueryTrendPoint[]>;
}

export interface ClarityClient {
  type: "CLARITY";
  projectId: string;
  getHeatmapData: (
    pageUrl: string,
    dateRange: clarity.DateRange
  ) => Promise<clarity.HeatmapData>;
  getSessionRecordings: (
    filters?: clarity.SessionRecordingFilter
  ) => Promise<{ recordings: clarity.SessionRecording[]; totalCount: number }>;
  getSmartEvents: (
    dateRange: clarity.DateRange
  ) => Promise<clarity.SmartEvent[]>;
  getDashboardMetrics: (
    dateRange: clarity.DateRange
  ) => Promise<clarity.DashboardMetrics>;
}

export interface ShopifyClient {
  type: "SHOPIFY";
  shop: string;
  accessToken: string;
  getOrders: (
    dateRange: shopify.DateRange,
    params?: shopify.OrderListParams
  ) => Promise<shopify.ShopifyOrder[]>;
  getOrderById: (orderId: number) => Promise<shopify.ShopifyOrder>;
  getProducts: () => Promise<shopify.ShopifyProduct[]>;
  getCustomers: (
    params?: shopify.CustomerListParams
  ) => Promise<shopify.ShopifyCustomer[]>;
  matchOrdersToVariant: (
    orders: shopify.ShopifyOrder[],
    testExposures: shopify.TestExposureEvent[]
  ) => shopify.AttributedOrder[];
}

export type IntegrationClient =
  | GA4Client
  | SearchConsoleClient
  | ClarityClient
  | ShopifyClient;

/**
 * Fetch stored credentials for a user's integration and return
 * a configured client with bound access tokens.
 *
 * For Google integrations, automatically refreshes expired tokens.
 */
export async function getIntegrationClient(
  type: IntegrationType,
  orgId: string
): Promise<IntegrationClient> {
  const integration = await prisma.integration.findFirst({
    where: { organizationId: orgId, type, enabled: true },
  });

  if (!integration) {
    throw new Error(
      `No ${type} integration found for org ${orgId}. Please connect the integration first.`
    );
  }

  let { accessToken } = integration;

  // Auto-refresh Google tokens if expired
  if (
    (type === IntegrationType.GA4 || type === IntegrationType.SEARCH_CONSOLE) &&
    integration.refreshToken &&
    integration.expiresAt &&
    integration.expiresAt <= new Date()
  ) {
    const refreshed = await refreshGoogleToken(integration.refreshToken);
    accessToken = refreshed.accessToken;

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? integration.refreshToken,
        expiresAt: refreshed.expiresAt,
      },
    });
  }

  switch (type) {
    case IntegrationType.GA4:
      return {
        type: "GA4",
        accessToken,
        getFunnelData: (propertyId, funnelSteps, dateRange) =>
          ga4.getFunnelData(propertyId, funnelSteps, dateRange, accessToken),
        getPageMetrics: (propertyId, dateRange, dimensions) =>
          ga4.getPageMetrics(propertyId, dateRange, accessToken, dimensions),
        getUserFlowData: (propertyId, dateRange) =>
          ga4.getUserFlowData(propertyId, dateRange, accessToken),
        getTrafficSources: (propertyId, dateRange) =>
          ga4.getTrafficSources(propertyId, dateRange, accessToken),
        getDeviceBreakdown: (propertyId, dateRange) =>
          ga4.getDeviceBreakdown(propertyId, dateRange, accessToken),
        getConversionEvents: (propertyId, dateRange) =>
          ga4.getConversionEvents(propertyId, dateRange, accessToken),
      };

    case IntegrationType.SEARCH_CONSOLE:
      return {
        type: "SEARCH_CONSOLE",
        accessToken,
        getSearchQueries: (siteUrl, dateRange, filters) =>
          searchConsole.getSearchQueries(siteUrl, dateRange, accessToken, filters),
        getPagePerformance: (siteUrl, dateRange) =>
          searchConsole.getPagePerformance(siteUrl, dateRange, accessToken),
        getQueryTrends: (siteUrl, query, dateRange) =>
          searchConsole.getQueryTrends(siteUrl, query, dateRange, accessToken),
      };

    case IntegrationType.CLARITY: {
      const metadata = integration.metadata as { projectId?: string } | null;
      const projectId = metadata?.projectId;
      if (!projectId) {
        throw new Error(
          "Clarity integration is missing projectId in metadata. Please reconfigure."
        );
      }
      return {
        type: "CLARITY",
        projectId,
        getHeatmapData: (pageUrl, dateRange) =>
          clarity.getHeatmapData(projectId, pageUrl, dateRange),
        getSessionRecordings: (filters) =>
          clarity.getSessionRecordings(projectId, filters),
        getSmartEvents: (dateRange) =>
          clarity.getSmartEvents(projectId, dateRange),
        getDashboardMetrics: (dateRange) =>
          clarity.getDashboardMetrics(projectId, dateRange),
      };
    }

    case IntegrationType.SHOPIFY: {
      const meta = integration.metadata as { shop?: string } | null;
      const shop = meta?.shop;
      if (!shop) {
        throw new Error(
          "Shopify integration is missing shop in metadata. Please reconfigure."
        );
      }
      return {
        type: "SHOPIFY",
        shop,
        accessToken,
        getOrders: (dateRange, params) =>
          shopify.getOrders(shop, accessToken, dateRange, params),
        getOrderById: (orderId) =>
          shopify.getOrderById(shop, accessToken, orderId),
        getProducts: () => shopify.getProducts(shop, accessToken),
        getCustomers: (params) =>
          shopify.getCustomers(shop, accessToken, params),
        matchOrdersToVariant: shopify.matchOrdersToVariant,
      };
    }

    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown integration type: ${_exhaustive}`);
    }
  }
}
