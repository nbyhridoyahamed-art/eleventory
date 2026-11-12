import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PreviewNotice } from "@/components/shared/preview-notice";

export const metadata = { title: "Platform: tenants" };

const STATS = [
  { label: "Stores", value: "128" },
  { label: "On trial", value: "41" },
  { label: "Paying", value: "79" },
  { label: "Suspended", value: "3" },
];

const TENANTS: { store: string; domain: string; owner: string; plan: string; status: string; variant: BadgeProps["variant"]; orders: string; action: string }[] = [
  { store: "Rahim Gadgets", domain: "rahimgadgets.com", owner: "Abdur Rahim", plan: "Trial", status: "Trialing", variant: "warning", orders: "24", action: "View as" },
  { store: "Nusrat Fashion", domain: "nusrat.[your-domain]", owner: "Nusrat Jahan", plan: "Growth", status: "Active", variant: "success", orders: "612", action: "View as" },
  { store: "Tanvir Electronics", domain: "tanvir.[your-domain]", owner: "Tanvir Hossain", plan: "Pro", status: "Active", variant: "success", orders: "1,940", action: "View as" },
  { store: "Karim Books", domain: "karimbooks.[your-domain]", owner: "Karim Uddin", plan: "Starter", status: "Suspended", variant: "danger", orders: "0", action: "Reinstate" },
];

export default function PlatformTenantsPage() {
  return (
    <div className="space-y-6">
      <PreviewNotice>Platform-admin screen with sample tenants. Only platform administrators will see it.</PreviewNotice>
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Tenants</h1>
        <p className="text-sm text-text-secondary">Every store on the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <div className="text-xs text-text-secondary">{s.label}</div>
              <div className={`mt-1 text-3xl font-bold ${s.label === "Suspended" ? "text-danger" : ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-background text-left text-text-secondary">
            <tr>
              {["Store", "Owner", "Plan", "Status", "Orders (30d)", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TENANTS.map((t) => (
              <tr key={t.store} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-semibold">{t.store}</div>
                  <div className="text-xs text-text-secondary">{t.domain}</div>
                </td>
                <td className="px-4 py-3">{t.owner}</td>
                <td className="px-4 py-3">{t.plan}</td>
                <td className="px-4 py-3"><Badge variant={t.variant}>{t.status}</Badge></td>
                <td className="px-4 py-3">{t.orders}</td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" disabled>{t.action}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
