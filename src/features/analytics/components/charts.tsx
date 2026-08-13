import type { Point, Slice } from "@/services/analytics.service";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Card wrapper with a visually-hidden data table (accessibility fallback). */
export function ChartCard({
  title,
  description,
  table,
  children,
}: {
  title: string;
  description?: string;
  table: { columns: [string, string]; rows: (string | number)[][] };
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        {children}
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>{table.columns[0]}</th>
              <th>{table.columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/**
 * Charts here go empty for one reason: nothing has been assigned or scheduled
 * yet. Saying "not enough data" left people checking whether the chart was
 * broken, so the message names the missing input instead.
 */
function Empty({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <p className="text-sm text-muted-foreground">Belum ada data untuk ditampilkan</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

export function DonutChart({
  data,
  emptyHint,
  centerLabel,
}: {
  data: Slice[];
  emptyHint?: string;
  /** What the number in the middle counts — "5" alone doesn't say. */
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Empty hint={emptyHint} />;

  const size = 168;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {data.map((d) => {
          const frac = d.value / total;
          const dash = frac * c;
          const el = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
          acc += dash;
          return el;
        })}
        <text
          x="50%"
          y={centerLabel ? "45%" : "50%"}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-2xl font-semibold"
        >
          {total}
        </text>
        {centerLabel && (
          <text
            x="50%"
            y="62%"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground text-[10px] uppercase tracking-wide"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {data.map((d) => {
          // A zero category is context, not a finding — carrying full weight it
          // competes with the numbers that actually matter.
          const zero = d.value === 0;
          return (
            <li key={d.label} className={cn("flex items-center gap-2", zero && "opacity-45")}>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="ml-auto flex items-baseline gap-1.5">
                <span className="font-medium tabular-nums">{d.value}</span>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round((d.value / total) * 100)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BarChart({ data, emptyHint }: { data: Point[]; emptyHint?: string }) {
  if (data.length === 0) return <Empty hint={emptyHint} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-muted-foreground" title={d.label}>
            {d.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              // Floor at 6%: a value of 1 next to a max of 20 would otherwise
              // render as a sliver indistinguishable from empty.
              style={{ width: `${Math.max((d.value / max) * 100, 6)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium tabular-nums">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function LineChart({
  data,
  max,
  suffix = "",
  emptyHint,
}: {
  data: Point[];
  max?: number;
  suffix?: string;
  emptyHint?: string;
}) {
  if (data.length === 0) return <Empty hint={emptyHint} />;
  const w = 520;
  const h = 160;
  const pad = 24;
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const x = (i: number) => pad + i * step;
  const y = (v: number) => h - pad - (v / top) * (h - pad * 2);
  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-hidden>
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--border)" />
        <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.value)} r={3} fill="var(--primary)">
              <title>{`${d.label}: ${d.value}${suffix}`}</title>
            </circle>
            {(i % 2 === 0 || data.length <= 8) && (
              <text x={x(i)} y={h - pad + 14} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
