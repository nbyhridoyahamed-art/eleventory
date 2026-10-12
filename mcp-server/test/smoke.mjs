import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["src/index.js"],
  env: { ...process.env },
  stderr: "inherit",
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`tools: ${tools.length}`);

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? "";
  console.log(`\n# ${name} ${res.isError ? "(ERROR)" : ""}\n${text.slice(0, 380)}`);
  return res;
};

await call("store_overview");
await call("list_products", { search: "cable", per_page: 2 });
await call("customer_summary");
await call("dashboard_insights", { days: 30 });
await call("next_sku");
await call("sales_report", { date_from: "2026-09-01", date_to: "2026-10-12" });
await call("get_product", { product_id: 999999 });

await client.close();
