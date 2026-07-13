import { useMemo } from "react";
import { useMatters, useUsers, useRtbs } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { scopeForRole, matterInScope, feeQuoteStatusOf, daysSince, practiceGroupOf } from "@/lib/leadership";
import { formatINR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@tanstack/react-router";
import { Building2, Clock, XCircle, TrendingUp } from "lucide-react";
import type { Role } from "@/types";

export function LeadershipCockpit({ forceFirm = false }: { forceFirm?: boolean }) {
  const { currentUserId, currentRole } = useAppStore();
  const { data: users } = useUsers();
  const { data: matters } = useMatters();
  const { data: rtbs } = useRtbs();
  const me = users.find((u) => u.id === currentUserId)!;

  const scope = useMemo(
    () => (forceFirm ? { label: "Firm-wide" } : scopeForRole(currentRole as Role, me)),
    [forceFirm, currentRole, me],
  );

  const scoped = useMemo(() => matters.filter((m) => matterInScope(m, scope)), [matters, scope]);

  const activeMatters = scoped.filter((m) => m.status === "Ongoing").length;
  const unallocated = scoped.filter((m) => m.allocationState === "Unallocated" && m.pipelineState === "Approved").length;
  const outstanding = rtbs
    .filter((r) => scoped.some((m) => m.id === r.matterId))
    .reduce((s, r) => s + r.outstandingAmount, 0);

  const qtdStart = new Date();
  qtdStart.setMonth(Math.floor(qtdStart.getMonth() / 3) * 3, 1);

  const feeAwaiting = scoped.filter((m) => feeQuoteStatusOf(m) === "Sent");
  const feeAwaitingWithAge = feeAwaiting.map((m) => ({ m, age: daysSince(m.createdAt) }));
  const closedForFee = scoped.filter(
    (m) => feeQuoteStatusOf(m) === "Rejected" && new Date(m.createdAt).getTime() >= qtdStart.getTime(),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Leadership cockpit</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Same seed numbers reconcile across CP, Practice Head and Firm views.</p>
        </div>
        <ScopePill label={scope.label} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Active matters" value={activeMatters.toString()} />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Awaiting allocation" value={unallocated.toString()} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Outstanding (billed)" value={formatINR(outstanding)} />
        <Kpi icon={<XCircle className="h-4 w-4" />} label="Closed for fee non-acceptance (QTD)" value={closedForFee.length.toString()} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Fee quotes awaiting client response</div>
            <div className="text-[12px] text-muted-foreground">Sent, no accept/reject yet. Aging from matter creation.</div>
          </div>
          <Chip tone="pending">{feeAwaiting.length} open</Chip>
        </div>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full editorial-table">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Matter</th>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Branch · Group</th>
                <th className="text-right px-3 py-2">Fee quote</th>
                <th className="text-right px-3 py-2">Age</th>
              </tr>
            </thead>
            <tbody>
              {feeAwaitingWithAge.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-[12px]">No open fee quotes in scope.</td></tr>
              )}
              {feeAwaitingWithAge.map(({ m, age }) => (
                <tr key={m.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono tabular-nums text-[12px]">
                    <Link to="/matter/$id" params={{ id: m.id }} className="text-accent hover:underline">{m.matterId}</Link>
                  </td>
                  <td className="px-3 py-2 truncate max-w-[420px]">{m.title}</td>
                  <td className="px-3 py-2 text-[12px] text-muted-foreground">{m.branch} · {practiceGroupOf(m)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{m.feeQuote ? formatINR(m.feeQuote) : "—"}</td>
                  <td className={"px-3 py-2 text-right font-mono tabular-nums " + (age > 14 ? "text-danger" : age > 7 ? "text-warning" : "")}>
                    {age}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Cases closed for fee non-acceptance (QTD)</div>
            <div className="text-[12px] text-muted-foreground">Quarter to date · matters where the client rejected the quote.</div>
          </div>
          <Chip tone="neutral">{closedForFee.length}</Chip>
        </div>
        {closedForFee.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-4">None in this quarter.</div>
        ) : (
          <ul className="space-y-1.5 text-[13px]">
            {closedForFee.map((m) => (
              <li key={m.id} className="flex items-center justify-between border-b last:border-b-0 py-1.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Link to="/matter/$id" params={{ id: m.id }} className="font-mono text-[12px] text-accent hover:underline">{m.matterId}</Link>
                  <span className="truncate">{m.title}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{m.branch}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ScopePill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 h-8 rounded-full border bg-muted/30 text-[12px]">
      <span className="text-muted-foreground">Scope:</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="font-display text-[26px] font-normal mt-1 tabular-nums font-mono">{value}</div>
    </Card>
  );
}