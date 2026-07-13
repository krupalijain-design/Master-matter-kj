import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { runReport, datasetMeta, fieldMeta, type RunContext } from "@/lib/report-engine";
import type { ReportDef } from "@/types";
import { formatINR } from "@/lib/format";
import { getMetricColor } from "@/lib/theme-colors";

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function formatCell(def: ReportDef, key: string, value: unknown): string {
  const meta = fieldMeta(def.dataset, key);
  if (meta?.type === "currency" && typeof value === "number") return formatINR(value);
  if (meta?.type === "date" && typeof value === "string") return fmtDate(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null) return "";
  return String(value);
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border rounded-md px-2 py-1 text-xs shadow-sm">
      <div className="font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tabular-nums text-muted-foreground">{p.name}: {typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}</div>
      ))}
    </div>
  );
}

export function ReportPreview({
  def,
  ctx,
  showScopeLine = true,
  compact,
  onDrillRow,
}: {
  def: ReportDef;
  ctx: RunContext;
  showScopeLine?: boolean;
  compact?: boolean;
  onDrillRow?: (row: Record<string, unknown>) => void;
}) {
  const result = useMemo(() => runReport(def, ctx), [def, ctx]);
  const dsCols = def.columns;
  const ds = datasetMeta(def.dataset);
  const label = (k: string) => def.columnLabels[k] ?? ds.fields.find((f) => f.key === k)?.label ?? k;

  const grouped = result.grouped;
  const chartData = useMemo(() => {
    if (!grouped) return [];
    return grouped.rows.map((r) => {
      const out: Record<string, unknown> = {};
      def.groupBy.forEach((g) => { out[g] = String(r[g] ?? ""); });
      def.aggregates.forEach((a) => { const lbl = a.label ?? `${a.fn}_${a.field}`; out[lbl] = Number(r[lbl] ?? 0); });
      out.name = def.groupBy.map((g) => String(r[g] ?? "")).join(" · ");
      return out;
    });
  }, [grouped, def.groupBy, def.aggregates]);

  const primaryAgg = def.aggregates[0]?.label ?? (def.aggregates[0] ? `${def.aggregates[0].fn}_${def.aggregates[0].field}` : "");

  return (
    <div className="space-y-3">
      {showScopeLine && (
        <div className="text-xs text-muted-foreground">{result.scopeLine} · {result.total} row{result.total === 1 ? "" : "s"}</div>
      )}

      {def.viz === "Summary" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <SummaryCard label="Rows" value={result.total.toLocaleString("en-IN")} />
          {def.aggregates.map((a) => {
            const lbl = a.label ?? `${a.fn}_${a.field}`;
            const sum = result.rows.reduce((s, r) => s + Number(r[a.field] ?? 0), 0);
            const val = a.fn === "count" ? result.total : a.fn === "avg" ? (result.total ? sum / result.total : 0) : sum;
            const meta = fieldMeta(def.dataset, a.field);
            return <SummaryCard key={lbl} label={lbl} value={meta?.type === "currency" ? formatINR(val) : val.toLocaleString("en-IN", { maximumFractionDigits: 2 })} />;
          })}
        </div>
      )}

      {(def.viz === "Bar" || def.viz === "Line" || def.viz === "Funnel") && grouped && primaryAgg && (
        <div className="h-[260px] w-full bg-surface border rounded-lg p-3">
          <ResponsiveContainer width="100%" height="100%">
            {def.viz === "Bar" ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey={primaryAgg} fill={getMetricColor(def.name)} radius={[4, 4, 0, 0]} onClick={(d) => onDrillRow?.(d as Record<string, unknown>)}>
                  {chartData.map((_, i) => <Cell key={i} cursor="pointer" />)}
                </Bar>
              </BarChart>
            ) : def.viz === "Line" ? (
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey={primaryAgg} stroke={getMetricColor(def.name)} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <FunnelChart>
                <Tooltip content={<ChartTip />} />
                <Funnel dataKey={primaryAgg} data={chartData} isAnimationActive fill={getMetricColor(def.name)}>
                  <LabelList dataKey="name" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                </Funnel>
              </FunnelChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-surface">
        <div className="max-h-[420px] overflow-auto">
          <table className={"w-full " + (def.format.density === "compact" || compact ? "text-[12px]" : "text-[13px]")}>
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                {(grouped ? grouped.columns : dsCols).map((k) => (
                  <th key={k} className="text-left px-3 py-2 font-medium">{grouped && !def.groupBy.includes(k) ? k : label(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(grouped ? grouped.rows : result.rows).length === 0 ? (
                <tr><td colSpan={(grouped ? grouped.columns : dsCols).length || 1} className="text-center py-8 text-sm text-muted-foreground">No rows.</td></tr>
              ) : (grouped ? grouped.rows : result.rows).map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/40">
                  {(grouped ? grouped.columns : dsCols).map((k) => {
                    const v = row[k];
                    const meta = fieldMeta(def.dataset, k);
                    return (
                      <td key={k} className={"px-3 py-2 " + (meta?.type === "currency" || meta?.type === "number" ? "text-right font-mono tabular-nums" : "")}>
                        {grouped && !def.groupBy.includes(k) && typeof v === "number"
                          ? (meta?.type === "currency" ? formatINR(v) : v.toLocaleString("en-IN", { maximumFractionDigits: 2 }))
                          : formatCell(def, k, v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {grouped && (
        <div className="text-xs text-muted-foreground">Showing grouped totals. The rows behind these totals are in the table above.</div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-[28px] leading-tight">{value}</div>
    </div>
  );
}