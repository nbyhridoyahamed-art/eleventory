import { redirect } from "next/navigation";

export default function CatalogIndexPage() {
  redirect("/dashboard/catalog/products");
}
