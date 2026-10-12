"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/shared/logo";

export function AdminSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col self-start border-r border-border bg-surface transition-[width] duration-200 md:flex",
        sidebarCollapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          {sidebarCollapsed ? <LogoMark size={32} /> : <Logo />}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {sidebarCollapsed ? null : <SidebarNav />}
      </div>

      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
    </aside>
  );
}
