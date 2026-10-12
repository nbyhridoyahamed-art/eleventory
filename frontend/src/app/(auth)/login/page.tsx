"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { useLogin, useResendVerification } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const login = useLogin();
  const resend = useResendVerification();
  const [verified, setVerified] = useState<string | null>(null);

  // The emailed verification link lands here as /login?verified=1 (or =invalid).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVerified(new URLSearchParams(window.location.search).get("verified"));
  }, []);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (values: LoginFormValues) => {
    login.mutate(values);
  };

  const serverError = login.error instanceof ApiError ? login.error.message : null;
  const unverified = login.error instanceof ApiError && login.error.errors?.code?.includes("email_unverified");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <Logo className="justify-center" iconSize={40} textClassName="text-display font-semibold" />
          <h1 className="text-page-title font-semibold text-text-primary">Sign in to your store</h1>
          <p className="text-sm text-text-secondary">Manage your ecommerce operations from one place.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {verified === "1" ? (
            <Alert variant="success">
              <AlertDescription>Email verified. You can sign in now.</AlertDescription>
            </Alert>
          ) : null}
          {verified === "invalid" ? (
            <Alert variant="danger">
              <AlertDescription>That verification link is not valid or has expired. Sign in to request a new one.</AlertDescription>
            </Alert>
          ) : null}
          {serverError ? (
            <Alert variant="danger">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}
          {unverified ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              loading={resend.isPending}
              onClick={() => resend.mutate(getValues("email"))}
            >
              {resend.isSuccess ? "Sent — check your inbox" : "Resend verification email"}
            </Button>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
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

          <Button type="submit" className="w-full" loading={login.isPending}>
            Sign in
          </Button>

          <p className="text-center text-sm text-text-secondary">
            New here?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
