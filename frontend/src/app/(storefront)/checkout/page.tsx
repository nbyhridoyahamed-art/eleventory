"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Check, Lock, Package, ShoppingCart } from "lucide-react";
import { z } from "zod";

import { trackEvent } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/types/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/storefront/page-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useStorefrontDeliveryQuote,
  useStorefrontDistricts,
  useStorefrontDivisions,
  useStorefrontUpazilas,
} from "@/hooks/use-storefront-catalog";
import { useStorefrontCheckout } from "@/hooks/use-storefront-checkout";
import { useCartStore } from "@/stores/cart-store";

const checkoutSchema = z.object({
  customer_name: z.string().min(1, "Name is required."),
  customer_phone: z.string().min(1, "Phone number is required."),
  customer_email: z.string().email("Enter a valid email address.").or(z.literal("")),
  shipping_recipient_name: z.string().min(1, "Recipient name is required."),
  shipping_phone: z.string().min(1, "Phone number is required."),
  shipping_address_line: z.string().min(1, "Address is required."),
  shipping_bd_division_id: z.string(),
  shipping_bd_district_id: z.string(),
  shipping_bd_upazila_id: z.string(),
  notes: z.string(),
  coupon_code: z.string(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

/** A numbered form card: a tinted title strip over the fields. */
function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-surface">
      <h2 className="flex items-center gap-3 border-b border-border bg-shop-tint px-5 py-3 text-sm font-semibold uppercase tracking-wide text-text-primary">
        <span className="flex size-6 items-center justify-center rounded-full bg-shop-accent text-xs font-bold text-shop-on-accent">
          {step}
        </span>
        {title}
      </h2>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCartStore();
  const checkout = useStorefrontCheckout();

  // Mount-only: fires once per checkout page visit, reading the cart
  // imperatively (rather than depending on the reactive `items` above) so
  // later quantity/line changes never re-trigger it.
  useEffect(() => {
    if (useCartStore.getState().items.length > 0) {
      trackEvent("checkout_start");
    }
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      shipping_recipient_name: "",
      shipping_phone: "",
      shipping_address_line: "",
      shipping_bd_division_id: "",
      shipping_bd_district_id: "",
      shipping_bd_upazila_id: "",
      notes: "",
      coupon_code: "",
    },
  });

  const divisionId = useWatch({ control, name: "shipping_bd_division_id" });
  const districtId = useWatch({ control, name: "shipping_bd_district_id" });
  const upazilaId = useWatch({ control, name: "shipping_bd_upazila_id" });

  const { data: divisions } = useStorefrontDivisions();
  const { data: districts } = useStorefrontDistricts(divisionId ? Number(divisionId) : null);
  const { data: upazilas } = useStorefrontUpazilas(districtId ? Number(districtId) : null);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const currencyCode = items[0]?.currencyCode ?? "BDT";

  const { data: shippingQuote, isFetching: isQuotingShipping } = useStorefrontDeliveryQuote(
    divisionId ? Number(divisionId) : null,
    districtId ? Number(districtId) : null,
    subtotal,
  );
  const shippingAmount = shippingQuote?.shipping_amount ?? 0;

  const onSubmit = (values: CheckoutFormValues) => {
    checkout.mutate(
      {
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_email: values.customer_email || undefined,
        shipping_recipient_name: values.shipping_recipient_name,
        shipping_phone: values.shipping_phone,
        shipping_address_line: values.shipping_address_line,
        shipping_bd_division_id: values.shipping_bd_division_id ? Number(values.shipping_bd_division_id) : undefined,
        shipping_bd_district_id: values.shipping_bd_district_id ? Number(values.shipping_bd_district_id) : undefined,
        shipping_bd_upazila_id: values.shipping_bd_upazila_id ? Number(values.shipping_bd_upazila_id) : undefined,
        notes: values.notes || undefined,
        coupon_code: values.coupon_code || undefined,
        items: items.map((item) => ({
          product_id: item.productId,
          product_variant_id: item.variantId ?? undefined,
          quantity: item.quantity,
        })),
      },
      {
        onSuccess: (order) => {
          clear();
          router.push(`/order-confirmation/${order.uuid}`);
        },
      },
    );
  };

  if (items.length === 0) {
    return (
      <div>
        <PageBanner title="Checkout" crumbs={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-4 px-4 py-20 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-shop-tint text-shop-ink">
            <ShoppingCart className="size-9" />
          </span>
          <h2 className="text-section font-semibold text-text-primary">Your cart is empty</h2>
          <p className="text-sm text-text-secondary">Add something to your cart before checking out.</p>
          <Link
            href="/products"
            className="bg-shop-accent px-8 py-3 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const serverError = checkout.error instanceof ApiError ? checkout.error.message : null;

  return (
    <div>
      <PageBanner title="Checkout" crumbs={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />

      <div className="mx-auto max-w-[1400px] px-4 py-8">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 desktop:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          {serverError ? (
            <Alert variant="danger">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <Section step={1} title="Contact information">
            <div className="grid gap-4 tablet:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer_name">Full name</Label>
                <Input id="customer_name" error={Boolean(errors.customer_name)} {...register("customer_name")} />
                {errors.customer_name ? <p className="text-xs text-danger">{errors.customer_name.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer_phone">Phone</Label>
                <Input id="customer_phone" error={Boolean(errors.customer_phone)} {...register("customer_phone")} />
                {errors.customer_phone ? (
                  <p className="text-xs text-danger">{errors.customer_phone.message}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer_email">Email (optional)</Label>
              <Input
                id="customer_email"
                type="email"
                error={Boolean(errors.customer_email)}
                {...register("customer_email")}
              />
              {errors.customer_email ? <p className="text-xs text-danger">{errors.customer_email.message}</p> : null}
            </div>
          </Section>

          <Section step={2} title="Shipping address">
            <div className="grid gap-4 tablet:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shipping_recipient_name">Recipient name</Label>
                <Input
                  id="shipping_recipient_name"
                  error={Boolean(errors.shipping_recipient_name)}
                  {...register("shipping_recipient_name")}
                />
                {errors.shipping_recipient_name ? (
                  <p className="text-xs text-danger">{errors.shipping_recipient_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shipping_phone">Phone</Label>
                <Input id="shipping_phone" error={Boolean(errors.shipping_phone)} {...register("shipping_phone")} />
                {errors.shipping_phone ? (
                  <p className="text-xs text-danger">{errors.shipping_phone.message}</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shipping_address_line">Address</Label>
              <Textarea
                id="shipping_address_line"
                rows={2}
                error={Boolean(errors.shipping_address_line)}
                {...register("shipping_address_line")}
              />
              {errors.shipping_address_line ? (
                <p className="text-xs text-danger">{errors.shipping_address_line.message}</p>
              ) : null}
            </div>
            <div className="grid gap-3 tablet:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="checkout-shipping-division">Division</Label>
                <Select
                  value={divisionId}
                  onValueChange={(v) => {
                    setValue("shipping_bd_division_id", v);
                    setValue("shipping_bd_district_id", "");
                    setValue("shipping_bd_upazila_id", "");
                  }}
                >
                  <SelectTrigger id="checkout-shipping-division">
                    <SelectValue placeholder="Select">
                      {divisions?.find((d) => String(d.id) === divisionId)?.name_en}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {divisions?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkout-shipping-district">District</Label>
                <Select
                  value={districtId}
                  onValueChange={(v) => {
                    setValue("shipping_bd_district_id", v);
                    setValue("shipping_bd_upazila_id", "");
                  }}
                >
                  <SelectTrigger id="checkout-shipping-district" disabled={!divisionId}>
                    <SelectValue placeholder="Select">
                      {districts?.find((d) => String(d.id) === districtId)?.name_en}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {districts?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkout-shipping-upazila">Upazila</Label>
                <Select value={upazilaId} onValueChange={(v) => setValue("shipping_bd_upazila_id", v)}>
                  <SelectTrigger id="checkout-shipping-upazila" disabled={!districtId}>
                    <SelectValue placeholder="Select">
                      {upazilas?.find((u) => String(u.id) === upazilaId)?.name_en}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {upazilas?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Order notes (optional)</Label>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </div>
          </Section>

          <Section step={3} title="Payment method">
            <div className="flex items-center gap-3 border-2 border-shop-accent bg-shop-tint p-4">
              <span className="flex size-5 items-center justify-center rounded-full bg-shop-accent text-shop-on-accent">
                <Check className="size-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Cash on Delivery</p>
                <p className="text-xs text-text-secondary">Pay in cash when your order arrives. Check your parcel before paying.</p>
              </div>
            </div>
          </Section>
        </div>

        <aside className="space-y-4 self-start desktop:sticky desktop:top-32">
          <div className="border border-border bg-surface">
            <h2 className="flex items-center justify-between border-b border-border bg-shop-tint px-5 py-3 text-sm font-semibold uppercase tracking-wide text-text-primary">
              Your order
              <Link href="/cart" className="text-xs font-medium normal-case tracking-normal text-shop-ink hover:underline">
                Edit cart
              </Link>
            </h2>

            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <li key={`${item.productId}:${item.variantId ?? "0"}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="relative flex size-14 shrink-0 items-center justify-center border border-border bg-white p-1">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
                      <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Package className="size-5 text-text-muted" />
                    )}
                    <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-shop-nav text-[11px] font-semibold text-shop-on-nav">
                      {item.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm text-text-primary">{item.name}</span>
                    {item.variantLabel ? <span className="block text-xs text-text-muted">{item.variantLabel}</span> : null}
                  </span>
                  <span className="shrink-0 text-sm font-medium text-text-primary">
                    {formatMoney(item.unitPrice * item.quantity, item.currencyCode)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-border p-5">
              <div className="space-y-1.5">
                <Label htmlFor="coupon_code">Have a coupon?</Label>
                <Input id="coupon_code" placeholder="Enter code" {...register("coupon_code")} />
              </div>

              <dl className="space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(subtotal, currencyCode)}</dd>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <dt>Shipping</dt>
                  <dd>
                    {!divisionId
                      ? "Enter your address"
                      : isQuotingShipping
                        ? "Calculating…"
                        : formatMoney(shippingAmount, currencyCode)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-text-primary">
                  <dt>Total</dt>
                  <dd className="text-shop-ink">{formatMoney(subtotal + shippingAmount, currencyCode)}</dd>
                </div>
              </dl>

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-none bg-shop-accent text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
                loading={checkout.isPending}
              >
                Place order
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <Lock className="size-3.5" />
                Cash on Delivery. You only pay when your order arrives.
              </p>
            </div>
          </div>
        </aside>
      </form>
      </div>
    </div>
  );
}
