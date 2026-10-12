// Verifies the remote MCP endpoint with the official Streamable HTTP client.
// Usage: ELEVENTORY_CONNECTOR_URL=https://api.example.com/mcp/<token> node test/remote.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.ELEVENTORY_CONNECTOR_URL;

if (!url) {
  console.error("Set ELEVENTORY_CONNECTOR_URL to the connector URL shown on Dashboard -> AI Assistant.");
  process.exit(1);
}

const client = new Client({ name: "remote-check", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

console.log("server:", client.getServerVersion()?.name, client.getServerVersion()?.version);
console.log("instructions:", (client.getInstructions() ?? "").split("\n")[0]);

const { tools } = await client.listTools();
console.log("tools:", tools.length);

for (const [name, args] of [
  ["store_overview", {}],
  ["customer_summary", {}],
  ["list_products", { per_page: 2 }],
]) {
  const res = await client.callTool({ name, arguments: args });
  console.log(`\n# ${name}${res.isError ? " (ERROR)" : ""}\n${res.content[0].text.slice(0, 260)}`);
}

await client.close();
