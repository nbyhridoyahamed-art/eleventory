import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/shared/logo";
import { MULTI_STORE } from "@/lib/store-host";

/**
 * Platform legal pages and help centre. They belong to the multi-store platform, so on the
 * single-store site (MULTI_STORE off) they do not exist.
 */
export default function PlatformInfoLayout({ children }: { children: React.ReactNode }) {
  if (!MULTI_STORE) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <nav className="flex gap-5 text-sm text-text-secondary">
            <Link href="/help" className="hover:text-text-primary">Help</Link>
            <Link href="/legal/terms" className="hover:text-text-primary">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-text-primary">Privacy</Link>
            <Link href="/legal/dpa" className="hover:text-text-primary">DPA</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
