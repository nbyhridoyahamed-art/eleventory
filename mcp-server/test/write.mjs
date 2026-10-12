import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function connect(extraEnv) {
  const client = new Client({ name: "write-test", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: ["src/index.js"], env: { ...process.env, ...extraEnv }, stderr: "ignore" }),
  );
  return client;
}

const json = (res) => {
  try {
    return JSON.parse(res.content[0].text);
  } catch {
    return res.content[0].text;
  }
};

// 1. read-only hides every write tool
const ro = await connect({ ELEVENTORY_READ_ONLY: "1" });
const roTools = (await ro.listTools()).tools.map((t) => t.name);
console.log("read-only tools:", roTools.length, "| has create_product:", roTools.includes("create_product"));
await ro.close();

// 2. destructive tools are hidden unless explicitly allowed
const normal = await connect({});
const names = (await normal.listTools()).tools.map((t) => t.name);
console.log("default tools:", names.length, "| has delete_product:", names.includes("delete_product"));
await normal.close();

// 3. full write round trip with destructive enabled
const c = await connect({ ELEVENTORY_ALLOW_DESTRUCTIVE: "1" });
const wh = json(await c.callTool({ name: "list_warehouses", arguments: {} }));
const warehouseId = (wh.items ?? wh)[0]?.id ?? wh[0]?.id;

const created = json(await c.callTool({ name: "create_product", arguments: { name: "MCP Test Cable", price: 199, short_description: "temp", stock: { warehouse_id: warehouseId, quantity: 7 } } }));
console.log("created:", created.id, created.sku, "stock:", created.stock?.total);

const updated = json(await c.callTool({ name: "update_product", arguments: { product_id: created.id, price: 249, sale_price: 199, description: "<h2>Spec</h2><p>Fast</p><script>x</script>", seo_title: "MCP Test Cable | Eleventory" } }));
console.log("updated price/sale:", updated.price, updated.sale_price, "| name kept:", updated.name, "| desc:", updated.description);

const adj = json(await c.callTool({ name: "adjust_stock", arguments: { product_id: created.id, warehouse_id: warehouseId, direction: "increase", quantity: 3, reason: "mcp test" } }));
console.log("adjust:", adj.quantity_before, "->", adj.quantity_after);

const refused = await c.callTool({ name: "delete_product", arguments: { product_id: created.id, confirm: false } });
console.log("delete without confirm refused:", Boolean(refused.isError));

const deleted = json(await c.callTool({ name: "delete_product", arguments: { product_id: created.id, confirm: true } }));
console.log("deleted:", deleted);
await c.close();
