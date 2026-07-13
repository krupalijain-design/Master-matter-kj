import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowUpRight, Building2, Clock, Download, Info, TrendingUp, Wallet, AlertTriangle,
  CalendarClock, GaugeCircle, Layers, Pin, Plus, Sparkles, PieChart as PieIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMatters, useRtbs, useHearings, useUsers } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { formatINR } from "@/lib/format";
import { MOCK_TIMESHEET_COVERAGE_PCT, COVERAGE_THRESHOLD_PCT } from "@/lib/cockpit-constants";
import type { Branch, Matter, MatterCategory, RTB, Role } from "@/types";
import { scopeForRole, matterInScope } from "@/lib/leadership";
import { kpiToReport, type SaveKind } from "@/lib/kpi-to-report";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bookmark } from "lucide-react";
import { getMetricColor } from "@/lib/theme-colors";

const CATEGORIES: (MatterCategory | "All")[] = ["All", "Tax - Indirect", "Tax - Direct", "International Trade", "Corporate"];
const BRANCHES: (Branch | "All")[] = ["All", "New Delhi", "Mumbai", "Nagpur", "Bengaluru"];
const PERIODS = ["FYTD", "QTD", "MTD"] as const;
type Period = typeof PERIODS[number];

function daysAgo(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

/** Reconciles with PartnerCockpit: gross = sum RTB where billedBy=uid, status !== Draft; net = gross - 8% (rounded). */
function partnerGrossNet(uid: string, rtbs: RTB[]): { gross: number; net: number } {
  const gross = rtbs.filter((r) => r.billedBy === uid && r.status !== "Draft").reduce((s, r) => s + r.billingAmount, 0);
  const net = gross - Math.round(gross * 0.08);
  return { gross, net };
}

/** Apportionment-adjusted split of a single RTB across named partners. Falls back to billedBy=100%. */
function apportionRtb(r: RTB): Record<string, number> {
  const out: Record<string, number> = {};
  if (r.apportionment && r.apportionment.length > 0) {
    for (const a of r.apportionment) out[a.partnerId] = (out[a.partnerId] ?? 0) + (r.billingAmount * a.pct) / 100;
    return out;
  }
  out[r.billedBy] = r.billingAmount;
  return out;
}

export function ManagementCockpit({ forceFirm = false }: { forceFirm?: boolean }) {
  const navigate = useNavigate();
  const { data: matters } = useMatters();
  const { data: rtbs } = useRtbs();
  const { data: hearings } = useHearings();
  const { data: users } = useUsers();
  const { currentRole, currentUserId } = useAppStore();
  const me = users.find((u) => u.id === currentUserId);

  const [category, setCategory] = useState<MatterCategory | "All">("All");
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [period, setPeriod] = useState<Period>("FYTD");
  const [apportioned, setApportioned] = useState(false);
  const [pinned, setPinned] = useState<string[]>(["gstat-pending", "live-by-state", "matters-by-forum"]);

  const leadershipScope = useMemo(
    () => (forceFirm || !me ? { label: "Firm-wide" } : scopeForRole(currentRole as Role, me)),
    [forceFirm, currentRole, me],
  );

  const scoped = useMemo(() => matters.filter((m) => matterInScope(m, leadershipScope)), [matters, leadershipScope]);

  const filteredMatters = useMemo(
    () => scoped.filter((m) => (category === "All" || m.category === category) && (branch === "All" || m.branch === branch)),
    [scoped, category, branch],
  );
  const filteredMatterIds = useMemo(() => new Set(filteredMatters.map((m) => m.id)), [filteredMatters]);
  const filteredRtbs = useMemo(() => rtbs.filter((r) => filteredMatterIds.has(r.matterId)), [rtbs, filteredMatterIds]);

  // KPI: Live matters, Revenue FYTD, Realization, Aged unbilled WIP, Pipeline
  const liveMatters = filteredMatters.filter((m) => m.status === "Ongoing").length;
  const revenue = filteredRtbs.filter((r) => ["Approved", "Invoiced", "Paid"].includes(r.status)).reduce((s, r) => s + r.billingAmount, 0);
  const collected = filteredRtbs.filter((r) => r.status === "Paid").reduce((s, r) => s + r.billingAmount, 0);
  const realizationPct = revenue > 0 ? Math.round((collected / revenue) * 100) : 0;
  const agedWip = filteredMatters
    .filter((m) => m.status === "Ongoing" && daysAgo(m.createdAt) > 60)
    .reduce((s, m) => {
      const billed = filteredRtbs.filter((r) => r.matterId === m.id).reduce((x, r) => x + r.billingAmount, 0);
      return s + Math.max(0, (m.feeQuote ?? 350000) - billed);
    }, 0);
  const pipelinePending = filteredMatters.filter((m) => m.pipelineState === "Pending").length;

  // Funnel
  const wip = filteredRtbs.filter((r) => r.status !== "Voided" && r.status !== "Written Off").reduce((s, r) => s + r.billingAmount, 0);
  const billed = filteredRtbs.filter((r) => ["Invoiced", "Paid"].includes(r.status)).reduce((s, r) => s + r.billingAmount, 0);
  const writeoff = filteredRtbs.filter((r) => r.status === "Written Off").reduce((s, r) => s + r.billingAmount, 0);
  const creditNotes = filteredRtbs.filter((r) => r.status === "Cancellation Requested" || r.status === "Voided").reduce((s, r) => s + r.billingAmount, 0);

  // Revenue by category
  const revByCategory = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of filteredRtbs) {
      if (r.status === "Draft" || r.status === "Voided") continue;
      const m = matters.find((x) => x.id === r.matterId);
      if (!m) continue;
      acc.set(m.category, (acc.get(m.category) ?? 0) + r.billingAmount);
    }
    return Array.from(acc.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredRtbs, matters]);

  // Partner leaderboard (top 15)
  const partnerRows = useMemo(() => {
    const partnerIds = Array.from(new Set(matters.map((m) => m.casePartnerId)));
    return partnerIds
      .map((uid) => {
        const u = users.find((x) => x.id === uid);
        if (!u) return null;
        // Gross/net per PartnerCockpit; when apportioned toggle is on, distribute per apportionment map.
        const { gross, net } = partnerGrossNet(uid, filteredRtbs);
        let apportionedNet = 0;
        for (const r of filteredRtbs) {
          if (r.status === "Draft") continue;
          const split = apportionRtb(r);
          apportionedNet += split[uid] ?? 0;
        }
        apportionedNet = apportionedNet - Math.round(apportionedNet * 0.08);
        const partnerMatters = matters.filter((m) => m.casePartnerId === uid && filteredMatterIds.has(m.id) && m.status === "Ongoing").length;
        return { uid, name: u.fullName, branch: u.branch, gross, net, apportionedNet, matters: partnerMatters };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && (r.gross > 0 || r.matters > 0))
      .sort((a, b) => (apportioned ? b.apportionedNet - a.apportionedNet : b.net - a.net))
      .slice(0, 15);
  }, [matters, users, filteredRtbs, filteredMatterIds, apportioned]);

  // Collection history: billed vs collected by month (last 6 months from RTB invoiceDate)
  const collectionHistory = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; billed: number; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      buckets.push({ key, label, billed: 0, collected: 0 });
    }
    for (const r of filteredRtbs) {
      if (!r.invoiceDate) continue;
      const d = new Date(r.invoiceDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (!b) continue;
      if (r.status === "Invoiced" || r.status === "Paid") b.billed += r.billingAmount;
      if (r.status === "Paid") b.collected += r.billingAmount;
    }
    return buckets;
  }, [filteredRtbs]);

  // Leading indicators
  const wip60Count = filteredMatters.filter((m) => m.status === "Ongoing" && daysAgo(m.createdAt) > 60).length;
  const deadline14 = hearings.filter((h) => {
    if (!filteredMatterIds.has(h.matterId)) return false;
    const dd = (new Date(h.date).getTime() - Date.now()) / 86400000;
    return dd >= -1 && dd <= 14;
  }).length;
  const coveragePct = MOCK_TIMESHEET_COVERAGE_PCT;
  const coverageLow = coveragePct < COVERAGE_THRESHOLD_PCT;
  const unallocFirm = filteredMatters.filter((m) => m.allocationState === "Unallocated" && m.pipelineState === "Approved").length;
  const mailsAging = 7; // mock: aging >24h in inbox

  // Portfolio answers (pinned queries)
  const gstatMatterIds = new Set(hearings.filter((h) => h.forum === "GSTAT").map((h) => h.matterId));
  const gstatCount = filteredMatters.filter((m) => gstatMatterIds.has(m.id)).length;
  const cestatCount = filteredMatters.filter((m) => hearings.some((h) => h.forum === "CESTAT Delhi" && h.matterId === m.id)).length;
  const scCount = filteredMatters.filter((m) => hearings.some((h) => h.forum === "Supreme Court" && h.matterId === m.id)).length;

  const drill = (kind: "matters" | "rtb", filter: string, origin: string) => {
    navigate({ to: "/reports/drill", search: { kind, filter, origin } as never });
  };

  const addReport = useAppStore((s) => s.addReport);
  const saveKpi = (spec: { kind: SaveKind; filter?: string; name: string }) => {
    const def = kpiToReport(spec, currentUserId);
    addReport(def);
    toast.success(`Saved to My reports: "${def.name}"`, {
      action: { label: "Open report", onClick: () => navigate({ to: "/reports/$id", params: { id: def.id } }) },
      duration: 6000,
    });
  };

  const scopeLabel = leadershipScope.label;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Firm overview, FY26</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Same seeded numbers reconcile between Case Partner and Management cockpits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScopePill label={scopeLabel} />
          <Select value={category} onValueChange={(v) => setCategory(v as MatterCategory | "All")}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Practice" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "All" ? "All practices" : c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={branch} onValueChange={(v) => setBranch(v as Branch | "All")}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b === "All" ? "All branches" : b}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={() => toast.success("Export queued", { description: "CSV will land in your inbox." })}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => toast.success("Snapshot scheduled", { description: "Emailed every Monday at 8am." })}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Schedule
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Live matters" value={String(liveMatters)}
          info="Ongoing matters, all branches within current filter."
          onClick={() => drill("matters", "active-matters-firm", "Live matters")}
          onSaveAsReport={() => saveKpi({ kind: "matters", filter: "active-matters-firm", name: "Live matters" })} />
        <Kpi icon={<Wallet className="h-4 w-4" />} label={`Revenue ${period}`} value={formatINR(revenue)} delta="▲ 6.2%"
          onClick={() => drill("rtb", "funnel-billed", `Revenue ${period}`)}
          footnote={coverageLow ? `based on ${coveragePct}% timesheet coverage` : undefined}
          onSaveAsReport={() => saveKpi({ kind: "rtb", filter: "funnel-billed", name: `Revenue ${period}` })} />
        <Kpi icon={<GaugeCircle className="h-4 w-4" />} label="Realization rate" value={`${realizationPct}%`} delta="target 78%"
          onClick={() => drill("rtb", "funnel-collected", "Realization rate")}
          onSaveAsReport={() => saveKpi({ kind: "rtb", filter: "funnel-collected", name: "Realization rate" })} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Aged unbilled WIP >60d" value={formatINR(agedWip)} warning
          onClick={() => drill("matters", "aged-wip-firm", "Aged unbilled WIP >60d")}
          footnote={coverageLow ? `based on ${coveragePct}% timesheet coverage` : undefined}
          onSaveAsReport={() => saveKpi({ kind: "matters", filter: "aged-wip-firm", name: "Aged unbilled WIP >60d" })} />
        <Kpi icon={<Layers className="h-4 w-4" />} label="Pipeline (pending intake)" value={String(pipelinePending)}
          onClick={() => drill("matters", "pipeline-pending-firm", "Pipeline (pending intake)")}
          onSaveAsReport={() => saveKpi({ kind: "matters", filter: "pipeline-pending-firm", name: "Pipeline (pending intake)" })} />
      </section>

      {/* Funnel */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieIcon className="h-3.5 w-3.5 text-accent" />
            <div className="text-sm font-medium">WIP → Billed → Collected</div>
            <ReconChip />
          </div>
          <div className="text-[11px] text-muted-foreground">Click any stage to drill</div>
        </div>
        <Funnel wip={wip} billed={billed} collected={collected} writeoff={writeoff} creditNotes={creditNotes} onStage={(stage) => {
          const map: Record<string, { filter: string; origin: string }> = {
            wip:       { filter: "funnel-wip",       origin: "Funnel · WIP" },
            billed:    { filter: "funnel-billed",    origin: "Funnel · Billed" },
            collected: { filter: "funnel-collected", origin: "Funnel · Collected" },
            writeoff:  { filter: "funnel-writeoff",  origin: "Funnel · Write-off leak" },
            creditnote:{ filter: "funnel-creditnote",origin: "Funnel · Credit note leak" },
          };
          const p = map[stage]; if (p) drill("rtb", p.filter, p.origin);
        }} />
      </Card>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Revenue by practice</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revByCategory} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(0)}L` : String(v))} />
                <Tooltip formatter={(v: number) => formatINR(v)} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="value" fill={getMetricColor("Revenue by practice")} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Revenue by Case Partner (top 15)</div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Apportionment-adjusted</span>
              <Switch checked={apportioned} onCheckedChange={setApportioned} />
            </div>
          </div>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full compact-table">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Partner</th>
                  <th className="text-right px-2 py-1.5 font-medium">Matters</th>
                  <th className="text-right px-2 py-1.5 font-medium">{apportioned ? "Net (apport.)" : "Net"}</th>
                </tr>
              </thead>
              <tbody>
                {partnerRows.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">No partner activity in filter.</td></tr>
                )}
                {partnerRows.map((p) => (
                  <tr key={p.uid} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => drill("rtb", `partner:${p.uid}`, `Partner · ${p.name}`)}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">{p.branch}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{p.matters}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">{formatINR(apportioned ? p.apportionedNet : p.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Collection history (last 6 months)</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={collectionHistory} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} label={{ value: "Month", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(0)}L` : String(v))} label={{ value: "₹", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Line type="monotone" dataKey="billed" stroke={getMetricColor("Billed")} strokeWidth={2} dot={{ r: 3 }} name="Billed" />
                <Line type="monotone" dataKey="collected" stroke={getMetricColor("Collected")} strokeWidth={2} dot={{ r: 3 }} name="Collected" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getMetricColor("Billed") }} />
              Billed
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getMetricColor("Collected") }} />
              Collected
            </span>
          </div>
        </Card>
      </section>

      {/* Leading indicators strip */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Indicator icon={<AlertTriangle className="h-3.5 w-3.5" />} tone={wip60Count > 0 ? "warning" : "muted"}
          label="Aged WIP >60d" value={String(wip60Count)} onClick={() => drill("matters", "aged-wip-firm", "Aged unbilled WIP >60d")} />
        <Indicator icon={<CalendarClock className="h-3.5 w-3.5" />} tone="muted"
          label="Deadlines next 14d" value={String(deadline14)} onClick={() => drill("matters", "deadline-14-firm", "Deadlines next 14 days")} />
        <Indicator icon={<GaugeCircle className="h-3.5 w-3.5" />} tone={coveragePct < 80 ? "danger" : "muted"}
          label="Timesheet coverage" value={`${coveragePct}%`} onClick={() => drill("matters", "coverage-by-team", "Coverage by team")} />
        <Indicator icon={<Layers className="h-3.5 w-3.5" />} tone="muted"
          label="Awaiting allocation" value={String(unallocFirm)} onClick={() => navigate({ to: "/matter/allocation" })} />
        <Indicator icon={<Clock className="h-3.5 w-3.5" />} tone="muted"
          label="Docketing inbox >24h" value={String(mailsAging)} onClick={() => navigate({ to: "/pipeline" })} />
      </section>

      {/* Portfolio answers */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-accent" />
            <div className="text-sm font-medium">Portfolio answers</div>
          </div>
          <PinPopover pinned={pinned} onAdd={(id) => setPinned((p) => (p.includes(id) ? p : [...p, id]))} />
        </div>
        <ul className="divide-y">
          {pinned.includes("gstat-pending") && (
            <StatRow label="Appeals pending before GSTAT" value={gstatCount} onOpen={() => drill("matters", "forum:GSTAT", "Forum · GSTAT")} />
          )}
          {pinned.includes("live-by-state") && (
            <StatRow label="Live matters by branch" value={liveMatters} onOpen={() => drill("matters", "active-matters-firm", "Live matters, by branch")} />
          )}
          {pinned.includes("matters-by-forum") && (
            <StatRow label="Matters by forum / bench" value={cestatCount + gstatCount + scCount} onOpen={() => drill("matters", "forum-mix", "Matters by forum")} />
          )}
          {pinned.includes("customs-scn") && (
            <StatRow label="Customs, Reply to SCN, ongoing"
              value={filteredMatters.filter((m) => m.subCategory === "Customs" && m.deliverable === "Reply to SCN" && m.status === "Ongoing").length}
              onOpen={() => drill("matters", "customs-scn", "Customs · Reply to SCN")} />
          )}
          {pinned.includes("retainership-fy26") && (
            <StatRow label="Retainership matters, FY26"
              value={filteredMatters.filter((m) => m.deliverable === "Retainership" && m.status === "Ongoing").length}
              onOpen={() => drill("matters", "retainership-fy26", "Retainership FY26")} />
          )}
        </ul>
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

function ReconChip() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <Info className="h-3 w-3" /> Reconciliation
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-xs">
        <div className="font-medium mb-1">Reconciliation</div>
        <div className="text-muted-foreground">Figures reconcile to the Accounts feed nightly. Same seed values appear in the Partner Cockpit.</div>
      </PopoverContent>
    </Popover>
  );
}

function Kpi({ icon, label, value, delta, warning, info, footnote, onClick, onSaveAsReport }: {
  icon: React.ReactNode; label: string; value: string; delta?: string; warning?: boolean;
  info?: string; footnote?: string; onClick?: () => void; onSaveAsReport?: () => void;
}) {
  return (
    <Card
      className={"p-3 cursor-pointer hover:border-accent/60 transition-colors " + (warning ? "border-warning/40 bg-warning/[0.03]" : "")}
      onClick={onClick}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">{icon}<span>{label}</span></div>
        <div className="flex items-center gap-1">
          {onSaveAsReport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button onClick={(e) => e.stopPropagation()} aria-label="Save this KPI as a report" className="text-muted-foreground hover:text-foreground">
                  <Bookmark className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={onSaveAsReport}>Save as report</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {info && (
            <Popover><PopoverTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} aria-label={label}><Info className="h-3 w-3" /></button>
            </PopoverTrigger><PopoverContent className="w-64 text-xs">{info}</PopoverContent></Popover>
          )}
        </div>
      </div>
      <div className="font-display text-[26px] font-normal mt-1 tabular-nums font-mono">{value}</div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        {delta ? <span className={warning ? "text-warning" : "text-success"}>{delta}</span> : <span />}
        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
      </div>
      {footnote && (
        <div className="mt-1.5 text-[10px] text-muted-foreground border-t pt-1.5">
          <Sparkles className="inline h-2.5 w-2.5 mr-1" />{footnote}
          <button className="ml-1 underline decoration-dotted underline-offset-2" onClick={(e) => { e.stopPropagation(); toast.message("Coverage nudges sent to gap owners"); }}>chase gaps</button>
        </div>
      )}
    </Card>
  );
}

function Indicator({ icon, tone, label, value, onClick }: {
  icon: React.ReactNode; tone: "muted" | "warning" | "danger"; label: string; value: string; onClick: () => void;
}) {
  const border = tone === "danger" ? "border-danger/40 text-danger" : tone === "warning" ? "border-warning/40 text-warning" : "";
  return (
    <button onClick={onClick} className={"text-left border rounded-md p-3 hover:bg-muted/30 " + border}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-1 text-lg font-semibold font-mono tabular-nums">{value}</div>
    </button>
  );
}

function Funnel({ wip, billed, collected, writeoff, creditNotes, onStage }: {
  wip: number; billed: number; collected: number; writeoff: number; creditNotes: number;
  onStage: (stage: "wip" | "billed" | "collected" | "writeoff" | "creditnote") => void;
}) {
  const max = Math.max(wip, 1);
  const width = (v: number) => `${Math.max(6, Math.round((v / max) * 100))}%`;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 items-center">
        <FunnelBar label="WIP" value={wip} widthCss={width(wip)} tone="pending" onClick={() => onStage("wip")} />
        <FunnelBar label="Billed" value={billed} widthCss={width(billed)} tone="accent" onClick={() => onStage("billed")} />
        <FunnelBar label="Collected" value={collected} widthCss={width(collected)} tone="success" onClick={() => onStage("collected")} />
      </div>
      <div className="flex items-center gap-6 text-[11px] pl-1">
        <button onClick={() => onStage("writeoff")} className="inline-flex items-center gap-1.5 text-danger hover:underline">
          <span className="h-1.5 w-6 bg-danger rounded" /> Write-off leak · {formatINR(writeoff)}
        </button>
        <button onClick={() => onStage("creditnote")} className="inline-flex items-center gap-1.5 text-warning hover:underline">
          <span className="h-1.5 w-6 bg-warning rounded" /> Credit-note leak · {formatINR(creditNotes)}
        </button>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, widthCss, tone, onClick }: {
  label: string; value: number; widthCss: string; tone: "pending" | "accent" | "success"; onClick: () => void;
}) {
  const bg = tone === "pending" ? "bg-pending" : tone === "accent" ? "bg-accent" : "bg-success";
  return (
    <button onClick={onClick} className="text-left group">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="h-9 rounded-md bg-muted/40 relative overflow-hidden group-hover:ring-1 group-hover:ring-accent/40">
        <div className={"h-full " + bg} style={{ width: widthCss }} />
        <div className="absolute inset-0 flex items-center px-3 text-[13px] font-mono tabular-nums text-white mix-blend-difference">
          {formatINR(value)}
        </div>
      </div>
    </button>
  );
}

function StatRow({ label, value, onOpen }: { label: string; value: number; onOpen: () => void }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <span className="text-[13px]">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-mono tabular-nums">{value.toLocaleString("en-IN")}</span>
        <Link to="/reports/drill" search={{} as never} onClick={(e) => { e.preventDefault(); onOpen(); }} className="text-xs text-accent hover:underline">
          List →
        </Link>
      </div>
    </li>
  );
}

const PIN_CATALOGUE: { id: string; label: string }[] = [
  { id: "gstat-pending", label: "Appeals pending before GSTAT" },
  { id: "live-by-state", label: "Live matters by branch" },
  { id: "matters-by-forum", label: "Matters by forum / bench" },
  { id: "customs-scn", label: "Customs, Reply to SCN, ongoing" },
  { id: "retainership-fy26", label: "Retainership matters, FY26" },
];

function PinPopover({ pinned, onAdd }: { pinned: string[]; onAdd: (id: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Pin a question</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 py-1">Canned queries</div>
        <ul className="text-[13px]">
          {PIN_CATALOGUE.map((q) => {
            const already = pinned.includes(q.id);
            return (
              <li key={q.id}>
                <button
                  disabled={already}
                  onClick={() => { onAdd(q.id); toast.success("Pinned"); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                >
                  <span>{q.label}</span>
                  {already && <Chip tone="neutral">Pinned</Chip>}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}