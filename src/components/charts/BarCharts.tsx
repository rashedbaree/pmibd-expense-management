type BarDatum = { label: string; value: number };

function defaultFormatValue(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Ranked horizontal bars for a magnitude comparison across categories
 * (e.g. spend per portfolio). One hue (colorVar) - the categories are
 * already identified by their label, so color doesn't need to carry
 * identity here. Caps to the top N by value; the rest stay in the table
 * below rather than being crammed in or dropped silently.
 */
export function RankedBarChart({
  title,
  data,
  colorVar,
  maxItems = 7,
  formatValue = defaultFormatValue,
}: {
  title: string;
  data: BarDatum[];
  colorVar: string;
  maxItems?: number;
  formatValue?: (n: number) => string;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, maxItems);
  const restCount = sorted.length - shown.length;
  const max = Math.max(1, ...shown.map((d) => Math.max(0, d.value)));

  return (
    <div className="viz-root">
      <h3 className="text-sm font-medium" style={{ color: "var(--chart-text-primary)" }}>
        {title}
      </h3>
      <div className="mt-3 flex flex-col gap-2.5">
        {shown.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <div
              className="w-24 shrink-0 truncate sm:w-36"
              style={{ color: "var(--chart-text-secondary)" }}
              title={d.label}
            >
              {d.label}
            </div>
            <div className="relative h-3 flex-1 rounded-[4px]" style={{ background: "var(--chart-grid)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-r-[4px]"
                style={{
                  width: `${(Math.max(0, d.value) / max) * 100}%`,
                  background: `var(${colorVar})`,
                }}
              />
            </div>
            <div
              className="w-20 shrink-0 text-right tabular-nums"
              style={{ color: "var(--chart-text-primary)" }}
            >
              {formatValue(d.value)}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-sm" style={{ color: "var(--chart-text-muted)" }}>
            No data yet.
          </p>
        )}
      </div>
      {restCount > 0 && (
        <p className="mt-2 text-xs" style={{ color: "var(--chart-text-muted)" }}>
          +{restCount} more in the table below.
        </p>
      )}
    </div>
  );
}

/**
 * Column chart for a time trend (e.g. monthly spend). Chronological,
 * left-to-right - caller controls sort order and how many periods to show.
 */
export function TrendColumnChart({
  title,
  data,
  colorVar,
  formatValue = defaultFormatValue,
  formatLabel = (l: string) => l,
}: {
  title: string;
  data: BarDatum[];
  colorVar: string;
  formatValue?: (n: number) => string;
  formatLabel?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(0, d.value)));

  return (
    <div className="viz-root">
      <h3 className="text-sm font-medium" style={{ color: "var(--chart-text-primary)" }}>
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--chart-text-muted)" }}>
          No data yet.
        </p>
      ) : (
        <div className="mt-3 flex items-end gap-1.5 sm:gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className="w-full truncate text-center text-[11px] tabular-nums"
                style={{ color: "var(--chart-text-secondary)" }}
                title={formatValue(d.value)}
              >
                {formatValue(d.value)}
              </span>
              <div className="flex h-28 w-full items-end sm:h-36">
                <div
                  className="w-full rounded-t-[4px]"
                  style={{
                    height: `${(Math.max(0, d.value) / max) * 100}%`,
                    background: `var(${colorVar})`,
                  }}
                />
              </div>
              <span
                className="w-full truncate text-center text-[11px]"
                style={{ color: "var(--chart-text-muted)" }}
              >
                {formatLabel(d.label)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
