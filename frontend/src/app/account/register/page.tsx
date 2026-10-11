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
import { useCustomerRegister } from "@/hooks/use-customer-auth";

const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required."),
    phone: z.string().min(1, "Phone number is required."),
    email: z.string().email("Enter a valid email address.").or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters."),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords do not match.",
    path: ["password_confirmation"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AccountRegisterPage() {
  const register_ = useCustomerRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const serverError = register_.error instanceof ApiError ? register_.error.message : null;

  const onSubmit = (values: RegisterFormValues) => {
    register_.mutate({ ...values, email: values.email || undefined });
  };

  return (
    <div>
      <PageBanner title="Create an account" crumbs={[{ label: "Home", href: "/" }, { label: "Create account" }]}>
        <p className="max-w-md text-sm text-text-secondary">
          Already ordered as a guest? Use the same phone number to link your past orders automatically.
        </p>
      </PageBanner>

      <div className="mx-auto max-w-md px-4 py-10">
      <Panel title="New customer">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError ? (
          <Alert variant="danger">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" error={Boolean(errors.name)} {...register("name")} />
          {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
        </div>

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
          <Label htmlFor="email">Email (optional)</Label>
          <Input id="email" type="email" autoComplete="email" error={Boolean(errors.email)} {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            error={Boolean(errors.password)}
            {...register("password")}
          />
          {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password_confirmation">Confirm password</Label>
          <Input
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            error={Boolean(errors.password_confirmation)}
            {...register("password_confirmation")}
          />
          {errors.password_confirmation ? (
            <p className="text-xs text-danger">{errors.password_confirmation.message}</p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className={`w-full ${SHOP_BUTTON_PRIMARY}`} loading={register_.isPending}>
          Create account
        </Button>
      </form>
      </Panel>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/account/login" className="font-semibold text-shop-ink hover:underline">
          Sign in
        </Link>
      </p>
      </div>
    </div>
  );
}
