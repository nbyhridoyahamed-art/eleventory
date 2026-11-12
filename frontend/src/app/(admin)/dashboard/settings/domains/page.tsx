import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreviewNotice } from "@/components/shared/preview-notice";

export const metadata = { title: "Domains" };

export default function DomainsSettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PreviewNotice />
      <p className="text-sm text-text-secondary">
        Choose the addresses shoppers use to reach your store. HTTPS is set up for you.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <div className="text-xs text-text-secondary">Free address</div>
            <div className="font-semibold">rahim-gadgets.[your-domain]</div>
          </div>
          <Badge variant="success">Active · HTTPS</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Custom domains</CardTitle>
          <Button size="sm" disabled>Add a domain</Button>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <div className="min-w-60 flex-1">
              <div className="font-semibold">www.rahimgadgets.com</div>
              <div className="text-xs text-text-secondary">Primary · added 2 days ago</div>
            </div>
            <Badge variant="success">Live · certificate valid</Badge>
            <span className="text-xs text-text-secondary">Renews in 62 days</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-6 py-4">
            <div className="min-w-60 flex-1">
              <div className="font-semibold">shop.rahim.com.bd</div>
              <div className="text-xs text-text-secondary">Added just now</div>
            </div>
            <Badge variant="warning">Waiting for DNS</Badge>
            <Button size="sm" variant="outline" disabled>Check now</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect shop.rahim.com.bd</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            At your domain provider, add this record. It can take up to a few hours to take effect. We keep checking and
            turn on HTTPS once it works.
          </p>
          <div className="overflow-hidden rounded-md border border-border text-sm">
            <div className="grid grid-cols-[100px_1fr_1fr] gap-3 bg-background px-3.5 py-2.5 font-semibold text-text-secondary">
              <span>Type</span><span>Name</span><span>Value</span>
            </div>
            <div className="grid grid-cols-[100px_1fr_1fr] gap-3 border-t border-border px-3.5 py-3 font-mono text-xs">
              <span>CNAME</span><span>shop</span><span>stores.[your-domain]</span>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="size-2 rounded-full bg-warning" /> Last checked a minute ago: record not found yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
