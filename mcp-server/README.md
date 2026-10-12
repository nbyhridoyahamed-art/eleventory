# Eleventory MCP server

Manage your Eleventory store from Claude (or any MCP-compatible LLM client):
look up products and orders, change the catalog, move stock, work orders and
couriers, read analytics and reports, and tune SEO — in plain language.

It runs on your machine over stdio and talks to the store's admin REST API, so
it works against the local project **and** the live site (`https://api.elevendollar.store/api/v1`).

## Install (global command)

```bash
cd mcp-server
npm install
npm link          # makes the `eleventory-mcp` command available everywhere
```

Check it: `eleventory-mcp` should print a line to stderr and then wait for an MCP client.

## Connect a client

> **Easiest way:** open **AI Assistant** in the admin sidebar (`/dashboard/mcp`). Create a connection
> (read-only or full access), and copy the ready-made command or config. Connections can be revoked there at any time,
> and a read-only connection is enforced by the API itself — writes are refused with HTTP 403.

The server reads its settings from environment variables:

| Variable | Meaning |
|---|---|
| `ELEVENTORY_API_URL` | API base, default `http://localhost:8000/api/v1`. Live: `https://api.elevendollar.store/api/v1` |
| `ELEVENTORY_API_TOKEN` | A staff user's API token **or** |
| `ELEVENTORY_EMAIL` + `ELEVENTORY_PASSWORD` | A staff login; the token is fetched automatically and renewed when it expires |
| `ELEVENTORY_STORE_ID` | Optional; defaults to the user's current store |
| `ELEVENTORY_STORE_NAME` / `ELEVENTORY_SITE` | Optional display name / domain given to the assistant (derived from the API URL by default, e.g. `elevendollar.store`) |
| `ELEVENTORY_READ_ONLY=1` | Only expose read tools (safe for analysis and reporting) |
| `ELEVENTORY_ALLOW_DESTRUCTIVE=1` | Also expose delete / cancel tools (each still needs `confirm: true`) |

### Claude Code (CLI)

```bash
claude mcp add eleventory --scope user \
  -e ELEVENTORY_API_URL=https://api.elevendollar.store/api/v1 \
  -e ELEVENTORY_EMAIL=you@yourstore.com \
  -e ELEVENTORY_PASSWORD='your-password' \
  -- eleventory-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`
(Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "eleventory": {
      "command": "eleventory-mcp",
      "env": {
        "ELEVENTORY_API_URL": "https://api.elevendollar.store/api/v1",
        "ELEVENTORY_EMAIL": "you@yourstore.com",
        "ELEVENTORY_PASSWORD": "your-password"
      }
    }
  }
}
```

If the command is not found, use the full path of `node` and of
`mcp-server/src/index.js` instead (`"command": "node", "args": ["D:/.../mcp-server/src/index.js"]`).

### Safer: a dedicated user and token

Create a staff user for the assistant (Settings → Users) with only the roles you
want it to have — the server can do exactly what that user can do. Then use an
API token instead of a password:

```bash
curl -s -X POST https://api.elevendollar.store/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"assistant@yourstore.com","password":"..."}'
# → data.token
```

## What it can do

**Overview** `store_overview` · `dashboard_insights` · `sales_trend`

**Catalog** `list_products` · `get_product` · `create_product` · `update_product` · `next_sku` ·
`list_categories` · `create_category` · `list_brands` · `create_brand`

**Inventory** `list_warehouses` · `stock_levels` · `stock_movements` · `adjust_stock` ·
`stock_overview` · `low_stock_report` · `reorder_suggestions`

**Orders & delivery** `list_orders` · `get_order` · `process_order` · `ship_order` · `deliver_order` ·
`list_couriers` · `send_to_courier` (Steadfast) · `create_shipment` · `list_shipments` · `sync_courier_status`

**Customers** `list_customers` (with segments & lifetime spend) · `customer_summary` · `get_customer`

**Reports & analytics** `sales_report` · `sales_insights` · `product_performance` ·
`analytics_overview` · `analytics_insights` · `analytics_searches`

**SEO & content** `seo_audit` · `seo_settings` · `seo_generate` · `seo_rescore` · `list_404s` ·
`list_redirects` · `create_redirect` · `list_pages` · `list_blog_posts` · `notification_log`

Only with `ELEVENTORY_ALLOW_DESTRUCTIVE=1`: `delete_product` · `cancel_order`
(both also require `confirm: true`).

## Example prompts

- "How did we do over the last 30 days compared with the 30 before?"
- "Which VIP customers haven't ordered in 60 days?"
- "Add 25 units of SKU JOY-000123 to the Dhaka warehouse."
- "Create a draft product 'Anker 20W Charger' at ৳1,450 under Mobile Accessories, brand Anker."
- "Ship order 1042 and send it to Steadfast."
- "Show the lowest-scoring SEO items and generate missing titles for products."

## Safety notes

- Every call runs as the signed-in staff user, so Eleventory's own roles and
  permissions apply; a denied action comes back as an error, not a silent no-op.
- Use `ELEVENTORY_READ_ONLY=1` for reporting-only assistants.
- Product updates are *merge* updates: fields you do not pass are left as they are.
- Credentials live in the client's config file — protect it like any password.

## Develop

```bash
npm test                      # smoke test against a running local API
node test/write.mjs           # create → update → adjust → delete round trip (uses the demo data)
```
