import { GripVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewNotice } from "@/components/shared/preview-notice";

export const metadata = { title: "Themes" };

const THEMES = [
  { name: "Classic", blurb: "Clean and bright", bg: "#EFF6FE", bar: "#2563EB", panel: "#DBEAFE", cell: "#FFFFFF", active: true },
  { name: "Midnight", blurb: "Dark and bold", bg: "#0F172A", bar: "#F59E0B", panel: "#1E293B", cell: "#334155", active: false },
  { name: "Bazaar", blurb: "Warm and busy", bg: "#FEF3C6", bar: "#C2410C", panel: "#FDE68A", cell: "#FFFBEB", active: false },
];

const SECTIONS = [
  { name: "Hero banner", visible: true },
  { name: "Featured products", visible: true },
  { name: "Shop by category", visible: true },
  { name: "Promo strip", visible: true },
  { name: "Customer reviews", visible: false },
];

export default function ThemesSettingsPage() {
  return (
    <div className="space-y-6">
      <PreviewNotice>Theme choices and homepage sections are shown with sample data. The real homepage builder is under Content.</PreviewNotice>

      <div className="grid gap-4 md:grid-cols-3">
        {THEMES.map((t) => (
          <Card key={t.name} className={t.active ? "border-2 border-primary" : undefined}>
            <div className="flex h-36 flex-col gap-2 p-3.5" style={{ background: t.bg }} aria-hidden="true">
              <div className="h-2.5 w-2/5 rounded" style={{ background: t.bar }} />
              <div className="flex-1 rounded-lg" style={{ background: t.panel }} />
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-7 flex-1 rounded-md" style={{ background: t.cell }} />
                ))}
              </div>
            </div>
            <CardContent className="flex items-center justify-between pt-4">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-text-secondary">{t.blurb}</div>
              </div>
              {t.active ? <Badge variant="success">Active</Badge> : <Button size="sm" variant="outline" disabled>Use</Button>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Customise</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand-colour">Brand colour</Label>
              <div className="flex items-center gap-3">
                <span className="size-9 rounded-md bg-primary" aria-hidden="true" />
                <Input id="brand-colour" defaultValue="#2563EB" readOnly />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-text-secondary">
                Drop a logo here or browse
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="heading-font">Heading font</Label>
              <Input id="heading-font" defaultValue="Inter" readOnly />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Homepage sections</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {SECTIONS.map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-3 rounded-lg border border-border px-3.5 py-3 text-sm ${s.visible ? "" : "bg-background"}`}
              >
                <GripVertical className="size-4 text-text-muted" aria-hidden="true" />
                <span className={s.visible ? "flex-1 font-medium" : "flex-1 text-text-secondary"}>{s.name}</span>
                <Badge variant={s.visible ? "success" : "neutral"}>{s.visible ? "Visible" : "Hidden"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
