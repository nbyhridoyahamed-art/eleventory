import { useId } from "react";

/** A small trend line with a soft area and a coral end dot (the latest value). Pure SVG, no data fetching. */
export function Sparkline({
  values,
  height = 40,
  className,
  label,
}: {
  values: number[];
  height?: number;
  className?: string;
  label?: string;
}) {
  const id = useId();
  const width = 160;
  if (values.length < 2) return <div style={{ height }} className={className} />;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 4;
  const points = values.map((value, index) => [
    (index / (values.length - 1)) * width,
    pad + (1 - (value - min) / span) * (height - pad * 2),
  ]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
