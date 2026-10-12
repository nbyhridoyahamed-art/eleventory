import { redirect } from "next/navigation";

export default function OrdersIndexPage() {
  redirect("/dashboard/orders/orders");
}
