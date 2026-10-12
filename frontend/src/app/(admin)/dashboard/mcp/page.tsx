"use client";

import { useState } from "react";
import { Bot, Check, Copy, KeyRound, Plug, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn, timeAgo } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useCreateMcpConnection,
  useMcpConnections,
  useRevokeMcpConnection,
  type CreatedMcpConnection,
  type McpConnection,
} from "@/hooks/use-mcp";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type ClientTab = "connector" | "claude-code" | "claude-desktop" | "other";

const TOOL_GROUPS = [
  { title: "Catalog", items: "Search, create and edit products, categories and brands; preview SKUs" },
  { title: "Inventory", items: "Stock levels, adjustments, movements, low-stock and reorder reports" },
  { title: "Orders & delivery", items: "Process, ship and deliver orders; send to Steadfast; sync tracking" },
  { title: "Customers", items: "Segments, lifetime value, top spenders, customer details" },
  { title: "Reports & analytics", items: "Sales, product performance, traffic, searches, behaviour insights" },
  { title: "SEO & content", items: "SEO audit, generate titles, redirects, 404s, pages and posts" },
];

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("Could not copy — select the text and copy it manually.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-shop-tint p-3 text-xs leading-relaxed text-text-primary">
      <code>{children}</code>
    </pre>
  );
}

export default function McpPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: connections, isLoading } = useMcpConnections();
  const create = useCreateMcpConnection();
  const revoke = useRevokeMcpConnection();

  const [name, setName] = useState("");
  const [mode, setMode] = useState<"read_only" | "full">("read_only");
  const [fresh, setFresh] = useState<CreatedMcpConnection | null>(null);
  const [tab, setTab] = useState<ClientTab>("connector");

  if (currentUser && !can(currentUser, "settings.manage")) {
    return <PermissionDenied />;
  }

  const token = fresh?.token ?? "<paste-your-token>";


  // Remote (HTTPS) connector: Claude's "Add custom connector" has no token field, so the token is part of the URL.
  const origin = (() => {
    try {
      return new URL(API_URL).origin;
    } catch {
      return API_URL;
    }
  })();
  const connectorUrl = `${origin}/mcp/${fresh ? encodeURIComponent(fresh.token) : "<your-token>"}`;

  const claudeCode = `claude mcp add eleventory --scope user \\
  -e ELEVENTORY_API_URL=${API_URL} \\
  -e ELEVENTORY_API_TOKEN=${token} \\
  -- eleventory-mcp`;

  const claudeDesktop = JSON.stringify(
    {
      mcpServers: {
        eleventory: {
          command: "eleventory-mcp",
          env: { ELEVENTORY_API_URL: API_URL, ELEVENTORY_API_TOKEN: token },
        },
      },
    },
    null,
    2,
  );

  const generic = `Command:      eleventory-mcp
Transport:    stdio
Environment:
  ELEVENTORY_API_URL=${API_URL}
  ELEVENTORY_API_TOKEN=${token}`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const label = name.trim();
    if (!label) return;

    create.mutate(
      { name: label, mode },
      {
        onSuccess: (result) => {
          setFresh(result);
          setName("");
          toast.success("Connection created — copy the token now.");
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-6" />
        </span>
        <div>
          <h1 className="text-page-title font-semibold text-text-primary">AI assistant (MCP)</h1>
          <p className="max-w-3xl text-sm text-text-secondary">
            Connect Claude or another AI assistant to this store. It can look things up, answer questions about sales
            and customers, and — if you allow it — make changes, always as your staff user and within your permissions.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <KeyRound className="size-5" />, title: "1. Create a connection", text: "Give it a name and choose read-only or full access. You get a token once." },
          { icon: <Plug className="size-5" />, title: "2. Add it to your AI client", text: "Copy the ready-made command or config below into Claude Code or Claude Desktop." },
          { icon: <ShieldCheck className="size-5" />, title: "3. Ask in plain language", text: "“How were sales this week?”, “Add 20 units of SKU …”, “Ship order 1042”." },
        ].map((step) => (
          <div key={step.title} className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">{step.icon}</div>
            <p className="font-medium text-text-primary">{step.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{step.text}</p>
          </div>
        ))}
      </div>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="mcp-name">Name</Label>
              <Input id="mcp-name" value={name} placeholder="e.g. Claude Desktop on my laptop" maxLength={60} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Access</Label>
              <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Access level">
                {(
                  [
                    ["read_only", "Read-only"],
                    ["full", "Full access"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                      mode === value ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" loading={create.isPending} disabled={name.trim() === ""}>
              <KeyRound />
              Create connection
            </Button>
          </form>

          {mode === "full" ? (
            <Alert variant="warning">
              <AlertDescription>
                Full access lets the assistant change data (products, stock, orders) as you. Start with read-only if you
                are unsure.
              </AlertDescription>
            </Alert>
          ) : null}

          {fresh ? (
            <div className="space-y-2 rounded-md border border-success/40 bg-success/5 p-4">
              <p className="text-sm font-medium text-text-primary">
                Token for “{fresh.connection.name}” — copy it now, it will not be shown again.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-surface px-2 py-1.5 text-xs">{fresh.token}</code>
                <CopyButton text={fresh.token} label="Copy token" />
                <Button type="button" size="sm" variant="ghost" onClick={() => setFresh(null)}>
                  Done
                </Button>
              </div>
              <p className="text-xs text-text-muted">The setup snippets below now include this token.</p>
            </div>
          ) : null}

          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (connections ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-text-muted">
              No connections yet. Create one to get a token.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(connections ?? []).map((connection: McpConnection) => (
                <li key={connection.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{connection.name}</p>
                    <p className="text-xs text-text-muted">
                      Created {timeAgo(connection.created_at)} ·{" "}
                      {connection.last_used_at ? `last used ${timeAgo(connection.last_used_at)}` : "never used"}
                    </p>
                  </div>
                  <Badge variant={connection.mode === "full" ? "warning" : "info"}>
                    {connection.mode === "full" ? "Full access" : "Read-only"}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Revoke ${connection.name}`}
                    loading={revoke.isPending && revoke.variables === connection.id}
                    onClick={() => {
                      if (window.confirm(`Revoke “${connection.name}”? Anything using this token loses access immediately.`)) {
                        revoke.mutate(connection.id);
                      }
                    }}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Connect your AI client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tab !== "connector" ? (
          <div className="space-y-2 rounded-md bg-shop-tint p-4 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">One-time install on the computer that runs your AI client</p>
            <Code>{`cd mcp-server\nnpm install\nnpm link`}</Code>
            <p className="text-xs text-text-muted">
              This provides the global <code>eleventory-mcp</code> command. The <code>mcp-server</code> folder is in the
              Eleventory project.
            </p>
          </div>
          ) : null}

          <div className="flex gap-1 border-b border-border" role="tablist" aria-label="AI client">
            {(
              [
                ["connector", "Claude connector (web & desktop)"],
                ["claude-code", "Claude Code"],
                ["claude-desktop", "Claude Desktop"],
                ["other", "Other MCP client"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                  tab === id ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "connector" ? (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                The easiest way: add Eleventory as a <strong>custom connector</strong> in Claude (claude.ai or the desktop app). Nothing needs to
                be installed.
              </p>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                <li>
                  In Claude open <strong>Settings → Connectors → Add custom connector</strong>.
                </li>
                <li>
                  Name: <code className="rounded bg-shop-tint px-1.5 py-0.5 text-xs">elevendollar</code> (anything you like).
                </li>
                <li>Paste the connector URL below as the server URL, leave the sign-in settings empty, and press Continue.</li>
              </ol>
              <Code>{connectorUrl}</Code>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={connectorUrl} label="Copy connector URL" />
                {!fresh ? (
                  <span className="text-xs text-text-muted">Create a connection above to get your URL — it includes the token.</span>
                ) : null}
              </div>
              <Alert variant="warning">
                <AlertDescription>
                  Treat this URL like a password: anyone who has it can use the connection&apos;s access. If it leaks, revoke
                  the connection above and create a new one.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {tab === "claude-code" ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Run this once in a terminal:</p>
              <Code>{claudeCode}</Code>
              <CopyButton text={claudeCode} label="Copy command" />
            </div>
          ) : null}

          {tab === "claude-desktop" ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                Add to <code>claude_desktop_config.json</code> (Windows: <code>%APPDATA%\Claude</code>), then restart Claude
                Desktop:
              </p>
              <Code>{claudeDesktop}</Code>
              <CopyButton text={claudeDesktop} label="Copy config" />
            </div>
          ) : null}

          {tab === "other" ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Any client that can launch a stdio MCP server:</p>
              <Code>{generic}</Code>
              <CopyButton text={generic} label="Copy settings" />
            </div>
          ) : null}

          {!fresh ? (
            <p className="text-xs text-text-muted">
              Replace <code>&lt;paste-your-token&gt;</code> with a token from a new connection above.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>What the assistant can do</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TOOL_GROUPS.map((group) => (
              <div key={group.title} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-text-primary">{group.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{group.items}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted">
            Read-only connections can use every look-up and report but are blocked from all changes by the server itself.
            Deleting products and cancelling orders are never enabled unless you start the client with
            <code> ELEVENTORY_ALLOW_DESTRUCTIVE=1</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
