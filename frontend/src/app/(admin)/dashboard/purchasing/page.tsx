import { redirect } from "next/navigation";

export default function PurchasingIndexPage() {
  redirect("/dashboard/purchasing/purchase-orders");
}
