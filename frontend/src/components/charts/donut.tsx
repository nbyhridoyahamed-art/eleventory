export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * A donut with the total in the middle and a legend listing every slice with its count.
 * Each slice keeps its colour by identity, so filtering never repaints the others. Slices are separated
 * by a gap in the surface colour, and the legend (not colour alone) carries the meaning.
 */
export function Donut({ slices, totalLabel }: { slices: DonutSlice[]; totalLabel: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0" role="img" aria-label={`${total} ${totalLabel}`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="16" />
        {total > 0
          ? slices
              .filter((slice) => slice.value > 0)
              .map((slice) => {
                const length = (slice.value / total) * circumference;
                const dash = `${Math.max(length - 2, 0.5)} ${circumference}`;
                const circle = (
                  <circle
                    key={slice.key}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="16"
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)"
                  />
                );
                offset += length;
                return circle;
              })
          : null}
        <text x="70" y="68" textAnchor="middle" className="fill-text-primary font-display text-[26px] font-semibold">
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle" className="fill-text-muted text-[10px]">
          {totalLabel}
        </text>
      </svg>

      <ul className="min-w-[10rem] flex-1 space-y-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-text-secondary">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: slice.color }} />
              {slice.label}
            </span>
            <span className="font-mono text-text-primary">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
