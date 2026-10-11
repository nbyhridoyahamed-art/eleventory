"use client";

import { useState } from "react";
import { Mail, MessageSquare, Save, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useNotificationLogs,
  useNotificationSettings,
  useSaveNotificationSettings,
  useSmsBalance,
  useTestEmail,
  useTestSms,
  type NotificationSettingsResponse,
} from "@/hooks/use-notification-settings";
import { PermissionDenied } from "@/components/permission-denied";
import { Field, SeoCard, ToggleRow } from "@/components/seo/seo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { NotificationLogEntry } from "@/hooks/use-notification-settings";

type Tab = "connection" | "messages" | "log";

const TABS: { id: Tab; label: string }[] = [
  { id: "connection", label: "Connection" },
  { id: "messages", label: "Events & messages" },
  { id: "log", label: "Send log" },
];

const PLACEHOLDERS = ["{customer}", "{order_number}", "{store}", "{status}", "{tracking}", "{return_number}"];

export default function NotificationSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data, isLoading } = useNotificationSettings(storeId);
  const [tab, setTab] = useState<Tab>("connection");

  if (currentUser && !can(currentUser, "settings.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !data || !storeId) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 border-b border-border pb-3" role="tablist" aria-label="Notification sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.id ? "bg-surface-secondary text-text-primary" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "connection" ? <ConnectionTab key={JSON.stringify([data.settings.sms, data.settings.email])} storeId={storeId} data={data} /> : null}
      {tab === "messages" ? <MessagesTab key="messages" storeId={storeId} data={data} /> : null}
      {tab === "log" ? <LogTab storeId={storeId} /> : null}
    </div>
  );
}

function ConnectionTab({ storeId, data }: { storeId: number; data: NotificationSettingsResponse }) {
  const { sms, email } = data.settings;
  const save = useSaveNotificationSettings(storeId);
  const balance = useSmsBalance(storeId);
  const testSms = useTestSms(storeId);
  const testEmail = useTestEmail(storeId);

  const [smsDraft, setSmsDraft] = useState({ enabled: sms.enabled, api_key: "", sender_id: sms.sender_id ?? "" });
  const [emailDraft, setEmailDraft] = useState({
    enabled: email.enabled,
    host: email.host ?? "",
    port: String(email.port ?? 587),
    encryption: email.encryption ?? "tls",
    username: email.username ?? "",
    password: "",
    from_address: email.from_address ?? "",
    from_name: email.from_name ?? "",
  });
  const [phone, setPhone] = useState("");
  const [testTo, setTestTo] = useState("");

  const saveSms = () =>
    save.mutate({
      sms: { enabled: smsDraft.enabled, api_key: smsDraft.api_key, sender_id: smsDraft.sender_id || null },
    });

  const saveEmail = () =>
    save.mutate({
      email: {
        enabled: emailDraft.enabled,
        host: emailDraft.host || null,
        port: Number(emailDraft.port) || 587,
        encryption: emailDraft.encryption,
        username: emailDraft.username || null,
        password: emailDraft.password,
        from_address: emailDraft.from_address || null,
        from_name: emailDraft.from_name || null,
      },
    });

  return (
    <div className="space-y-6">
      <SeoCard
        title="SMS — BulkSMSBD"
        description="Order and return updates are texted to customers through your BulkSMSBD account."
        action={
          <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
            <MessageSquare className="size-4" />
            bulksmsbd.net
          </span>
        }
      >
        <ToggleRow
          id="sms-enabled"
          label="Send SMS notifications"
          hint="Off by default. Nothing is texted until you turn this on and save."
          checked={smsDraft.enabled}
          onChange={(enabled) => setSmsDraft({ ...smsDraft, enabled })}
        />
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label="API key" htmlFor="sms-api-key" hint="From your BulkSMSBD dashboard. Stored encrypted, never shown again.">
            <Input
              id="sms-api-key"
              type="password"
              autoComplete="new-password"
              value={smsDraft.api_key}
              placeholder={sms.has_api_key ? "•••••• saved — leave blank to keep" : ""}
              onChange={(event) => setSmsDraft({ ...smsDraft, api_key: event.target.value })}
            />
          </Field>
          <Field label="Sender ID" htmlFor="sms-sender-id" hint="The approved sender ID or masking name on your account.">
            <Input
              id="sms-sender-id"
              value={smsDraft.sender_id}
              placeholder="e.g. 8809617XXXXXX"
              onChange={(event) => setSmsDraft({ ...smsDraft, sender_id: event.target.value })}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" loading={save.isPending} onClick={saveSms}>
            <Save />
            Save SMS settings
          </Button>
          <Button type="button" variant="outline" disabled={!sms.has_api_key} loading={balance.isPending} onClick={() => balance.mutate()}>
            Check balance
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <Field label="Send a test SMS to" htmlFor="sms-test-phone">
            <Input id="sms-test-phone" className="w-56" placeholder="01XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={!sms.has_api_key || phone.trim() === ""}
            loading={testSms.isPending}
            onClick={() => testSms.mutate(phone.trim())}
          >
            <Send />
            Send test SMS
          </Button>
        </div>
      </SeoCard>

      <SeoCard
        title="Email — SMTP"
        description="Emails are sent through your own mail server (your host, Gmail, Zoho, Brevo SMTP and so on)."
        action={
          <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
            <Mail className="size-4" />
            SMTP
          </span>
        }
      >
        <ToggleRow
          id="email-enabled"
          label="Send email notifications"
          hint="Off by default. Nothing is emailed until you turn this on and save."
          checked={emailDraft.enabled}
          onChange={(enabled) => setEmailDraft({ ...emailDraft, enabled })}
        />

        <div className="grid gap-4 tablet:grid-cols-3">
          <div className="tablet:col-span-2">
            <Field label="SMTP host" htmlFor="smtp-host">
              <Input
                id="smtp-host"
                value={emailDraft.host}
                placeholder="smtp.example.com"
                onChange={(event) => setEmailDraft({ ...emailDraft, host: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Port" htmlFor="smtp-port">
            <Input id="smtp-port" inputMode="numeric" value={emailDraft.port} onChange={(event) => setEmailDraft({ ...emailDraft, port: event.target.value })} />
          </Field>
          <Field label="Encryption" htmlFor="smtp-encryption" hint="TLS for port 587, SSL for port 465.">
            <Select value={emailDraft.encryption} onValueChange={(value) => setEmailDraft({ ...emailDraft, encryption: value as "tls" | "ssl" | "none" })}>
              <SelectTrigger id="smtp-encryption">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS (STARTTLS)</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Username" htmlFor="smtp-username">
            <Input id="smtp-username" autoComplete="off" value={emailDraft.username} onChange={(event) => setEmailDraft({ ...emailDraft, username: event.target.value })} />
          </Field>
          <Field label="Password" htmlFor="smtp-password">
            <Input
              id="smtp-password"
              type="password"
              autoComplete="new-password"
              value={emailDraft.password}
              placeholder={email.has_password ? "•••••• saved — leave blank to keep" : ""}
              onChange={(event) => setEmailDraft({ ...emailDraft, password: event.target.value })}
            />
          </Field>
          <Field label="From address" htmlFor="smtp-from">
            <Input
              id="smtp-from"
              type="email"
              value={emailDraft.from_address}
              placeholder="orders@yourstore.com"
              onChange={(event) => setEmailDraft({ ...emailDraft, from_address: event.target.value })}
            />
          </Field>
          <Field label="From name" htmlFor="smtp-from-name">
            <Input id="smtp-from-name" value={emailDraft.from_name} placeholder="Your store" onChange={(event) => setEmailDraft({ ...emailDraft, from_name: event.target.value })} />
          </Field>
        </div>

        <div>
          <Button type="button" loading={save.isPending} onClick={saveEmail}>
            <Save />
            Save email settings
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <Field label="Send a test email to" htmlFor="email-test-to">
            <Input id="email-test-to" type="email" className="w-64" placeholder="you@example.com" value={testTo} onChange={(event) => setTestTo(event.target.value)} />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={!email.host || testTo.trim() === ""}
            loading={testEmail.isPending}
            onClick={() => testEmail.mutate(testTo.trim())}
          >
            <Send />
            Send test email
          </Button>
          <p className="basis-full text-xs text-text-muted">Save your settings first — the test uses the saved SMTP details.</p>
        </div>
      </SeoCard>
    </div>
  );
}

function MessagesTab({ storeId, data }: { storeId: number; data: NotificationSettingsResponse }) {
  const save = useSaveNotificationSettings(storeId);
  const [events, setEvents] = useState(data.settings.events);
  const [templates, setTemplates] = useState(data.settings.templates);

  return (
    <div className="space-y-6">
      <SeoCard
        title="Which events notify customers"
        description="Choose what is sent for each event. SMS and email also need to be turned on in the Connection tab."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="w-24 py-2 pr-4 font-medium">SMS</th>
                <th className="w-24 py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.key} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-text-primary">{event.label}</td>
                  {(["sms", "email"] as const).map((channel) => (
                    <td key={channel} className="py-2.5 pr-4">
                      <Checkbox
                        aria-label={`${event.label} by ${channel}`}
                        checked={events[event.key]?.[channel] ?? true}
                        onCheckedChange={(value) =>
                          setEvents({ ...events, [event.key]: { ...events[event.key], [channel]: value === true } })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeoCard>

      <SeoCard
        title="Message wording"
        description="Leave a box empty to use the standard wording. Placeholders are filled in when the message is sent."
      >
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((placeholder) => (
            <code key={placeholder} className="rounded bg-shop-tint px-1.5 py-0.5 text-xs text-text-secondary">
              {placeholder}
            </code>
          ))}
        </div>

        <div className="space-y-5">
          {data.events.map((event) => {
            const template = templates[event.key] ?? { sms: null, email_subject: null, email_body: null };
            const set = (patch: Partial<typeof template>) =>
              setTemplates({ ...templates, [event.key]: { ...template, ...patch } });

            return (
              <div key={event.key} className="space-y-3 rounded-md border border-border p-4">
                <p className="text-sm font-semibold text-text-primary">{event.label}</p>
                <div className="space-y-1.5">
                  <Label htmlFor={`tpl-sms-${event.key}`}>SMS text</Label>
                  <Textarea
                    id={`tpl-sms-${event.key}`}
                    rows={2}
                    value={template.sms ?? ""}
                    placeholder="Standard wording"
                    onChange={(e) => set({ sms: e.target.value || null })}
                  />
                  <p className="text-xs text-text-muted">{(template.sms ?? "").length} characters — 160 per SMS segment.</p>
                </div>
                <div className="grid gap-3 tablet:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`tpl-subject-${event.key}`}>Email subject</Label>
                    <Input
                      id={`tpl-subject-${event.key}`}
                      value={template.email_subject ?? ""}
                      placeholder="Standard wording"
                      onChange={(e) => set({ email_subject: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5 tablet:col-span-2">
                    <Label htmlFor={`tpl-body-${event.key}`}>Email body</Label>
                    <Textarea
                      id={`tpl-body-${event.key}`}
                      rows={3}
                      value={template.email_body ?? ""}
                      placeholder="Standard wording"
                      onChange={(e) => set({ email_body: e.target.value || null })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <Button type="button" loading={save.isPending} onClick={() => save.mutate({ events, templates })}>
            <Save />
            Save events &amp; messages
          </Button>
        </div>
      </SeoCard>
    </div>
  );
}

function LogTab({ storeId }: { storeId: number }) {
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const { data: logs, isLoading } = useNotificationLogs(storeId, { channel, status });

  const columns: DataTableColumn<NotificationLogEntry>[] = [
    {
      id: "when",
      header: "When",
      cell: (row) => new Date(row.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    },
    { id: "channel", header: "Channel", cell: (row) => (row.channel === "sms" ? "SMS" : "Email") },
    { id: "event", header: "Event", cell: (row) => (row.event ?? "—").replace(/_/g, " ") },
    { id: "recipient", header: "To", cell: (row) => <span className="break-all">{row.recipient}</span> },
    {
      id: "content",
      header: "Content",
      cell: (row) => <span className="line-clamp-2 max-w-xs text-text-secondary">{row.message ?? row.subject ?? ""}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <div>
          <Badge variant={row.status === "sent" ? "success" : "danger"}>{row.status === "sent" ? "Sent" : "Failed"}</Badge>
          {row.error ? <p className="mt-1 max-w-xs text-xs text-danger">{row.error}</p> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-40" aria-label="Filter by channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={logs ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyState={<p className="p-6 text-center text-sm text-text-muted">No messages sent yet.</p>}
      />
    </div>
  );
}
