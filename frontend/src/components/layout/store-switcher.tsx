"use client";

import { Check, ChevronsUpDown, Store as StoreIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyStores, useSwitchStore } from "@/hooks/use-auth";

/** Only shown to people who belong to more than one store. */
export function StoreSwitcher() {
  const { data } = useMyStores();
  const switchStore = useSwitchStore();

  if (!data || data.stores.length < 2) return null;

  const current = data.stores.find((store) => store.id === data.current_store_id) ?? data.stores[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-48 gap-2" aria-label="Switch store" loading={switchStore.isPending}>
          <StoreIcon className="size-4 shrink-0" />
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-text-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Your stores</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data.stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onSelect={() => {
              if (store.id !== current.id) switchStore.mutate(store.id);
            }}
          >
            <span className="flex-1 truncate">{store.name}</span>
            {store.id === current.id ? <Check className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
