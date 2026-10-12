"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { useRegisterStaff, useResendVerification } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

const schema = z
  .object({
    name: z.string().min(2, "Enter your full name.").max(255),
    email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters."),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: "The two passwords do not match.",
    path: ["password_confirmation"],
  });

type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const registerStaff = useRegisterStaff();
  const resend = useResendVerification();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const serverError = registerStaff.error instanceof ApiError ? registerStaff.error : null;
  const fieldError = (name: string) => serverError?.errors?.[name]?.[0];
  const done = registerStaff.data;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-3 text-center">
          <Logo className="justify-center" iconSize={40} textClassName="text-display font-semibold" />
          <h1 className="text-page-title font-semibold text-text-primary">Create your account</h1>
          <p className="text-sm text-text-secondary">
            Sign up for the store dashboard. You will confirm your email address, then an administrator gives you
            access.
          </p>
        </div>

        {done ? (
          <div className="space-y-4 rounded-lg border border-border bg-surface p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <MailCheck className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium text-text-primary">
                {done.verification_sent ? "Check your email" : "Account created"}
              </p>
              <p className="text-sm text-text-secondary">
                {done.verification_sent ? (
                  <>
                    We sent a verification link to <strong>{done.email}</strong>. Open it to activate your account, then
                    sign in.
                  </>
                ) : (
                  "We could not send the verification email just now. Use the button below to try again, or ask an administrator to verify your account."
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
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit((values) => registerStaff.mutate(values))} className="space-y-4" noValidate>
            {serverError && Object.keys(serverError.errors ?? {}).length === 0 ? (
              <Alert variant="danger">
                <AlertDescription>{serverError.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
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

            <Button type="submit" className="w-full" loading={registerStaff.isPending}>
              Create account
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
