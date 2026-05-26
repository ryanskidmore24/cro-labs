import { z } from "zod";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ShopifyLineItem {
  id: number;
  productId: number;
  variantId: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
}

export interface ShopifyOrder {
  id: number;
  name: string; // e.g. "#1001"
  email: string;
  createdAt: string;
  totalPrice: string;
  subtotalPrice: string;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  lineItems: ShopifyLineItem[];
  customerId: number | null;
  landingPage: string | null;
  referringSite: string | null;
  tags: string;
  note: string | null;
  browserIp: string | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  status: string;
  productType: string;
  variants: {
    id: number;
    title: string;
    price: string;
    sku: string;
    inventoryQuantity: number;
  }[];
  images: { id: number; src: string }[];
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  ordersCount: number;
  totalSpent: string;
  createdAt: string;
  tags: string;
}

export interface OrderListParams {
  limit?: number;
  sinceId?: number;
  status?: "open" | "closed" | "cancelled" | "any";
  financialStatus?: string;
  fulfillmentStatus?: string;
  fields?: string;
}

export interface CustomerListParams {
  limit?: number;
  sinceId?: number;
  fields?: string;
}

/** A test exposure event used for order attribution */
export interface TestExposureEvent {
  visitorId: string;
  sessionId: string;
  variantId: string;
  testId: string;
  timestamp: string;
  pageUrl?: string;
  browserIp?: string;
  email?: string;
}

export interface AttributedOrder {
  order: ShopifyOrder;
  matchedExposure: TestExposureEvent;
  matchType: "email" | "ip" | "session";
  confidence: "high" | "medium" | "low";
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const LineItemSchema = z.object({
  id: z.number(),
  product_id: z.number().nullable().optional(),
  variant_id: z.number().nullable().optional(),
  title: z.string(),
  quantity: z.number(),
  price: z.string(),
  sku: z.string().nullable().optional(),
});

const OrderSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable().optional(),
  created_at: z.string(),
  total_price: z.string(),
  subtotal_price: z.string(),
  currency: z.string(),
  financial_status: z.string(),
  fulfillment_status: z.string().nullable(),
  line_items: z.array(LineItemSchema),
  customer: z
    .object({ id: z.number() })
    .nullable()
    .optional(),
  landing_site: z.string().nullable().optional(),
  referring_site: z.string().nullable().optional(),
  tags: z.string().optional(),
  note: z.string().nullable().optional(),
  browser_ip: z.string().nullable().optional(),
});

const OrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
});

const SingleOrderResponseSchema = z.object({
  order: OrderSchema,
});

const ProductVariantSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.string(),
  sku: z.string().nullable().optional(),
  inventory_quantity: z.number().optional(),
});

const ProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  status: z.string(),
  product_type: z.string().optional(),
  variants: z.array(ProductVariantSchema),
  images: z.array(z.object({ id: z.number(), src: z.string() })).optional(),
});

const ProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
});

const CustomerSchema = z.object({
  id: z.number(),
  email: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  orders_count: z.number(),
  total_spent: z.string(),
  created_at: z.string(),
  tags: z.string().optional(),
});

const CustomersResponseSchema = z.object({
  customers: z.array(CustomerSchema),
});

// ─── Internal Helpers ───────────────────────────────────────────────────────

const SHOPIFY_API_VERSION = "2024-01";

async function shopifyRequest<T>(
  shop: string,
  accessToken: string,
  path: string,
  schema: z.ZodType<T>,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}${path}`
  );

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Shopify API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return schema.parse(data);
}

function mapOrder(raw: z.infer<typeof OrderSchema>): ShopifyOrder {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email ?? "",
    createdAt: raw.created_at,
    totalPrice: raw.total_price,
    subtotalPrice: raw.subtotal_price,
    currency: raw.currency,
    financialStatus: raw.financial_status,
    fulfillmentStatus: raw.fulfillment_status,
    lineItems: raw.line_items.map((li) => ({
      id: li.id,
      productId: li.product_id ?? 0,
      variantId: li.variant_id ?? 0,
      title: li.title,
      quantity: li.quantity,
      price: li.price,
      sku: li.sku ?? "",
    })),
    customerId: raw.customer?.id ?? null,
    landingPage: raw.landing_site ?? null,
    referringSite: raw.referring_site ?? null,
    tags: raw.tags ?? "",
    note: raw.note ?? null,
    browserIp: raw.browser_ip ?? null,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch orders within a date range, with optional filters.
 */
export async function getOrders(
  shop: string,
  accessToken: string,
  dateRange: DateRange,
  params?: OrderListParams
): Promise<ShopifyOrder[]> {
  const queryParams: Record<string, string> = {
    created_at_min: `${dateRange.startDate}T00:00:00Z`,
    created_at_max: `${dateRange.endDate}T23:59:59Z`,
    limit: String(params?.limit ?? 250),
    status: params?.status ?? "any",
  };

  if (params?.sinceId) queryParams.since_id = String(params.sinceId);
  if (params?.financialStatus)
    queryParams.financial_status = params.financialStatus;
  if (params?.fulfillmentStatus)
    queryParams.fulfillment_status = params.fulfillmentStatus;
  if (params?.fields) queryParams.fields = params.fields;

  const data = await shopifyRequest(
    shop,
    accessToken,
    "/orders.json",
    OrdersResponseSchema,
    queryParams
  );

  return data.orders.map(mapOrder);
}

/**
 * Fetch a single order by ID.
 */
export async function getOrderById(
  shop: string,
  accessToken: string,
  orderId: number
): Promise<ShopifyOrder> {
  const data = await shopifyRequest(
    shop,
    accessToken,
    `/orders/${orderId}.json`,
    SingleOrderResponseSchema
  );

  return mapOrder(data.order);
}

/**
 * Fetch the product catalog.
 */
export async function getProducts(
  shop: string,
  accessToken: string
): Promise<ShopifyProduct[]> {
  const data = await shopifyRequest(
    shop,
    accessToken,
    "/products.json",
    ProductsResponseSchema,
    { limit: "250" }
  );

  return data.products.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    status: p.status,
    productType: p.product_type ?? "",
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      sku: v.sku ?? "",
      inventoryQuantity: v.inventory_quantity ?? 0,
    })),
    images: (p.images ?? []).map((img) => ({ id: img.id, src: img.src })),
  }));
}

/**
 * Fetch customer data with optional filters.
 */
export async function getCustomers(
  shop: string,
  accessToken: string,
  params?: CustomerListParams
): Promise<ShopifyCustomer[]> {
  const queryParams: Record<string, string> = {
    limit: String(params?.limit ?? 250),
  };

  if (params?.sinceId) queryParams.since_id = String(params.sinceId);
  if (params?.fields) queryParams.fields = params.fields;

  const data = await shopifyRequest(
    shop,
    accessToken,
    "/customers.json",
    CustomersResponseSchema,
    queryParams
  );

  return data.customers.map((c) => ({
    id: c.id,
    email: c.email ?? "",
    firstName: c.first_name ?? "",
    lastName: c.last_name ?? "",
    ordersCount: c.orders_count,
    totalSpent: c.total_spent,
    createdAt: c.created_at,
    tags: c.tags ?? "",
  }));
}

/**
 * 1:1 order attribution: match Shopify orders to A/B test exposure events.
 *
 * Matching priority:
 * 1. Email match (high confidence)
 * 2. IP + time window match (medium confidence)
 * 3. Session-based heuristic (low confidence)
 */
export function matchOrdersToVariant(
  orders: ShopifyOrder[],
  testExposures: TestExposureEvent[]
): AttributedOrder[] {
  const attributedOrders: AttributedOrder[] = [];

  // Build lookup indexes for faster matching
  const exposuresByEmail = new Map<string, TestExposureEvent[]>();
  const exposuresByIp = new Map<string, TestExposureEvent[]>();

  for (const exposure of testExposures) {
    if (exposure.email) {
      const key = exposure.email.toLowerCase();
      const existing = exposuresByEmail.get(key) ?? [];
      existing.push(exposure);
      exposuresByEmail.set(key, existing);
    }
    if (exposure.browserIp) {
      const existing = exposuresByIp.get(exposure.browserIp) ?? [];
      existing.push(exposure);
      exposuresByIp.set(exposure.browserIp, existing);
    }
  }

  for (const order of orders) {
    // 1. Try email match (highest confidence)
    if (order.email) {
      const emailExposures = exposuresByEmail.get(
        order.email.toLowerCase()
      );
      if (emailExposures) {
        const match = findClosestExposure(emailExposures, order.createdAt);
        if (match) {
          attributedOrders.push({
            order,
            matchedExposure: match,
            matchType: "email",
            confidence: "high",
          });
          continue;
        }
      }
    }

    // 2. Try IP match within a 24-hour window (medium confidence)
    if (order.browserIp) {
      const ipExposures = exposuresByIp.get(order.browserIp);
      if (ipExposures) {
        const match = findClosestExposure(
          ipExposures,
          order.createdAt,
          24 * 60 * 60 * 1000 // 24 hours
        );
        if (match) {
          attributedOrders.push({
            order,
            matchedExposure: match,
            matchType: "ip",
            confidence: "medium",
          });
          continue;
        }
      }
    }

    // 3. Session-based fallback: landing page URL contains test variant info
    // This is a heuristic -- low confidence
    const sessionMatch = testExposures.find((exposure) => {
      if (!order.landingPage || !exposure.pageUrl) return false;
      const orderTime = new Date(order.createdAt).getTime();
      const exposureTime = new Date(exposure.timestamp).getTime();
      const withinWindow =
        orderTime >= exposureTime &&
        orderTime - exposureTime < 7 * 24 * 60 * 60 * 1000; // 7 day window

      return (
        withinWindow &&
        order.landingPage.includes(
          new URL(exposure.pageUrl, "https://placeholder.com").pathname
        )
      );
    });

    if (sessionMatch) {
      attributedOrders.push({
        order,
        matchedExposure: sessionMatch,
        matchType: "session",
        confidence: "low",
      });
    }
  }

  return attributedOrders;
}

/**
 * Find the closest exposure event that happened before the order,
 * optionally within a max time window.
 */
function findClosestExposure(
  exposures: TestExposureEvent[],
  orderTimestamp: string,
  maxWindowMs?: number
): TestExposureEvent | null {
  const orderTime = new Date(orderTimestamp).getTime();
  let closest: TestExposureEvent | null = null;
  let closestDiff = Infinity;

  for (const exposure of exposures) {
    const exposureTime = new Date(exposure.timestamp).getTime();
    const diff = orderTime - exposureTime;

    // Exposure must be before the order
    if (diff < 0) continue;

    // Optionally enforce a max time window
    if (maxWindowMs !== undefined && diff > maxWindowMs) continue;

    if (diff < closestDiff) {
      closest = exposure;
      closestDiff = diff;
    }
  }

  return closest;
}
