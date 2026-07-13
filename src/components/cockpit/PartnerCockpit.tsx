import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight, ArrowUpRight, Info, AlertTriangle, Clock, Calendar, Users, CheckCircle2, TrendingUp, TrendingDown, Bell, X, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMatters, useRtbs, useTasks, useHearings, useUsers, useClients, useTimeEntries, useNotifications, useNonBillableResolved } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { formatINR, cx } from "@/lib/format";
import { MOCK_TIMESHEET_COVERAGE_PCT, COVERAGE_THRESHOLD_PCT, computeLoadPct } from "@/lib/cockpit-constants";
import type { Matter, RTB, MatterCategory, Branch } from "@/types";
import { kpiToReport, type SaveKind } from "@/lib/kpi-to-report";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bookmark } from "lucide-react";
import { getMetricColor } from "@/lib/theme-colors";

const CATEGORIES: (MatterCategory | "All")[] = ["All", "Tax - Indirect", "Tax - Direct", "International Trade", "Corporate"];
const BRANCHES: (Branch | "All")[] = ["All", "New Delhi", "Mumbai", "Nagpur", "Bengaluru"];

function greetingFor(name: string): string {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const d = new Date();
  const wd = d.toLocaleDateString("en-IN", { weekday: "short" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = d.toLocaleDateString("en-IN", { month: "short" });
  return `${g}, ${name.split(" ")[0]}, ${wd} ${dd} ${mo}`;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function PartnerCockpit() {
  const navigate = useNavigate();
  const { currentUserId, currentRole } = useAppStore();
  const { data: users } = useUsers();
  const { data: matters } = useMatters();
  const { data: rtbs } = useRtbs();
  const { data: tasks } = useTasks();
  const { data: hearings } = useHearings();
  const { data: clients } = useClients();
  const { data: timeEntries } = useTimeEntries();
  const { data: notifications } = useNotifications();
  const { data: nbAll } = useNonBillableResolved();

  const [category, setCategory] = useState<MatterCategory | "All">("All");
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [drawerPerson, setDrawerPerson] = useState<string | null>(null);
  const [approvalRtb, setApprovalRtb] = useState<RTB | null>(null);
  const [dismissedRows, setDismissedRows] = useState<string[]>([]);

  const currentUser = users.find((u) => u.id === currentUserId);
  const displayName = currentUser?.fullName ?? "Partner";

  const myMatters = useMemo(() => matters.filter((m) => m.casePartnerId === currentUserId), [matters, currentUserId]);
  const filteredMatters = useMemo(() => myMatters.filter((m) => (category === "All" || m.category === category) && (branch === "All" || m.branch === branch)), [myMatters, category, branch]);

  const { allocations } = useAppStore();
  const unallocated = matters.filter((m) => m.allocationState === "Unallocated" && !allocations[m.id]);
  const pendingRtbs = rtbs.filter((r) => r.status === "Pending Approval");
  const pendingCrtbs = rtbs.filter((r) => r.status === "Cancellation Requested");
  const pendingTimesheets = 2; // mocked
  const checkerQueueSize = 2;

  // KPI computations
  const activeMattersCount = filteredMatters.filter((m) => m.status === "Ongoing").length;

  const agedUnbilledWip = useMemo(() => {
    // Fictional: for matters >60 days old with feeQuote not yet billed in RTBs.
    return filteredMatters
      .filter((m) => daysAgo(m.createdAt) > 60 && m.status === "Ongoing")
      .reduce((sum, m) => {
        const billed = rtbs.filter((r) => r.matterId === m.id).reduce((s, r) => s + r.billingAmount, 0);
        const wip = Math.max(0, (m.feeQuote ?? 350000) - billed);
        return sum + wip;
      }, 0);
  }, [filteredMatters, rtbs]);

  const grossFytd = useMemo(() => rtbs.filter((r) => r.billedBy === currentUserId && r.status !== "Draft").reduce((s, r) => s + r.billingAmount, 0), [rtbs, currentUserId]);
  const apportionmentDelta = Math.round(grossFytd * 0.08); // fictional net-out
  const netFytd = grossFytd - apportionmentDelta;

  const deadlineLoad14 = useMemo(() => {
    return hearings.filter((h) => {
      const m = matters.find((x) => x.id === h.matterId);
      if (!m || m.casePartnerId !== currentUserId) return false;
      const dd = (new Date(h.date).getTime() - Date.now()) / 86400000;
      return dd >= -1 && dd <= 14;
    });
  }, [hearings, matters, currentUserId]);
  const deadlineWarn = deadlineLoad14.filter((h) => h.readiness === "Prep pending").length;

  // Team bandwidth
  const teamMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of filteredMatters) {
      if (m.caseManagerId) ids.add(m.caseManagerId);
      m.caseAssociateIds.forEach((id) => ids.add(id));
      m.paralegalIds.forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }, [filteredMatters]);

  const bandwidthRows = teamMemberIds.map((uid) => {
    const u = users.find((x) => x.id === uid);
    const openTasks = tasks.filter((t) => t.assigneeId === uid && t.status === "Open");
    const highTasks = openTasks.filter((t) => t.priority === "High").length;
    const personMatters = matters.filter((m) => m.caseManagerId === uid || m.caseAssociateIds.includes(uid) || m.paralegalIds.includes(uid));
    const personHearings = hearings.filter((h) => {
      const m = matters.find((x) => x.id === h.matterId);
      if (!m) return false;
      const dd = (new Date(h.date).getTime() - Date.now()) / 86400000;
      return dd >= 0 && dd <= 7 && (m.caseManagerId === uid || m.caseAssociateIds.includes(uid));
    }).length;
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    const hoursThisWeek = timeEntries
      .filter((t) => t.userId === uid && new Date(t.date) >= weekStart)
      .reduce((s, t) => s + t.hours + t.minutes / 60, 0);
    const load = computeLoadPct({ openTasks: openTasks.length, highTasks, hearings: personHearings, hoursLogged: hoursThisWeek });
    return { user: u, openTasks: openTasks.length, matters: personMatters.length, hoursThisWeek: Math.round(hoursThisWeek * 10) / 10, hearings: personHearings, load, highTasks };
  }).filter((r) => r.user);

  // Matter status split
  const statusSplit = {
    ongoing: filteredMatters.filter((m) => m.status === "Ongoing" && !m.tags.includes("client-pending") && daysAgo(m.createdAt) <= 30).length,
    awaitingClient: filteredMatters.filter((m) => m.tags.includes("client-pending")).length,
    stuck: filteredMatters.filter((m) => m.status === "Ongoing" && daysAgo(m.createdAt) > 30).length,
    partial: filteredMatters.filter((m) => m.tags.includes("partial-details")).length,
  };
  const statusTotal = Math.max(1, statusSplit.ongoing + statusSplit.awaitingClient + statusSplit.stuck + statusSplit.partial);

  // WIP ageing buckets
  const wipBuckets = useMemo(() => {
    const buckets = { "0-30": 0, "31-60": 0, "61-plus": 0 };
    for (const m of filteredMatters) {
      const billed = rtbs.filter((r) => r.matterId === m.id).reduce((s, r) => s + r.billingAmount, 0);
      const wip = Math.max(0, (m.feeQuote ?? 350000) - billed);
      if (wip === 0) continue;
      const age = daysAgo(m.createdAt);
      if (age <= 30) buckets["0-30"] += wip;
      else if (age <= 60) buckets["31-60"] += wip;
      else buckets["61-plus"] += wip;
    }
    return buckets;
  }, [filteredMatters, rtbs]);
  const wipMax = Math.max(1, wipBuckets["0-30"], wipBuckets["31-60"], wipBuckets["61-plus"]);

  const coverageLow = MOCK_TIMESHEET_COVERAGE_PCT < COVERAGE_THRESHOLD_PCT;

  const drill = (filter: string, origin: string, kind: "matters" | "rtb" = "matters") => {
    navigate({ to: "/reports/drill", search: { kind, filter, origin } as never });
  };

  const addReport = useAppStore((s) => s.addReport);
  const saveKpiAsReport = (spec: { kind: SaveKind; filter?: string; name: string }) => {
    const def = kpiToReport(spec, currentUserId);
    addReport(def);
    toast.success(`Saved to My reports: "${def.name}"`, {
      action: { label: "Open report", onClick: () => navigate({ to: "/reports/$id", params: { id: def.id } }) },
      duration: 6000,
    });
  };

  const nextRejoinderMatter = matters.find((m) => m.id === "m-1096251");
  const attentionRows: { key: string; label: string; cta: string; onClick: () => void; warn?: boolean }[] = [];
  if (unallocated.length > 0) attentionRows.push({ key: "alloc", label: `${unallocated.length} matters awaiting allocation`, cta: "Allocate", onClick: () => navigate({ to: "/matter/allocation" }) });
  const approvalsCount = pendingTimesheets + pendingRtbs.length + pendingCrtbs.length;
  if (approvalsCount > 0) attentionRows.push({ key: "approvals", label: `${pendingTimesheets} Timesheet approvals, ${pendingRtbs.length} RTB approval${pendingRtbs.length === 1 ? "" : "s"}, ${pendingCrtbs.length} CRTB request${pendingCrtbs.length === 1 ? "" : "s"}`, cta: "Review", onClick: () => navigate({ to: "/approvals" }) });
  if (nextRejoinderMatter) attentionRows.push({ key: "rejoinder", warn: true, label: "Rejoinder due tomorrow, prep task open, 1096251", cta: "Open", onClick: () => navigate({ to: "/matter/$id", params: { id: nextRejoinderMatter.id } }) });
  const isChecker = currentRole === "Checker" || (currentUser?.roles.includes("Checker") ?? false);
  if (isChecker) attentionRows.push({ key: "checker", label: `${checkerQueueSize} matters awaiting Checker`, cta: "Open", onClick: () => navigate({ to: "/mails" }) });
  const pendingNb = nbAll.filter((n) => n.status === "Submitted" && (n.approverId === currentUserId || (!n.approverId && (currentUser?.roles.includes("Case Partner") ?? false))));
  if (pendingNb.length > 0) attentionRows.push({ key: "nb", label: `${pendingNb.length} non-billable submission${pendingNb.length === 1 ? "" : "s"} awaiting approval`, cta: "Review", onClick: () => navigate({ to: "/nonbillable" }) });
  const visibleAttention = attentionRows.filter((r) => !dismissedRows.includes(r.key));

  // Approve inline: opens drawer for first pending RTB
  const openApprovalDrawer = () => {
    const rtb = pendingRtbs[0];
    if (rtb) setApprovalRtb(rtb);
    else navigate({ to: "/approvals" });
  };

  const approveRtb = (rtb: RTB) => {
    setDismissedRows((d) => [...d, "approvals"]);
    setApprovalRtb(null);
    toast.success(`RTB ${rtb.rtbNo} approved`, {
      action: { label: "Undo", onClick: () => setDismissedRows((d) => d.filter((x) => x !== "approvals")) },
      duration: 6000,
    });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">{greetingFor(displayName)}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your practice at a glance. Every number drills to a filtered list.{" "}
            <Link to="/mis" className="text-accent hover:underline">My MIS boards →</Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as MatterCategory | "All")}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Practice" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "All" ? "All practices" : c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={branch} onValueChange={(v) => setBranch(v as Branch | "All")}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b === "All" ? "All branches" : b}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setScheduleOpen(true)}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Schedule snapshot
          </Button>
        </div>
      </div>

      {/* Needs My Attention */}
      <section className="border rounded-lg bg-[var(--warning-bg,#FFFBEB)] border-[var(--warning-border,#D97706)]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--warning-border,#D97706)]/40">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-[var(--warning,#D97706)]" />
            <span className="text-sm font-medium text-[var(--warning-foreground-dark,#B45309)]">Needs my attention</span>
          </div>
          <span className="text-[11px] text-muted-foreground">{visibleAttention.length} items</span>
        </div>
        {visibleAttention.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-success" /> You're clear ✨
          </div>
        ) : (
          <ul className="divide-y">
            {visibleAttention.map((row) => (
              <li key={row.key} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                <div className="flex items-center gap-2 text-sm">
                  {row.warn && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                  <span>{row.label}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={row.key === "approvals" ? openApprovalDrawer : row.onClick}>
                  {row.cta} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* KPI Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Active matters"
          value={String(activeMattersCount)}
          delta="+3 vs last wk"
          deltaUp
          onClick={() => drill("active-matters", "Active matters")}
          info="All matters where you are Case Partner with status Ongoing."
          onSaveAsReport={() => saveKpiAsReport({ kind: "matters", filter: "active-matters", name: "Active matters" })}
        />
        <KpiCard
          label="Aged unbilled WIP >60d"
          value={formatINR(agedUnbilledWip)}
          delta="+₹4.2L vs last wk"
          warning
          onClick={() => drill("aged-wip-60", "Aged unbilled WIP >60d")}
          info="Estimated unbilled work-in-progress for matters older than 60 days that have no fully raised RTB. Uses Fee Quote minus billed amounts."
          footnote={coverageLow ? { text: `based on ${MOCK_TIMESHEET_COVERAGE_PCT}% timesheet coverage`, ctaLabel: "chase gaps", onCta: () => navigate({ to: "/notifications" }) } : undefined}
          onSaveAsReport={() => saveKpiAsReport({ kind: "matters", filter: "aged-wip-60", name: "Aged unbilled WIP >60d" })}
        />
        <KpiCard
          label="My net billing FYTD"
          value={formatINR(netFytd)}
          delta="after apportionment"
          onClick={() => drill("rtb-net-fytd", "Net billing FYTD", "rtb")}
          infoNode={
            <div className="space-y-1.5 text-xs">
              <div className="font-medium">Net billing math</div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Gross (billed by you)</span><span className="font-mono">{formatINR(grossFytd)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Apportioned out</span><span className="font-mono text-danger">-{formatINR(apportionmentDelta)}</span></div>
              <div className="flex justify-between gap-4 border-t pt-1"><span className="font-medium">Net</span><span className="font-mono font-medium">{formatINR(netFytd)}</span></div>
            </div>
          }
          footnote={coverageLow ? { text: `based on ${MOCK_TIMESHEET_COVERAGE_PCT}% timesheet coverage`, ctaLabel: "chase gaps", onCta: () => navigate({ to: "/notifications" }) } : undefined}
          onSaveAsReport={() => saveKpiAsReport({ kind: "rtb", filter: "rtb-net-fytd", name: "My net billing FYTD" })}
        />
        <KpiCard
          label="Deadline load, next 14 days"
          value={String(deadlineLoad14.length)}
          delta={deadlineWarn > 0 ? `${deadlineWarn} ⚠ prep pending` : "all prepped"}
          warning={deadlineWarn > 0}
          onClick={() => drill("deadline-14", "Deadline load 14d")}
          info="Hearings, filings, and other dated deadlines on your matters within the next 14 days."
          onSaveAsReport={() => saveKpiAsReport({ kind: "matters", filter: "deadline-14", name: "Deadline load, next 14 days" })}
        />
      </section>

      {/* Team Bandwidth */}
      <section className="border rounded-lg bg-background">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="text-sm font-medium">Team bandwidth</span>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="this-week">
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This week</SelectItem>
                <SelectItem value="last-week">Last week</SelectItem>
                <SelectItem value="next-week">Next week</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate({ to: "/matter/allocation" })}>+ Assign</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full editorial-table">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Person</th>
                <th className="text-left px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    Load %
                    <Popover><PopoverTrigger asChild><button aria-label="Load formula"><Info className="h-3 w-3 text-muted-foreground" /></button></PopoverTrigger>
                    <PopoverContent className="w-72 text-xs">
                      <div className="font-medium mb-1">Load formula</div>
                      <div className="text-muted-foreground">
                        (open tasks × 1) + (high-priority × 0.5) + (this-week hearings × 2) + (hours logged ÷ 8), scaled against a 20-point week budget. Not a black box.
                      </div>
                    </PopoverContent></Popover>
                  </span>
                </th>
                <th className="text-right px-3 py-2 font-medium">Matters</th>
                <th className="text-right px-3 py-2 font-medium">Open tasks</th>
                <th className="text-right px-3 py-2 font-medium">Hrs this wk</th>
                <th className="text-right px-3 py-2 font-medium">Hearings</th>
                <th className="text-left px-3 py-2 font-medium">Next free</th>
              </tr>
            </thead>
            <tbody>
              {bandwidthRows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No team members on your active matters yet.</td></tr>
              ) : bandwidthRows.map((r) => (
                <tr key={r.user!.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDrawerPerson(r.user!.id)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={cx("h-7 w-7 rounded-full grid place-items-center text-[10px] font-medium border", r.load >= 95 ? "border-danger text-danger" : r.load >= 80 ? "border-warning text-warning" : "border-border text-muted-foreground")}>
                        {r.user!.avatarInitials}
                      </div>
                      <div>
                        <div className="text-sm">{r.user!.fullName}</div>
                        <div className="text-[11px] text-muted-foreground">{r.user!.roles[0]} · {r.user!.branch}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded bg-muted overflow-hidden">
                        <div className={cx("h-full", r.load >= 95 ? "bg-danger" : r.load >= 80 ? "bg-warning" : "bg-accent")} style={{ width: `${r.load}%` }} />
                      </div>
                      <span className={cx("text-xs font-mono", r.load >= 95 && "text-danger font-semibold")}>{r.load}%{r.load >= 95 ? " ⚠" : ""}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.matters}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.openTasks}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.hoursThisWeek}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.hearings}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.load >= 95 ? "next week" : r.load >= 80 ? "Fri" : "Tomorrow"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lower row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="border rounded-lg bg-background p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">My matters by status</div>
            <span className="text-[11px] text-muted-foreground">{filteredMatters.length} matters</span>
          </div>
          <div className="flex h-8 rounded-md overflow-hidden border">
            <button title="Ongoing" onClick={() => drill("status:ongoing", "Ongoing")} className="bg-accent/70 hover:bg-accent transition-colors" style={{ width: `${(statusSplit.ongoing / statusTotal) * 100}%` }} />
            <button title="Awaiting client" onClick={() => drill("status:awaiting-client", "Awaiting client")} className="bg-pending/70 hover:bg-pending transition-colors" style={{ width: `${(statusSplit.awaitingClient / statusTotal) * 100}%` }} />
            <button title="Stuck >30d" onClick={() => drill("status:stuck-30", "Stuck >30d")} className="bg-danger/70 hover:bg-danger transition-colors" style={{ width: `${(statusSplit.stuck / statusTotal) * 100}%` }} />
            <button title="partial-details" onClick={() => drill("status:partial-details", "partial-details")} className="bg-warning/70 hover:bg-warning transition-colors" style={{ width: `${(statusSplit.partial / statusTotal) * 100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <LegendRow color="bg-accent" label="Ongoing" n={statusSplit.ongoing} onClick={() => drill("status:ongoing", "Ongoing")} />
            <LegendRow color="bg-pending" label="Awaiting client" n={statusSplit.awaitingClient} onClick={() => drill("status:awaiting-client", "Awaiting client")} />
            <LegendRow color="bg-danger" label="Stuck >30d" n={statusSplit.stuck} onClick={() => drill("status:stuck-30", "Stuck >30d")} tooltip="No activity events in the last 30 days." />
            <LegendRow color="bg-warning" label="partial-details" n={statusSplit.partial} onClick={() => drill("status:partial-details", "partial-details")} />
          </div>
        </div>

        <div className="border rounded-lg bg-background p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Unbilled WIP ageing</div>
            <span className="text-[11px] text-muted-foreground">₹ in lakh, click to drill</span>
          </div>
          <div className="space-y-3">
            {([
              { key: "0-30", label: "0–30 days", filter: "ageing:0-30" },
              { key: "31-60", label: "31–60 days", filter: "ageing:31-60" },
              { key: "61-plus", label: "61–90+ days", filter: "ageing:61-plus" },
            ] as const).map((b) => {
              const value = wipBuckets[b.key];
              const pct = (value / wipMax) * 100;
              return (
                <button key={b.key} onClick={() => drill(b.filter, `WIP ageing ${b.label}`)} className="w-full text-left group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground group-hover:text-foreground">{b.label}</span>
                    <span className="font-mono">{formatINR(value)}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className={cx("h-full transition-all", b.key === "61-plus" ? "bg-danger" : b.key === "31-60" ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Schedule snapshot modal */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-base">Schedule cockpit snapshot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Recipients</Label><Input defaultValue="kavita.rao@snowfig.in" className="h-9 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cadence</Label>
                <Select defaultValue="Daily"><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Weekly">Weekly</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Channel</Label>
                <Select defaultValue="Email"><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Email">Email</SelectItem><SelectItem value="Teams">Teams</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select defaultValue="card"><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="card">Inline card</SelectItem><SelectItem value="pdf">PDF attachment</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>Cancel</Button>
            <Button onClick={() => { setScheduleOpen(false); toast.success("Snapshot scheduled"); }}>Save schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Person drawer */}
      <Sheet open={!!drawerPerson} onOpenChange={(v) => !v && setDrawerPerson(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          {drawerPerson && (() => {
            const u = users.find((x) => x.id === drawerPerson)!;
            const personMatters = matters.filter((m) => m.caseManagerId === u.id || m.caseAssociateIds.includes(u.id) || m.paralegalIds.includes(u.id));
            const openTasks = tasks.filter((t) => t.assigneeId === u.id && t.status === "Open");
            const upcoming = hearings.filter((h) => {
              const dd = (new Date(h.date).getTime() - Date.now()) / 86400000;
              return dd >= 0 && dd <= 7 && personMatters.some((m) => m.id === h.matterId);
            });
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs font-medium">{u.avatarInitials}</span>
                    {u.fullName}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4 text-sm">
                  <div className="text-xs text-muted-foreground">{u.roles.join(", ")} · {u.branch} · capacity {u.capacityPct}%</div>
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Matters ({personMatters.length})</div>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {personMatters.slice(0, 8).map((m) => (
                        <li key={m.id}><Link to="/matter/$id" params={{ id: m.id }} className="text-accent hover:underline text-xs font-mono">#{m.matterId}</Link> <span className="text-xs text-muted-foreground truncate"> {m.title.slice(0, 60)}</span></li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Open tasks ({openTasks.length})</div>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {openTasks.slice(0, 6).map((t) => <li key={t.id} className="text-xs">• {t.subject}</li>)}
                    </ul>
                  </section>
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Hearings this week</div>
                    {upcoming.length === 0 ? <div className="text-xs text-muted-foreground">None scheduled.</div> : (
                      <ul className="space-y-1">{upcoming.map((h) => <li key={h.id} className="text-xs">{h.forum} · {new Date(h.date).toLocaleDateString("en-IN")}</li>)}</ul>
                    )}
                  </section>
                  <Button className="w-full" onClick={() => { setDrawerPerson(null); navigate({ to: "/matter/allocation" }); }}>Assign work</Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Approval drawer */}
      <Sheet open={!!approvalRtb} onOpenChange={(v) => !v && setApprovalRtb(null)}>
        <SheetContent className="w-[440px] sm:max-w-[440px]">
          {approvalRtb && (() => {
            const m = matters.find((x) => x.id === approvalRtb.matterId);
            const c = m ? clients.find((x) => x.id === m.clientId) : null;
            return (
              <>
                <SheetHeader><SheetTitle>Approve RTB</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="border rounded-md p-3 space-y-1.5">
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">RTB No.</span><span className="font-mono text-xs">{approvalRtb.rtbNo}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">Client</span><span className="text-xs">{c?.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground text-xs">Matter</span>{m && <Link to="/matter/$id" params={{ id: m.id }} className="text-xs text-accent hover:underline font-mono">#{m.matterId}</Link>}</div>
                    <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground text-xs">Billing amount</span><span className="font-mono font-medium">{formatINR(approvalRtb.billingAmount)}</span></div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Line items</div>
                    <ul className="border rounded-md divide-y">
                      {approvalRtb.items.map((it, i) => (
                        <li key={i} className="flex justify-between px-3 py-1.5 text-xs">
                          <span>{it.kind}: {it.description}</span>
                          <span className="font-mono">{formatINR(it.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Decline with reason</summary>
                    <Textarea className="mt-2" rows={3} placeholder="Reason to send back" />
                    <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => { setApprovalRtb(null); toast("RTB sent back with reason"); }}>Send back</Button>
                  </details>
                  <Button className="w-full" onClick={() => approveRtb(approvalRtb)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KpiCard({
  label, value, delta, deltaUp, warning, onClick, info, infoNode, footnote, onSaveAsReport,
}: {
  label: string;
  value: string;
  delta: string;
  deltaUp?: boolean;
  warning?: boolean;
  onClick: () => void;
  info?: string;
  infoNode?: React.ReactNode;
  footnote?: { text: string; ctaLabel: string; onCta: () => void };
  onSaveAsReport?: () => void;
}) {
  return (
    <div className={cx("border rounded-lg bg-background p-4 hover:border-accent/50 transition-colors cursor-pointer group", warning && "border-warning/40 bg-warning/[0.03]")} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex items-center gap-1">
        {onSaveAsReport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Save this KPI as a report" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-foreground">
                <Bookmark className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onSaveAsReport}>Save as report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button aria-label="Definition" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-foreground">
              <Info className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 text-xs" onClick={(e) => e.stopPropagation()}>
            {infoNode ?? <div className="text-muted-foreground">{info}</div>}
          </PopoverContent>
        </Popover>
        </div>
      </div>
      <div className={cx("mt-2 text-2xl font-semibold tracking-tight tabular-nums", warning && "text-warning")}>{value}</div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          {deltaUp !== undefined && (deltaUp ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-danger" />)}
          {delta}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-accent" />
      </div>
      {/* Sparkline placeholder */}
      <div className="mt-2 flex items-end gap-0.5 h-6">
        {[3, 5, 4, 6, 5, 7, 6, 8, 7, 9].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-sm"
            style={{
              height: `${h * 3}px`,
              backgroundColor: getMetricColor(label, warning),
              opacity: warning ? 1.0 : 0.4
            }}
          />
        ))}
      </div>
      {footnote && (
        <div className="mt-2 text-[10px] text-muted-foreground border-t pt-1.5" onClick={(e) => e.stopPropagation()}>
          {footnote.text} · <button className="text-accent hover:underline" onClick={footnote.onCta}>{footnote.ctaLabel}</button>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label, n, onClick, tooltip }: { color: string; label: string; n: number; onClick: () => void; tooltip?: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50 text-left" title={tooltip}>
      <span className="inline-flex items-center gap-1.5">
        <span className={cx("h-2 w-2 rounded-sm", color)} />
        <span className="text-muted-foreground">{label}</span>
        {tooltip && <Info className="h-2.5 w-2.5 text-muted-foreground" />}
      </span>
      <span className="font-mono">{n}</span>
    </button>
  );
}