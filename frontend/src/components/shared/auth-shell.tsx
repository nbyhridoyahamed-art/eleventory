import { Logo } from "@/components/shared/logo";

const POINTS = [
  "Orders from Facebook, WhatsApp and your own site in one list",
  "bKash, Nagad, cards and cash on delivery",
  "Stock, couriers and customers without a spreadsheet",
];

/** Two-panel sign-in layout: form on the left, a dark teal brand panel with the rising bars on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <Logo iconSize={34} />
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">{title}</h1>
            <p className="text-sm text-text-secondary">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[var(--brand-rail)] p-12 text-[var(--brand-rail-text)] lg:flex">
        <div className="relative z-10 space-y-6">
          <p className="font-display text-4xl font-semibold leading-tight text-white">
            Sell from one place, wherever your customers find you.
          </p>
          <ul className="space-y-3 text-sm text-[var(--brand-rail-muted)]">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <svg viewBox="0 0 400 220" aria-hidden className="relative z-10 w-full max-w-md self-end">
          {[40, 70, 55, 95, 80, 130, 115].map((h, i) => (
            <rect key={i} x={16 + i * 54} y={200 - h} width={34} height={h} rx={4} fill="#4fc3b8" opacity={0.35 + i * 0.09} />
          ))}
          <rect x={16 + 7 * 54 - 6} y={200 - 175} width={34} height={175} rx={4} fill="#ff6a4d" />
        </svg>
      </aside>
    </main>
  );
}
