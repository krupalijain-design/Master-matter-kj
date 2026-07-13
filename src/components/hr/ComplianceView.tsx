import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTimeEntries, useUsers, useNonBillable } from "@/hooks/use-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Download, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { firmTemplates } from "@/mocks/reports";

const COVERAGE_TEMPLATE_ID = "tpl-hr-coverage";

const WEEKS = 6;

function weekKey(d: Date): string {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
}

function fmtWeek(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ComplianceView() {
  const { data: entries } = useTimeEntries();
  const { data: users } = useUsers();
  const { data: nb } = useNonBillable();

  const weeks = useMemo(() => {
    const arr: string[] = [];
    const base = new Date();
    for (let i = WEEKS - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i * 7);
      arr.push(weekKey(d));
    }
    return arr;
  }, []);

  const feeEarners = users.filter((u) =>
    u.roles.some((r) => r === "Case Partner" || r === "Case Manager" || r === "Associate" || r === "Paralegal"),
  );

  const coverage = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const u of feeEarners) map[u.id] = {};
    for (const e of entries) {
      const wk = weekKey(new Date(e.date));
      if (!weeks.includes(wk)) continue;
      if (!map[e.userId]) continue;
      const hrs = e.hours + e.minutes / 60;
      map[e.userId]![wk] = (map[e.userId]![wk] ?? 0) + hrs;
    }
    return map;
  }, [entries, feeEarners, weeks]);

  const approvedNb = nb.filter((x) => x.status === "Approved");

  const exportNb = () => {
    toast.success(`Exported ${approvedNb.length} rows`, { description: "HR credit file queued (CSV mock)." });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-normal tracking-tight">HR compliance</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Timesheet coverage only. Narratives are hidden by permission and never rendered on this page.
        </p>
      </div>

      <Card className="p-3 flex items-center justify-between gap-3 border-accent/30 bg-accent/[0.04]">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileText className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px]">
              Powered by firm template <span className="font-medium">{firmTemplates.find((t) => t.id === COVERAGE_TEMPLATE_ID)?.name ?? "Timesheet coverage"}</span>
              <Chip tone="success" size="sm" className="ml-2">Firm-template</Chip>
              <Chip tone="neutral" size="sm" className="ml-1">Aggregates only</Chip>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Narrative field is structurally unavailable to your role in the report builder.
            </div>
          </div>
        </div>
        <Link to="/reports/$id" params={{ id: COVERAGE_TEMPLATE_ID }}>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Reshape in builder
          </Button>
        </Link>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium mb-3">Timesheet coverage · rolling {WEEKS} weeks</div>
        <div className="overflow-x-auto">
          <table className="w-full compact-table">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-2 py-1.5 min-w-[180px]">Person</th>
                {weeks.map((w) => (
                  <th key={w} className="text-center px-2 py-1.5 font-mono">wk {fmtWeek(w)}</th>
                ))}
                <th className="text-center px-2 py-1.5">Avg</th>
              </tr>
            </thead>
            <tbody>
              {feeEarners.map((u) => {
                const cells = weeks.map((w) => Math.min(100, Math.round(((coverage[u.id]?.[w] ?? 0) / 40) * 100)));
                const avg = Math.round(cells.reduce((a, b) => a + b, 0) / cells.length);
                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-2 py-1.5 text-[13px]">{u.fullName} <span className="text-muted-foreground text-[11px]">· {u.branch}</span></td>
                    {cells.map((v, i) => (
                      <td key={i} className="px-2 py-1 text-center">
                        <HeatCell pct={v} />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-center font-mono tabular-nums">{avg}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          Cell = weekly hours ÷ 40h. Below 60% shown as danger; 60–89% warning; 90%+ success.
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Non-billable work · approved credit</div>
            <div className="text-[12px] text-muted-foreground">Feeds HR non-billable credit for the period.</div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportNb}>
            <Download className="h-3.5 w-3.5" /> Export for HR
          </Button>
        </div>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full compact-table">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Person</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {approvedNb.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-[12px] text-muted-foreground">No approved non-billable credit in scope.</td></tr>
              )}
              {approvedNb.map((n) => {
                const u = users.find((uu) => uu.id === n.userId);
                return (
                  <tr key={n.id} className="border-t">
                    <td className="px-3 py-2">{u?.fullName ?? n.userId}</td>
                    <td className="px-3 py-2"><Chip tone="neutral">{n.kind}</Chip></td>
                    <td className="px-3 py-2 truncate max-w-[520px]">{n.title}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{n.date.split("-").reverse().join("/")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HeatCell({ pct }: { pct: number }) {
  // Accessible heatmap using chip tone tokens; label + color together (never color alone).
  const style =
    pct === 0 ? "bg-muted text-muted-foreground" :
    pct < 60 ? "bg-[var(--chip-danger-bg)] text-[var(--chip-danger-fg)]" :
    pct < 90 ? "bg-[var(--chip-pending-bg)] text-[var(--chip-pending-fg)]" :
    "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]";
  return (
    <span className={"inline-block w-14 py-1 rounded font-mono tabular-nums text-[11px] font-medium " + style}>
      {pct}%
    </span>
  );
}