"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/types/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageBanner } from "@/components/storefront/page-banner";
import { Panel, SHOP_BUTTON_PRIMARY } from "@/components/storefront/panel";
import { useCustomerLogin } from "@/hooks/use-customer-auth";

const loginSchema = z.object({
  phone: z.string().min(1, "Phone number is required."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AccountLoginPage() {
  const login = useCustomerLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const serverError = login.error instanceof ApiError ? login.error.message : null;

  return (
    <div>
      <PageBanner title="Sign in" crumbs={[{ label: "Home", href: "/" }, { label: "Sign in" }]}>
        <p className="text-sm text-text-secondary">Track orders, save addresses, and check out faster.</p>
      </PageBanner>

      <div className="mx-auto max-w-md px-4 py-10">
        <Panel title="Customer login">
          <form onSubmit={handleSubmit((values) => login.mutate(values))} className="space-y-4">
            {serverError ? (
              <Alert variant="danger">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="01712345678"
                error={Boolean(errors.phone)}
                {...register("phone")}
              />
              {errors.phone ? <p className="text-xs text-danger">{errors.phone.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                error={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
            </div>

            <Button type="submit" size="lg" className={`w-full ${SHOP_BUTTON_PRIMARY}`} loading={login.isPending}>
              Sign in
            </Button>
          </form>
        </Panel>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link href="/account/register" className="font-semibold text-shop-ink hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
