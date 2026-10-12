#!/usr/bin/env node
/**
 * Eleventory MCP server - lets Claude (or any MCP client) run an Eleventory
 * store: look things up, change the catalog, move stock, work orders, read
 * analytics and tune SEO. Talks to the store's admin API over HTTP, so it
 * works against a local install or a live site.
 *
 * Environment:
 *   ELEVENTORY_API_URL        API base, e.g. https://api.example.com/api/v1  (default http://localhost:8000/api/v1)
 *   ELEVENTORY_API_TOKEN      staff API token, or
 *   ELEVENTORY_EMAIL / ELEVENTORY_PASSWORD   staff login (token is obtained automatically)
 *   ELEVENTORY_STORE_ID       optional; defaults to the user's current store
 *   ELEVENTORY_READ_ONLY=1    expose read tools only
 *   ELEVENTORY_ALLOW_DESTRUCTIVE=1   allow delete/cancel tools (they also need confirm=true)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { EleventoryClient, EleventoryError } from "./client.js";

const client = new EleventoryClient();
const READ_ONLY = ["1", "true", "yes"].includes(String(process.env.ELEVENTORY_READ_ONLY ?? "").toLowerCase());
const ALLOW_DESTRUCTIVE = ["1", "true", "yes"].includes(String(process.env.ELEVENTORY_ALLOW_DESTRUCTIVE ?? "").toLowerCase());
const MAX_CHARS = 24_000;

/** "https://api.elevendollar.store/api/v1" -> "elevendollar.store" (the public site the API belongs to). */
function siteFromApiUrl(url) {
  try {
    return new URL(url).hostname.replace(/^api\./, "");
  } catch {
    return null;
  }
}

const site = process.env.ELEVENTORY_SITE || siteFromApiUrl(client.baseUrl);
const storeLabel = process.env.ELEVENTORY_STORE_NAME || site || "this store";

const server = new McpServer(
  { name: "eleventory", version: "1.0.0" },
  {
    instructions: [
      `This server manages the online store ${storeLabel}${site && site !== storeLabel ? ` (${site})` : ""}, which runs on the Eleventory ecommerce platform.`,
      `Whenever the user mentions ${site ?? "their store"}, Eleventory, or asks about products, stock, orders, customers, sales, analytics, delivery or SEO for the store, use these tools.`,
      "Start with store_overview to see who you are connected as and the headline numbers.",
      READ_ONLY ? "This connection is read-only: you can look things up and report, but not change anything." : "Changes are made as the signed-in staff user; confirm destructive or large changes with the user first.",
    ].join("\n"),
  },
);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function render(value) {
  const text = JSON.stringify(value, null, 2);

  if (text.length <= MAX_CHARS) return text;

  return `${text.slice(0, MAX_CHARS)}\n… output truncated (${text.length} characters). Narrow the request or use page/per_page.`;
}

function ok(value) {
  return { content: [{ type: "text", text: render(value) }] };
}

function fail(error) {
  const detail =
    error instanceof EleventoryError
      ? { error: error.message, status: error.status, validation: error.errors ?? undefined }
      : { error: error?.message ?? String(error) };

  return { content: [{ type: "text", text: render(detail) }], isError: true };
}

/** Registers a tool, hiding write tools in read-only mode and wrapping errors. */
function tool(name, description, shape, handler, { write = false, destructive = false } = {}) {
  if (write && READ_ONLY) return;
  if (destructive && !ALLOW_DESTRUCTIVE) return;

  server.registerTool(
    name,
    {
      description,
      inputSchema: shape,
      annotations: {
        readOnlyHint: !write,
        destructiveHint: destructive,
        idempotentHint: !write,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        // A first-call failure (API down at startup) should not be permanent.
        if (!client.storeId) await client.init();

        return ok(await handler(args ?? {}));
      } catch (error) {
        return fail(error);
      }
    },
  );
}

const page = z.number().int().min(1).optional().describe("Page number (default 1)");
const perPage = z.number().int().min(1).max(100).optional().describe("Items per page (default 20, max 100)");
const confirm = z.literal(true).describe("Must be true: confirms you intend this irreversible change.");
const dateFrom = z.string().describe("Start date, YYYY-MM-DD");
const dateTo = z.string().describe("End date, YYYY-MM-DD");

/** List endpoints return {data, meta}; give the model both in one object. */
async function list(path, query) {
  const { data, meta } = await client.get(path, client.scoped(query));

  return { items: data, pagination: meta ?? undefined };
}

// ---------------------------------------------------------------------------
// store & dashboard
// ---------------------------------------------------------------------------

tool(
  "store_overview",
  "Who you are signed in as, the store being managed, and headline counts (products, pending orders, low stock, open purchase orders).",
  {},
  async () => {
    const [products, pending, lowStock, openPo] = await Promise.all([
      client.get("/products", client.scoped({ per_page: 1 })),
      client.get("/orders", client.scoped({ open: 1, per_page: 1 })),
      client.get("/stock-levels/low-stock-count", client.scoped()),
      client.get("/purchase-orders", client.scoped({ open: 1, per_page: 1 })),
    ]);

    return {
      user: { id: client.user?.id, name: client.user?.name, email: client.user?.email },
      store_id: client.storeId,
      store: storeLabel,
      site: site ? `https://${site}` : undefined,
      api: client.baseUrl,
      read_only: READ_ONLY,
      products: products.meta?.total ?? 0,
      open_orders: pending.meta?.total ?? 0,
      low_stock_alerts: lowStock.data?.count ?? 0,
      open_purchase_orders: openPo.meta?.total ?? 0,
    };
  },
);

tool(
  "dashboard_insights",
  "Period KPIs with change vs the previous period, top products, sales by category, payment mix, order sources, delivery pipeline, weekday/hour patterns and low stock.",
  { days: z.number().int().min(7).max(90).optional().describe("Period length in days (7-90, default 30)") },
  async ({ days }) => (await client.get("/dashboard/insights", client.scoped({ days }))).data,
);

tool(
  "sales_trend",
  "Orders and revenue per day for the last N days.",
  { days: z.number().int().min(1).max(90).optional() },
  async ({ days }) => (await client.get("/dashboard/sales-trend", client.scoped({ days }))).data,
);

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------

tool(
  "list_products",
  "Search and list products. Filters: free-text search (name/SKU), status, category, brand.",
  {
    search: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    category_id: z.number().int().optional(),
    brand_id: z.number().int().optional(),
    page,
    per_page: perPage,
  },
  (args) => list("/products", args),
);

tool(
  "get_product",
  "Full details of one product: pricing, stock by warehouse, images, variants, SEO and score.",
  { product_id: z.number().int() },
  async ({ product_id }) => (await client.get(`/products/${product_id}`)).data,
);

const productFields = {
  name: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional().describe("Lowercase letters, numbers and hyphens"),
  sku: z.string().optional().describe("Leave out to auto-generate (e.g. JOY-000123)"),
  barcode: z.string().nullable().optional(),
  type: z.enum(["simple", "variable", "bundle"]).optional(),
  category_id: z.number().int().nullable().optional(),
  brand_id: z.number().int().nullable().optional(),
  price: z.number().min(0).optional().describe("Regular price in BDT"),
  sale_price: z.number().min(0).nullable().optional(),
  cost_price: z.number().min(0).nullable().optional(),
  compare_at_price: z.number().min(0).nullable().optional(),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional().describe("HTML allowed (headings, links, lists); it is sanitised on save"),
  status: z.enum(["draft", "active", "archived"]).optional(),
  featured: z.boolean().optional(),
  track_stock: z.boolean().optional(),
  low_stock_threshold: z.number().int().min(0).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  weight_unit: z.enum(["kg", "g", "lb"]).nullable().optional(),
  stock: z
    .object({ warehouse_id: z.number().int(), quantity: z.number().int().min(0) })
    .optional()
    .describe("Set on-hand stock at one warehouse (simple products); recorded in the inventory ledger"),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  focus_keyword: z.string().optional(),
};

function productPayload(input, existing = {}) {
  const { seo_title, seo_description, focus_keyword, ...fields } = input;
  const money = (v) => (v === null || v === undefined ? v : String(v));

  const payload = {
    store_id: client.storeId,
    category_id: existing.category_id ?? null,
    brand_id: existing.brand_id ?? null,
    type: existing.type ?? "simple",
    name: existing.name,
    slug: existing.slug,
    sku: existing.sku,
    barcode: existing.barcode ?? null,
    description: existing.description ?? null,
    short_description: existing.short_description ?? null,
    price: existing.price !== undefined ? String(existing.price) : undefined,
    sale_price: money(existing.sale_price) ?? null,
    cost_price: money(existing.cost_price) ?? null,
    compare_at_price: money(existing.compare_at_price) ?? null,
    weight: existing.weight ?? null,
    weight_unit: existing.weight_unit ?? null,
    track_stock: existing.track_stock ?? true,
    low_stock_threshold: existing.low_stock_threshold ?? null,
    status: existing.status ?? "draft",
    featured: existing.featured ?? false,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    payload[key] = ["price", "sale_price", "cost_price", "compare_at_price"].includes(key) ? money(value) : value;
  }

  if (seo_title !== undefined || seo_description !== undefined || focus_keyword !== undefined) {
    const current = existing.seo ?? {};
    payload.seo = {
      title: current.title ?? null,
      description: current.description ?? null,
      focus_keyword: current.focus_keyword ?? null,
      og_title: current.og_title ?? null,
      og_description: current.og_description ?? null,
      og_image: current.og_image ?? null,
      twitter_title: current.twitter_title ?? null,
      twitter_description: current.twitter_description ?? null,
      twitter_image: current.twitter_image ?? null,
      canonical_url: current.canonical_url ?? null,
      robots: current.robots ?? null,
      schema_json: current.schema_json ?? null,
      ...(seo_title !== undefined ? { title: seo_title } : {}),
      ...(seo_description !== undefined ? { description: seo_description } : {}),
      ...(focus_keyword !== undefined ? { focus_keyword } : {}),
    };
  } else if (existing.seo) {
    payload.seo = {
      title: existing.seo.title ?? null,
      description: existing.seo.description ?? null,
      focus_keyword: existing.seo.focus_keyword ?? null,
      og_title: existing.seo.og_title ?? null,
      og_description: existing.seo.og_description ?? null,
      og_image: existing.seo.og_image ?? null,
      twitter_title: existing.seo.twitter_title ?? null,
      twitter_description: existing.seo.twitter_description ?? null,
      twitter_image: existing.seo.twitter_image ?? null,
      canonical_url: existing.seo.canonical_url ?? null,
      robots: existing.seo.robots ?? null,
      schema_json: existing.seo.schema_json ?? null,
    };
  }

  return payload;
}

tool(
  "create_product",
  "Create a product. Only name and price are required; the slug and SKU are generated when omitted. New products are drafts unless status is set.",
  { ...productFields, name: z.string(), price: z.number().min(0) },
  async (input) => {
    const slug =
      input.slug ??
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const payload = productPayload({ ...input, slug }, {});

    return (await client.post("/products", payload)).data;
  },
  { write: true },
);

tool(
  "update_product",
  "Change fields of an existing product. Only the fields you pass are changed; everything else is kept.",
  { product_id: z.number().int(), ...productFields },
  async ({ product_id, ...changes }) => {
    const existing = (await client.get(`/products/${product_id}`)).data;
    const payload = productPayload(changes, existing);

    return (await client.put(`/products/${product_id}`, payload)).data;
  },
  { write: true },
);

tool(
  "delete_product",
  "Delete (archive to trash) a product. Requires ELEVENTORY_ALLOW_DESTRUCTIVE=1 and confirm=true.",
  { product_id: z.number().int(), confirm },
  async ({ product_id }) => {
    await client.delete(`/products/${product_id}`);

    return { deleted: true, product_id };
  },
  { write: true, destructive: true },
);

tool(
  "next_sku",
  "Preview the SKU a new product would get for a brand/category.",
  { brand_id: z.number().int().optional(), category_id: z.number().int().optional() },
  async (args) => (await client.get("/products/next-sku", client.scoped(args))).data,
);

tool(
  "list_categories",
  "All categories (flat list with parent_id; sub-categories reference their parent).",
  {},
  async () => (await client.get("/categories", client.scoped())).data,
);

tool(
  "create_category",
  "Create a category or sub-category (set parent_id).",
  { name: z.string(), slug: z.string().optional(), parent_id: z.number().int().nullable().optional(), description: z.string().optional() },
  async ({ name, slug, parent_id, description }) =>
    (
      await client.post("/categories", {
        store_id: client.storeId,
        name,
        slug: slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        parent_id: parent_id ?? null,
        description: description ?? null,
        status: "active",
      })
    ).data,
  { write: true },
);

tool(
  "list_brands",
  "List brands.",
  { search: z.string().optional(), page, per_page: perPage },
  (args) => list("/brands", args),
);

tool(
  "create_brand",
  "Create a brand.",
  { name: z.string(), slug: z.string().optional(), description: z.string().optional() },
  async ({ name, slug, description }) =>
    (
      await client.post("/brands", {
        store_id: client.storeId,
        name,
        slug: slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        description: description ?? null,
        status: "active",
      })
    ).data,
  { write: true },
);

// ---------------------------------------------------------------------------
// inventory
// ---------------------------------------------------------------------------

tool("list_warehouses", "List warehouses (needed for stock operations).", {}, async () => (await client.get("/warehouses", client.scoped({ per_page: 100 }))).data);

tool(
  "stock_levels",
  "On-hand and reserved stock per product at one warehouse.",
  { warehouse_id: z.number().int(), search: z.string().optional(), page, per_page: perPage },
  (args) => list("/stock-levels", args),
);

tool(
  "stock_movements",
  "The inventory ledger: every increase, decrease, sale and transfer.",
  { product_id: z.number().int().optional(), warehouse_id: z.number().int().optional(), page, per_page: perPage },
  (args) => list("/stock-movements", args),
);

tool(
  "adjust_stock",
  "Increase or decrease on-hand stock of a product (or variant) at a warehouse. Recorded in the movements ledger.",
  {
    product_id: z.number().int(),
    warehouse_id: z.number().int(),
    direction: z.enum(["increase", "decrease"]),
    quantity: z.number().int().min(1),
    product_variant_id: z.number().int().optional(),
    reason: z.string().max(255).optional(),
  },
  async (args) => (await client.post("/stock-adjustments", args)).data,
  { write: true },
);

tool("stock_overview", "Stock health: tracked products, out of stock, low stock, units and stock value at cost/retail.", {}, async () => (await client.get("/reports/stock-overview", client.scoped())).data);

tool("low_stock_report", "Products at or below their low-stock threshold.", { page, per_page: perPage }, (args) => list("/reports/low-stock", args));

tool("reorder_suggestions", "Suggested purchase quantities for products running low, with last supplier and unit cost.", { page, per_page: perPage }, (args) => list("/reports/reorder-suggestions", args));

// ---------------------------------------------------------------------------
// orders & delivery
// ---------------------------------------------------------------------------

tool(
  "list_orders",
  "List orders, newest first.",
  {
    status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
    customer_id: z.number().int().optional(),
    warehouse_id: z.number().int().optional(),
    page,
    per_page: perPage,
  },
  (args) => list("/orders", args),
);

tool("get_order", "One order with items, customer, shipping address, payments, shipments and status history.", { order_id: z.number().int() }, async ({ order_id }) => (await client.get(`/orders/${order_id}`)).data);

for (const [name, action, text] of [
  ["process_order", "process", "Move a pending order to processing."],
  ["ship_order", "ship", "Mark an order shipped (takes its stock out of the warehouse)."],
  ["deliver_order", "deliver", "Mark a shipped order delivered."],
]) {
  tool(name, text, { order_id: z.number().int() }, async ({ order_id }) => (await client.post(`/orders/${order_id}/${action}`)).data, { write: true });
}

tool(
  "cancel_order",
  "Cancel an order (releases reserved stock). Requires ELEVENTORY_ALLOW_DESTRUCTIVE=1 and confirm=true.",
  { order_id: z.number().int(), confirm },
  async ({ order_id }) => (await client.post(`/orders/${order_id}/cancel`)).data,
  { write: true, destructive: true },
);

tool("list_couriers", "Delivery couriers, including whether each is connected to the Steadfast API.", {}, async () => (await client.get("/couriers", client.scoped({ per_page: 100 }))).data);

tool(
  "send_to_courier",
  "Book a shipped order with an API-connected courier (Steadfast). Returns the shipment with tracking code. For manual couriers use create_shipment.",
  { order_id: z.number().int(), courier_id: z.number().int(), note: z.string().max(500).optional() },
  async ({ order_id, courier_id, note }) => (await client.post(`/orders/${order_id}/send-to-courier`, { courier_id, note })).data,
  { write: true },
);

tool(
  "create_shipment",
  "Record a shipment with a manual courier and tracking number for a shipped order.",
  {
    order_id: z.number().int(),
    courier_id: z.number().int(),
    tracking_number: z.string(),
    delivery_charge: z.number().min(0).optional(),
    notes: z.string().optional(),
  },
  async ({ order_id, courier_id, tracking_number, delivery_charge, notes }) =>
    (
      await client.post(`/orders/${order_id}/shipments`, {
        courier_id,
        tracking_number,
        delivery_charge: delivery_charge === undefined ? null : String(delivery_charge),
        notes: notes ?? null,
      })
    ).data,
  { write: true },
);

tool("list_shipments", "Shipments, optionally by status.", { status: z.string().optional(), courier_id: z.number().int().optional(), page, per_page: perPage }, (args) => list("/shipments", args));

tool(
  "sync_courier_status",
  "Refresh a Steadfast shipment's delivery status from the courier.",
  { shipment_id: z.number().int() },
  async ({ shipment_id }) => (await client.post(`/shipments/${shipment_id}/sync-courier`)).data,
  { write: true },
);

// ---------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------

tool(
  "list_customers",
  "Customers with lifetime spend, order count, last order and behavioural segment (vip, repeat, one_time, at_risk, inactive, new).",
  {
    search: z.string().optional(),
    segment: z.enum(["vip", "repeat", "one_time", "at_risk", "inactive", "new"]).optional(),
    sort: z.enum(["spend", "orders", "recent", "joined"]).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    page,
    per_page: perPage,
  },
  (args) => list("/customers", args),
);

tool("customer_summary", "Customer totals, growth, repeat rate, lifetime value, segment mix and top spenders.", {}, async () => (await client.get("/customers/summary", client.scoped())).data);

tool("get_customer", "One customer with addresses and store-credit balance.", { customer_id: z.number().int() }, async ({ customer_id }) => (await client.get(`/customers/${customer_id}`)).data);

// ---------------------------------------------------------------------------
// reports & analytics
// ---------------------------------------------------------------------------

tool(
  "sales_report",
  "Revenue, orders and average order value by day/week/month, with payment-method and courier breakdowns and the change vs the previous period.",
  { date_from: dateFrom, date_to: dateTo, granularity: z.enum(["day", "week", "month"]).optional(), warehouse_id: z.number().int().optional() },
  async (args) => (await client.get("/reports/sales", client.scoped(args))).data,
);

tool(
  "sales_insights",
  "Sales context: revenue by category, top customers, weekday pattern, order outcomes, discounts, shipping and new vs returning buyers.",
  { date_from: dateFrom, date_to: dateTo, warehouse_id: z.number().int().optional() },
  async (args) => (await client.get("/reports/sales/insights", client.scoped(args))).data,
);

tool(
  "product_performance",
  "Units sold and revenue per product in a date range.",
  { date_from: dateFrom, date_to: dateTo, page, per_page: perPage },
  (args) => list("/reports/products-performance", args),
);

tool(
  "analytics_overview",
  "Storefront traffic: page views, sessions, conversion, funnel counts and the trend, compared with the previous period.",
  { date_from: dateFrom, date_to: dateTo, granularity: z.enum(["day", "week", "month"]).optional() },
  async (args) => (await client.get("/analytics/overview", client.scoped(args))).data,
);

tool(
  "analytics_insights",
  "Visitor behaviour: bounce rate, pages per session, returning visitors, cart/checkout abandonment, top pages, weekday and hour patterns.",
  { date_from: dateFrom, date_to: dateTo },
  async (args) => (await client.get("/analytics/overview/insights", client.scoped(args))).data,
);

tool(
  "analytics_searches",
  "What shoppers search for on the storefront, with result counts (spot demand you do not stock).",
  { date_from: dateFrom, date_to: dateTo, page, per_page: perPage },
  (args) => list("/analytics/searches", args),
);

// ---------------------------------------------------------------------------
// SEO & content
// ---------------------------------------------------------------------------

tool("seo_audit", "SEO health: scores per content type, the lowest-scoring items with edit links, and site-level checks.", {}, async () => (await client.get("/seo/audit", client.scoped())).data);

tool("seo_settings", "Site-level SEO configuration: homepage meta, robots, sitemap, schema, verification and analytics IDs.", {}, async () => (await client.get("/seo/settings", client.scoped())).data);

tool(
  "seo_generate",
  "Generate missing SEO titles, descriptions and focus keywords for content types. By default only blank fields are filled.",
  {
    entities: z.array(z.enum(["products", "pages", "categories", "brands", "blog_posts", "blog_categories", "blog_tags"])).min(1),
    overwrite: z.boolean().optional().describe("Replace existing SEO text too (default false)"),
  },
  async ({ entities, overwrite }) => (await client.post("/seo/generate", { store_id: client.storeId, entities, overwrite: overwrite ?? false })).data,
  { write: true },
);

tool("seo_rescore", "Recalculate stored SEO scores after bulk edits.", {}, async () => (await client.post("/seo/rescore", { store_id: client.storeId })).data, { write: true });

tool("list_404s", "Missing URLs visitors hit, most frequent first - candidates for redirects.", { page, per_page: perPage }, (args) => list("/seo/404", args));

tool("list_redirects", "Configured URL redirects.", {}, async () => (await client.get("/redirects", client.scoped())).data);

tool(
  "create_redirect",
  "Redirect an old storefront path to a new one (301 by default).",
  { from_path: z.string().describe("e.g. /products/old-name"), to_path: z.string(), status_code: z.union([z.literal(301), z.literal(302)]).optional() },
  async ({ from_path, to_path, status_code }) =>
    (await client.post("/redirects", { store_id: client.storeId, from_path, to_path, status_code: status_code ?? 301 })).data,
  { write: true },
);

tool("list_pages", "Content pages (About, FAQ, policies...).", {}, async () => (await client.get("/pages", client.scoped())).data);

tool("list_blog_posts", "Blog posts.", { search: z.string().optional(), status: z.string().optional(), page, per_page: perPage }, (args) => list("/blog-posts", args));

tool("notification_log", "Recent SMS and email notifications with delivery status and errors.", { channel: z.enum(["sms", "email"]).optional(), status: z.enum(["sent", "failed"]).optional(), page, per_page: perPage }, (args) => list("/notification-logs", args));

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

async function main() {
  try {
    const { user, storeId } = await client.init();
    console.error(`[eleventory-mcp] connected to ${client.baseUrl} as ${user?.email ?? "unknown"} (store ${storeId})${READ_ONLY ? " [read-only]" : ""}`);
  } catch (error) {
    // Still start, so the client shows a clear per-call error instead of a dead server.
    console.error(`[eleventory-mcp] could not authenticate yet: ${error.message}`);
  }

  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error("[eleventory-mcp] fatal:", error);
  process.exit(1);
});
