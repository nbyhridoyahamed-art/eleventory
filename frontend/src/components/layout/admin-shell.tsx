"use client";

import type { User } from "@/types/auth";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";

/**
 * The page itself scrolls (one scrollbar, like any website): the sidebar stays
 * pinned to the viewport and the top bar sticks to the top while content flows
 * naturally beneath it.
 */
export function AdminShell({ user, children }: { user?: User; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar user={user} />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
