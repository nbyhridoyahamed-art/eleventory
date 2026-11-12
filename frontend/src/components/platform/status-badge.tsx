import type { TenantRow } from "@/hooks/use-platform";
import { Badge } from "@/components/ui/badge";

export function TenantStatusBadge({ tenant }: { tenant: Pick<TenantRow, "status" | "suspension_reason" | "subscription_status"> }) {
  if (tenant.status === "suspended") {
    return <Badge variant="danger">Suspended{tenant.suspension_reason ? ` (${tenant.suspension_reason})` : ""}</Badge>;
  }
  if (tenant.subscription_status === "trialing") return <Badge variant="warning">Trialing</Badge>;
  if (tenant.subscription_status === "past_due") return <Badge variant="danger">Payment due</Badge>;
  return <Badge variant="success">Active</Badge>;
}
