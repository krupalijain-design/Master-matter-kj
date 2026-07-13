import { useMemo, useRef } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Download, Bookmark, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMatters, useClients, useUsers, useRtbs, useHearings } from "@/hooks/use-data";
import { formatINR } from "@/lib/format";
import type { Hearing, Matter, RTB } from "@/types";
import { useAppStore } from "@/store/app-store";
import { kpiToReport } from "@/lib/kpi-to-report";
import { PinToBoardMenu } from "@/components/reports/PinToBoardMenu";

type DrillKind = "matters" | "rtb";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function unbilledWipForMatter(m: Matter, rtbs: RTB[]): number {
  // Fictional heuristic: feeQuote - already-billed (billingAmount sum). Non-negative.
  const billed = rtbs.filter((r) => r.matterId === m.id).reduce((s, r) => s + r.billingAmount, 0);
  const base = m.feeQuote ?? 350000;
  return Math.max(0, base - billed);
}

function matterAgeDays(m: Matter): number { return daysSince(m.createdAt); }

function applyMatterFilter(matters: Matter[], rtbs: RTB[], hearings: Hearing[], filter: string, currentPartnerId: string): Matter[] {
  // Firm-wide (Management Cockpit) filters
  if (filter === "active-matters-firm") return matters.filter((m) => m.status === "Ongoing");
  if (filter === "aged-wip-firm") return matters.filter((m) => m.status === "Ongoing" && matterAgeDays(m) > 60 && unbilledWipForMatter(m, rtbs) > 0);
  if (filter === "pipeline-pending-firm") return matters.filter((m) => m.pipelineState === "Pending");
  if (filter === "deadline-14-firm") return matters.filter((m) => hearings.some((h) => h.matterId === m.id && daysSince(h.date) > -1 && daysSince(h.date) <= 14));
  if (filter === "coverage-by-team") return matters.filter((m) => m.status === "Ongoing");
  if (filter === "customs-scn") return matters.filter((m) => m.subCategory === "Customs" && m.deliverable === "Reply to SCN" && m.status === "Ongoing");
  if (filter === "retainership-fy26") return matters.filter((m) => m.deliverable === "Retainership" && m.status === "Ongoing");
  if (filter === "forum-mix") {
    const ids = new Set(hearings.map((h) => h.matterId));
    return matters.filter((m) => ids.has(m.id));
  }
  if (filter.startsWith("forum:")) {
    const forum = filter.slice("forum:".length);
    const ids = new Set(hearings.filter((h) => h.forum === forum).map((h) => h.matterId));
    return matters.filter((m) => ids.has(m.id));
  }
  switch (filter) {
    case "unallocated":
      return matters.filter((m) => m.allocationState === "Unallocated");
    case "active-matters":
      return matters.filter((m) => m.status === "Ongoing" && m.casePartnerId === currentPartnerId);
    case "aged-wip-60":
      return matters.filter((m) => m.status === "Ongoing" && m.casePartnerId === currentPartnerId && matterAgeDays(m) > 60 && unbilledWipForMatter(m, rtbs) > 0);
    case "ageing:0-30":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && matterAgeDays(m) <= 30 && unbilledWipForMatter(m, rtbs) > 0);
    case "ageing:31-60":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && matterAgeDays(m) > 30 && matterAgeDays(m) <= 60 && unbilledWipForMatter(m, rtbs) > 0);
    case "ageing:61-plus":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && matterAgeDays(m) > 60 && unbilledWipForMatter(m, rtbs) > 0);
    case "deadline-14":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && m.referenceDate && daysSince(m.referenceDate) > -14 && daysSince(m.referenceDate) < 14);
    case "status:ongoing":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && m.status === "Ongoing" && !m.tags.includes("client-pending") && matterAgeDays(m) <= 30);
    case "status:awaiting-client":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && m.tags.includes("client-pending"));
    case "status:stuck-30":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && m.status === "Ongoing" && matterAgeDays(m) > 30);
    case "status:partial-details":
      return matters.filter((m) => m.casePartnerId === currentPartnerId && m.tags.includes("partial-details"));
    case "person-load":
      return matters; // caller passes explicit person filter via search q
    default:
      return matters;
  }
}

function applyRtbFilter(rtbs: RTB[], filter: string): RTB[] {
  if (filter === "funnel-wip") return rtbs.filter((r) => r.status !== "Voided" && r.status !== "Written Off");
  if (filter === "funnel-billed") return rtbs.filter((r) => r.status === "Invoiced" || r.status === "Paid");
  if (filter === "funnel-collected") return rtbs.filter((r) => r.status === "Paid");
  if (filter === "funnel-writeoff") return rtbs.filter((r) => r.status === "Written Off");
  if (filter === "funnel-creditnote") return rtbs.filter((r) => r.status === "Cancellation Requested" || r.status === "Voided");
  if (filter.startsWith("partner:")) {
    const uid = filter.slice("partner:".length);
    return rtbs.filter((r) => r.billedBy === uid && r.status !== "Draft");
  }
  switch (filter) {
    case "rtb-net-fytd":
      return rtbs.filter((r) => r.status === "Paid" || r.status === "Invoiced" || r.status === "Approved");
    default:
      return rtbs;
  }
}

export function DrilledList() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as unknown as Record<string, string | undefined>;
  const kind = (search.kind ?? "matters") as DrillKind;
  const filter = search.filter ?? "";
  const origin = search.origin ?? "Drill";
  const q = search.q ?? "";

  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const { data: rtbs } = useRtbs();
  const { data: hearings } = useHearings();

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
  const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.fullName ?? "" : "");

  const rows = useMemo(() => {
    if (kind === "rtb") {
      const base = applyRtbFilter(rtbs, filter);
      return q ? base.filter((r) => r.rtbNo.includes(q) || clientName(matters.find((m) => m.id === r.matterId)?.clientId ?? "").toLowerCase().includes(q.toLowerCase())) : base;
    }
    const base = applyMatterFilter(matters, rtbs, hearings, filter, "u-kavita");
    return q ? base.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()) || String(m.matterId).includes(q) || clientName(m.clientId).toLowerCase().includes(q.toLowerCase())) : base;
  }, [kind, filter, matters, rtbs, hearings, q, clients]);

  const removeOrigin = () => navigate({ to: "/reports/drill", search: { kind, filter: "", origin: "All rows" } as never });

  const userId = useAppStore((s) => s.currentUserId);
  const addReport = useAppStore((s) => s.addReport);
  const savedRef = useRef<string | null>(null);
  const buildReport = () => {
    // Reuse the same def across Save + Pin so both persist consistently.
    const existing = savedRef.current;
    if (existing) {
      const found = useAppStore.getState().reports.find((r) => r.id === existing);
      if (found) return found;
    }
    const def = kpiToReport({ kind: kind === "rtb" ? "rtb" : "matters", filter, name: origin }, userId);
    savedRef.current = def.id;
    return def;
  };
  const saveAsReport = () => {
    const def = buildReport();
    if (!useAppStore.getState().reports.some((r) => r.id === def.id)) addReport(def);
    toast.success(`Saved to My reports: "${def.name}"`, {
      action: { label: "Open report", onClick: () => navigate({ to: "/reports/$id", params: { id: def.id } }) },
      duration: 6000,
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/cockpit" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Back to Cockpit</Link>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Drilled list</h1>
          <div className="mt-2 flex items-center gap-2">
            {origin && (
              <Badge variant="outline" className="gap-1.5 pl-2 pr-1 py-1 border-accent/40 text-accent bg-accent/5">
                From: {origin}
                <button aria-label="Remove origin" onClick={removeOrigin} className="ml-1 rounded hover:bg-accent/10 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{rows.length} {kind === "rtb" ? "RTBs" : "matters"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-7 w-56 text-xs"
              placeholder="Search rows"
              value={q}
              onChange={(e) => navigate({ to: "/reports/drill", search: { ...search, q: e.target.value } as never })}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8" onClick={() => toast.success("CSV export queued")}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={saveAsReport}>
            <Bookmark className="h-3.5 w-3.5 mr-1" /> Save as report
          </Button>
          <PinToBoardMenu buildReport={buildReport} widgetTitle={origin} size="md" />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-background">
        {kind === "rtb" ? (
          <table className="w-full editorial-table">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">RTB No.</th>
                <th className="text-left px-3 py-2 font-medium">Client</th>
                <th className="text-left px-3 py-2 font-medium">Matter</th>
                <th className="text-right px-3 py-2 font-medium">Bill amt</th>
                <th className="text-right px-3 py-2 font-medium">Outstanding</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Billed by</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-muted-foreground">No RTBs match this drill.</td></tr>
              ) : (rows as RTB[]).map((r) => {
                const m = matters.find((x) => x.id === r.matterId);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{r.rtbNo}</td>
                    <td className="px-3 py-2">{m ? clientName(m.clientId) : ""}</td>
                    <td className="px-3 py-2">{m ? <Link to="/matter/$id" params={{ id: m.id }} className="text-accent hover:underline">#{m.matterId}</Link> : ""}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(r.billingAmount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(r.outstandingAmount)}</td>
                    <td className="px-3 py-2 text-xs">{r.status}</td>
                    <td className="px-3 py-2 text-xs">{userName(r.billedBy)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full editorial-table">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Matter ID</th>
                <th className="text-left px-3 py-2 font-medium">Client</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Deliverable</th>
                <th className="text-left px-3 py-2 font-medium">Sub Type</th>
                <th className="text-left px-3 py-2 font-medium">Case Partner</th>
                <th className="text-left px-3 py-2 font-medium">Branch</th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No matters match this drill.</td></tr>
              ) : (rows as Matter[]).map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to="/matter/$id" params={{ id: m.id }} className="text-accent hover:underline">#{m.matterId}</Link>
                  </td>
                  <td className="px-3 py-2">{clientName(m.clientId)}</td>
                  <td className="px-3 py-2 max-w-[420px] truncate">{m.title}</td>
                  <td className="px-3 py-2 text-xs">{m.deliverable}</td>
                  <td className="px-3 py-2 text-xs">{m.subType}</td>
                  <td className="px-3 py-2 text-xs">{userName(m.casePartnerId)}</td>
                  <td className="px-3 py-2 text-xs">{m.branch}</td>
                  <td className="px-3 py-2 font-mono text-xs">{fmtDate(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}