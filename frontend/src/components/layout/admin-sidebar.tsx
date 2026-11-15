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
        "sticky top-0 hidden h-screen shrink-0 flex-col self-start border-r border-white/5 bg-[var(--brand-rail)] transition-[width] duration-200 md:flex",
        sidebarCollapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 overflow-hidden"
        >
          {sidebarCollapsed ? (
            <LogoMark size={36} tone="reverse" />
          ) : (
            <Logo iconSize={30} tone="reverse" />
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SidebarNav collapsed={sidebarCollapsed} />
      </div>

      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-[var(--brand-rail-muted)] hover:bg-white/10 hover:text-white"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>
    </aside>
  );
}
