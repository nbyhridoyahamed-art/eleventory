"use client";

import { Plus, Trash2 } from "lucide-react";

import type { ContentPanelProps } from "@/components/builder/panel-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { IconLabelItem, TrustBadgesSettings } from "@/types/homepage-block";

const MAX_ITEMS = 8;

/** Same curated icon keys as the storefront renderer's ICONS lookup — kept in sync manually since there is no shared enum. */
const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "truck", label: "Truck" },
  { value: "shield", label: "Shield" },
  { value: "lock", label: "Lock" },
  { value: "credit-card", label: "Credit Card" },
  { value: "rotate-ccw", label: "Rotate Ccw" },
  { value: "headset", label: "Headset" },
  { value: "banknote", label: "Banknote" },
  { value: "badge-check", label: "Badge Check" },
  { value: "tag", label: "Tag" },
];

export function TrustBadgesPanel({ value, onChange }: ContentPanelProps<TrustBadgesSettings>) {
  function addRow() {
    onChange({ ...value, items: [...value.items, { icon: "truck", label: "" }] });
  }

  function updateRow(index: number, patch: Partial<IconLabelItem>) {
    onChange({ ...value, items: value.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  function removeRow(index: number) {
    onChange({ ...value, items: value.items.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="trust-badges-heading">Heading (optional)</Label>
        <Input
          id="trust-badges-heading"
          value={value.heading ?? ""}
          onChange={(event) => onChange({ ...value, heading: event.target.value || null })}
        />
      </div>

      <div className="space-y-2">
        <Label>Badges</Label>
        <div className="space-y-3">
          {value.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2 rounded-md border border-border p-3">
              <div className="flex-1 space-y-1.5">
                <Select value={item.icon} onValueChange={(icon) => updateRow(index, { icon })}>
                  <SelectTrigger aria-label={`Icon for badge ${index + 1}`}>
                    <SelectValue placeholder="Icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Label" value={item.label} onChange={(event) => updateRow(index, { label: event.target.value })} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove badge"
                disabled={value.items.length <= 1}
                onClick={() => removeRow(index)}
              >
                <Trash2 className="text-danger" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={value.items.length >= MAX_ITEMS} onClick={addRow}>
          <Plus />
          Add badge
        </Button>
      </div>
    </div>
  );
}
