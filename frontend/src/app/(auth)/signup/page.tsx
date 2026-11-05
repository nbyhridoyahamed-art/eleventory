"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, MailCheck, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { useResendVerification, useSignupStore, useSlugAvailable } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

const schema = z
  .object({
    store_name: z.string().min(2, "Enter your store name.").max(80),
    store_slug: z
      .string()
      .min(3, "Use at least 3 characters.")
      .max(40)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only."),
    name: z.string().min(2, "Enter your full name.").max(255),
    email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
    phone: z.string().optional(),
    password: z.string().min(8, "Use at least 8 characters."),
    password_confirmation: z.string(),
    accept_terms: z.boolean().refine((v) => v, "You need to accept the terms to continue."),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: "The two passwords do not match.",
    path: ["password_confirmation"],
  });

type Values = z.infer<typeof schema>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function SignupPage() {
  const signup = useSignupStore();
  const resend = useResendVerification();
  const [slugTouched, setSlugTouched] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { accept_terms: false } });

  const storeName = useWatch({ control, name: "store_name" }) ?? "";
  const storeSlug = useWatch({ control, name: "store_slug" }) ?? "";

  // Until the person edits the address themselves, it follows the store name.
  useEffect(() => {
    if (!slugTouched) setValue("store_slug", slugify(storeName), { shouldValidate: storeName.length > 0 });
  }, [storeName, slugTouched, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(storeSlug), 400);
    return () => clearTimeout(timer);
  }, [storeSlug]);

  const slugCheck = useSlugAvailable(debouncedSlug);
  const slugSettled = debouncedSlug === storeSlug && slugCheck.data?.slug === storeSlug;

  const serverError = signup.error instanceof ApiError ? signup.error : null;
  const fieldError = (name: string) => serverError?.errors?.[name]?.[0];
  const done = signup.data;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <Logo className="justify-center" iconSize={40} textClassName="text-display font-semibold" />
          <h1 className="text-page-title font-semibold text-text-primary">Start your online store</h1>
          <p className="text-sm text-text-secondary">
            Create your account and your store in one step. Confirm your email, then add your first products.
          </p>
        </div>

        {done ? (
          <div className="space-y-4 rounded-lg border border-border bg-surface p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <MailCheck className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium text-text-primary">
                {done.verification_sent ? "Your store is ready — check your email" : "Your store is ready"}
              </p>
              <p className="text-sm text-text-secondary">
                {done.verification_sent ? (
                  <>
                    We sent a verification link to <strong>{done.email}</strong>. Open it, then sign in to set up{" "}
                    <strong>{done.store.name}</strong>.
                  </>
                ) : (
                  "We could not send the verification email just now. Use the button below to try again."
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              loading={resend.isPending}
              onClick={() => resend.mutate(done.email)}
            >
              {resend.isSuccess ? "Sent again — check your inbox" : "Resend verification email"}
            </Button>
            <Link href="/login" className="block text-sm font-medium text-primary hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit((values) => signup.mutate(values))} className="space-y-4" noValidate>
            {serverError && Object.keys(serverError.errors ?? {}).length === 0 ? (
              <Alert variant="danger">
                <AlertDescription>{serverError.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="store_name">Store name</Label>
              <Input
                id="store_name"
                placeholder="Rahim Gadgets"
                error={Boolean(errors.store_name || fieldError("store_name"))}
                {...register("store_name")}
              />
              {errors.store_name ?? fieldError("store_name") ? (
                <p className="text-xs text-danger">{errors.store_name?.message ?? fieldError("store_name")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store_slug">Store address</Label>
              <Input
                id="store_slug"
                autoComplete="off"
                error={Boolean(errors.store_slug || fieldError("store_slug"))}
                {...register("store_slug", { onChange: () => setSlugTouched(true) })}
              />
              {errors.store_slug ?? fieldError("store_slug") ? (
                <p className="text-xs text-danger">{errors.store_slug?.message ?? fieldError("store_slug")}</p>
              ) : slugSettled && slugCheck.data ? (
                slugCheck.data.available ? (
                  <p className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" /> {storeSlug} is available
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-xs text-danger">
                    <X className="size-3.5" /> {slugCheck.data.reason}
                  </p>
                )
              ) : (
                <p className="text-xs text-text-secondary">Your shop will live at this address.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Your full name</Label>
              <Input id="name" autoComplete="name" error={Boolean(errors.name || fieldError("name"))} {...register("name")} />
              {errors.name ?? fieldError("name") ? (
                <p className="text-xs text-danger">{errors.name?.message ?? fieldError("name")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                error={Boolean(errors.email || fieldError("email"))}
                {...register("email")}
              />
              {errors.email ?? fieldError("email") ? (
                <p className="text-xs text-danger">{errors.email?.message ?? fieldError("email")}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number (optional)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                error={Boolean(fieldError("phone"))}
                {...register("phone")}
              />
              {fieldError("phone") ? <p className="text-xs text-danger">{fieldError("phone")}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  error={Boolean(errors.password || fieldError("password"))}
                  {...register("password")}
                />
                {errors.password ?? fieldError("password") ? (
                  <p className="text-xs text-danger">{errors.password?.message ?? fieldError("password")}</p>
                ) : null}
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
            </div>

            <div className="space-y-1">
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input type="checkbox" className="mt-0.5 size-4" {...register("accept_terms")} />
                <span>I agree to the Terms of Service and Privacy Policy.</span>
              </label>
              {errors.accept_terms ?? fieldError("accept_terms") ? (
                <p className="text-xs text-danger">{errors.accept_terms?.message ?? fieldError("accept_terms")}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" loading={signup.isPending}>
              Create my store
            </Button>

            <p className="text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
