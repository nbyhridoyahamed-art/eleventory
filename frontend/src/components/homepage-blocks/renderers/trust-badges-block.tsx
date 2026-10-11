import { Banknote, BadgeCheck, CreditCard, Headset, Lock, RotateCcw, ShieldCheck, Tag, Truck } from "lucide-react";

import { SectionHeading } from "@/components/homepage-blocks/section-heading";
import type { TrustBadgesSettings } from "@/types/homepage-block";

const ICONS: Record<string, typeof Truck> = {
  truck: Truck,
  shield: ShieldCheck,
  lock: Lock,
  "credit-card": CreditCard,
  "rotate-ccw": RotateCcw,
  headset: Headset,
  banknote: Banknote,
  "badge-check": BadgeCheck,
  tag: Tag,
};

/** A single-row service strip (delivery, returns, support ...), separated by hairlines. Wraps by the block's own width. */
export function TrustBadgesBlock({ settings }: { settings: TrustBadgesSettings }) {
  if (settings.items.length === 0) return null;

  return (
    <section className="@container space-y-4">
      {settings.heading ? <SectionHeading title={settings.heading} /> : null}
      <ul className="grid grid-cols-2 border-l border-t border-border bg-surface @xl:grid-cols-3 @4xl:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ "--cols": settings.items.length } as React.CSSProperties}>
        {settings.items.map((item, index) => {
          const Icon = ICONS[item.icon] ?? ShieldCheck;
          return (
            <li key={index} className="flex items-center gap-3 border-b border-r border-border px-4 py-4">
              <Icon className="size-7 shrink-0 text-shop-ink" aria-hidden="true" />
              <span className="text-[13px] font-medium leading-snug text-text-primary">{item.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
