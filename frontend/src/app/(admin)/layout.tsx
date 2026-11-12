"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthToken } from "@/lib/auth-token";
import { useCurrentUser } from "@/hooks/use-auth";
import { brandFontClasses } from "@/lib/brand-fonts";
import { BrandSurface } from "@/components/shared/brand-surface";
import { AdminShell } from "@/components/layout/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";

function AuthGateSkeleton() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-3 px-6">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const token = useAuthToken();
  const { data: user, isLoading, isError } = useCurrentUser();

  useEffect(() => {
    // One-time client-mount flag. Without deferring by a render cycle,
    // the redirect effect below could run on the very first hydration
    // commit — before useAuthToken has finished syncing from
    // localStorage — and incorrectly bounce an already logged-in user
    // straight back to /login on a hard page reload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!token || isError)) {
      router.replace("/login");
    }
  }, [mounted, token, isError, router]);

  if (!mounted || !token || isLoading) {
    return (
      <BrandSurface fontClassName={brandFontClasses}>
        <AuthGateSkeleton />
      </BrandSurface>
    );
  }

  return (
    <BrandSurface fontClassName={brandFontClasses}>
      <AdminShell user={user}>{children}</AdminShell>
    </BrandSurface>
  );
}
