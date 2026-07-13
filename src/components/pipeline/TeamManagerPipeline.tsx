import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Download,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMails, useMatters, useUsers, useClientRequests } from "@/hooks/use-data";
import { useAppStore, type MailReassignment } from "@/store/app-store";
import { differenceInHours } from "date-fns";
import { InlineErrorAlert } from "@/components/common/ErrorAlert";

type RangeFilter = "all" | "today";
type PipelineRole = "Docketer" | "Maker" | "Checker" | "Master Docketer";

export function TeamManagerPipeline() {
  const { data: users } = useUsers();
  const { data: mails } = useMails();
  const { data: matters } = useMatters();
  const { data: clientRequests } = useClientRequests();
  const overrides = useAppStore((s) => s.matterPipelineOverrides);
  const reassignments = useAppStore((s) => s.mailPipelineReassignments);
  const rebalanceMail = useAppStore((s) => s.rebalanceMail);
  const undoRebalanceMail = useAppStore((s) => s.undoRebalanceMail);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const navigate = useNavigate();

  const [range, setRange] = useState<RangeFilter>("all");
  const [rebalanceOpen, setRebalanceOpen] = useState<PipelineRole | null>(null);
  const [errored, setErrored] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId);

  // Filter by range
  const inRange = <T extends { receivedAt?: string; createdAt?: string }>(items: T[]): T[] => {
    if (range === "all") return items;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return items.filter((x) => {
      const at = x.receivedAt ?? x.createdAt;
      return at ? new Date(at).getTime() >= dayStart.getTime() : true;
    });
  };

  const filteredMails = useMemo(() => inRange(mails), [mails, range]);
  const filteredMatters = useMemo(() => inRange(matters), [matters, range]);

  // ==== Aging alert: any Inbox Pending >24h ====
  const agingMails = useMemo(
    () =>
      mails.filter(
        (m) =>
          m.queue === "Inbox" &&
          m.state === "Pending" &&
          differenceInHours(new Date(), new Date(m.receivedAt)) > 24,
      ),
    [mails],
  );

  // ==== Docketer aggregate ====
  const docketers = users.filter((u) => u.roles.includes("Docketer"));
  const docketerRows = docketers.map((u) => {
    const assigned = filteredMails.filter((m) => m.assignedDocketerId === u.id);
    const pending = assigned.filter((m) => m.state === "Pending").length;
    const tagged = assigned.filter((m) => m.state === "Tagged").length;
    const discarded = assigned.filter((m) => m.state === "Discarded").length;
    const flagged = assigned.filter((m) => m.state === "Flagged").length;
    const total = assigned.length;
    // Deterministic-but-varied mock stats
    const avgSec = 9 + (u.id.charCodeAt(2) % 8);
    const acceptancePct = 74 + (u.id.charCodeAt(3) % 20);
    return { user: u, pending, tagged, discarded, flagged, total, avgSec, acceptancePct };
  });
  const docketerTotals = docketerRows.reduce(
    (acc, r) => ({
      pending: acc.pending + r.pending,
      tagged: acc.tagged + r.tagged,
      discarded: acc.discarded + r.discarded,
      flagged: acc.flagged + r.flagged,
      total: acc.total + r.total,
    }),
    { pending: 0, tagged: 0, discarded: 0, flagged: 0, total: 0 },
  );

  // ==== Maker aggregate ====
  const makers = users.filter((u) => u.roles.includes("Maker"));
  const makerRows = makers.map((u) => {
    const created = filteredMatters.filter((m) => m.makerId === u.id);
    const awaitingChecker = created.filter((m) => m.pipelineState === "Pending").length;
    const rejectedBack = created.filter((m) => m.pipelineState === "Rejected").length;
    const total = created.length;
    const avgMin = 8 + (u.id.charCodeAt(2) % 6);
    return { user: u, created: total, awaitingChecker, rejectedBack, avgMin };
  });
  const makerTotals = makerRows.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      awaitingChecker: acc.awaitingChecker + r.awaitingChecker,
      rejectedBack: acc.rejectedBack + r.rejectedBack,
    }),
    { created: 0, awaitingChecker: 0, rejectedBack: 0 },
  );

  // ==== Checker aggregate ====
  const checkers = users.filter((u) => u.roles.includes("Checker"));
  const checkerRows = checkers.map((u) => {
    // Pending = mail-created matters awaiting Checker (unassigned pool is shared here; show even split)
    const share = checkers.length || 1;
    const pendingAll = filteredMatters.filter(
      (m) => m.createdVia === "mail" && m.pipelineState === "Pending",
    ).length;
    const pending = Math.ceil(pendingAll / share);
    // Approved/Rejected from overrides where actor was this checker
    const approved = Object.values(overrides).filter(
      (o) => o.actorId === u.id && o.pipelineState === "Approved",
    ).length;
    const rejected = Object.values(overrides).filter(
      (o) => o.actorId === u.id && o.pipelineState === "Rejected",
    );
    // Top reject reasons
    const reasonCount = new Map<string, number>();
    for (const o of rejected) {
      if (!o.reason) continue;
      reasonCount.set(o.reason, (reasonCount.get(o.reason) ?? 0) + 1);
    }
    const topReasons = [...reasonCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return { user: u, pending, approved, rejected: rejected.length, topReasons };
  });
  const checkerTotals = checkerRows.reduce(
    (acc, r) => ({
      pending: acc.pending + r.pending,
      approved: acc.approved + r.approved,
      rejected: acc.rejected + r.rejected,
    }),
    { pending: 0, approved: 0, rejected: 0 },
  );

  // ==== Master Docketer aggregate — wired to /client/requests ====
  const masterDocketers = users.filter((u) => u.roles.includes("Master Docketer"));
  const mdRows = masterDocketers.map((u) => {
    const pending = clientRequests.filter(
      (r) => r.status === "Pending Maker" || r.status === "Pending Checker",
    ).length;
    const approved = clientRequests.filter((r) => r.status === "Approved").length;
    const rejected = clientRequests.filter((r) => r.status === "Rejected").length;
    const oldestHours = clientRequests
      .filter((r) => r.status === "Pending Maker" || r.status === "Pending Checker")
      .reduce((max, r) => Math.max(max, r.slaHours), 0);
    return { user: u, pending, approved, rejected, oldestHours };
  });
  const mdTotals = mdRows.reduce(
    (acc, r) => ({
      pending: acc.pending + r.pending,
      approved: acc.approved + r.approved,
      rejected: acc.rejected + r.rejected,
    }),
    { pending: 0, approved: 0, rejected: 0 },
  );

  const drillMails = (params: Record<string, string>) => {
    void navigate({
      to: "/mails",
      search: params,
    }).catch(() => navigate({ to: "/mails" }));
  };

  const doExport = (section: string) => {
    toast.success(`${section} export queued`, { description: "CSV emailed to you shortly." });
    appendAudit({
      actor: currentUserId,
      actorName: currentUser?.fullName ?? "user",
      activeRole: currentRole,
      action: `pipeline.export:${section}`,
      resource: "pipeline",
    });
  };

  if (errored) {
    return (
      <div className="p-6">
        <InlineErrorAlert
          title="Could not load pipeline"
          message="Aggregate metrics service returned an error."
          errorSeed="pipeline-root"
          onRetry={() => setErrored(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Team Manager pipeline</h1>
          <p className="text-[13px] text-muted-foreground mt-1">The inbox, becoming cases.</p>
          <p className="text-sm text-muted-foreground">
            Docketer, Maker, Checker, Master Docketer throughput. Counts drill into filtered lists.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as RangeFilter)}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="today">Today</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => doExport("pipeline")}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Aging strip */}
      {agingMails.length > 0 && (
        <div className="rounded-md border border-[hsl(var(--danger))]/40 bg-[hsl(var(--danger))]/5 px-3 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--danger))]" />
            <span>
              <span className="font-medium">{agingMails.length}</span> Inbox mail
              {agingMails.length === 1 ? "" : "s"} pending &gt; 24h.
            </span>
            <Chip tone="danger">Critical alert fired</Chip>
          </div>
          <Button size="sm" variant="ghost" onClick={() => drillMails({ queue: "inbox", aging: "24h" })}>
            Open
          </Button>
        </div>
      )}

      <Accordion type="multiple" defaultValue={["docketer", "maker", "checker", "md"]} className="space-y-2">
        {/* DOCKETER */}
        <AccordionItem value="docketer" className="border border-border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3 w-full">
              <span className="font-medium">Docketer</span>
              <Chip tone="neutral">{docketerRows.length} people</Chip>
              <span className="ml-auto text-xs text-muted-foreground">
                Pending {docketerTotals.pending} · Tagged {docketerTotals.tagged} · Flagged{" "}
                {docketerTotals.flagged}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="flex items-center justify-end gap-2 px-4 pb-2">
              <Button size="sm" variant="outline" onClick={() => setRebalanceOpen("Docketer")}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rebalance
              </Button>
            </div>
            <table className="w-full compact-table">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-right px-3 py-2 font-medium">Pending</th>
                  <th className="text-right px-3 py-2 font-medium">Tagged</th>
                  <th className="text-right px-3 py-2 font-medium">Discarded</th>
                  <th className="text-right px-3 py-2 font-medium">Flagged</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-right px-3 py-2 font-medium">Avg s/mail</th>
                  <th className="text-right px-4 py-2 font-medium">AI accept %</th>
                </tr>
              </thead>
              <tbody>
                {docketerRows.map((r) => (
                  <tr key={r.user.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2">{r.user.fullName}</td>
                    <DrillCell n={r.pending} onClick={() => drillMails({ assigned: r.user.id, state: "Pending" })} />
                    <DrillCell n={r.tagged} onClick={() => drillMails({ assigned: r.user.id, state: "Tagged" })} />
                    <DrillCell n={r.discarded} onClick={() => drillMails({ assigned: r.user.id, state: "Discarded" })} />
                    <DrillCell n={r.flagged} onClick={() => drillMails({ assigned: r.user.id, state: "Flagged" })} />
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.total}</td>
                    <td className={cn(
                      "px-3 py-2 text-right font-mono text-xs",
                      r.avgSec > 13 && "text-[hsl(var(--warning))] font-medium",
                    )}>
                      {r.avgSec}s
                      <span className="text-muted-foreground/70"> / 13s</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.acceptancePct}%</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 text-xs font-medium">
                  <td className="px-4 py-2">Totals</td>
                  <td className="px-3 py-2 text-right font-mono">{docketerTotals.pending}</td>
                  <td className="px-3 py-2 text-right font-mono">{docketerTotals.tagged}</td>
                  <td className="px-3 py-2 text-right font-mono">{docketerTotals.discarded}</td>
                  <td className="px-3 py-2 text-right font-mono">{docketerTotals.flagged}</td>
                  <td className="px-3 py-2 text-right font-mono">{docketerTotals.total}</td>
                  <td className="px-3 py-2" />
                  <td className="px-4 py-2" />
                </tr>
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>

        {/* MAKER */}
        <AccordionItem value="maker" className="border border-border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3 w-full">
              <span className="font-medium">Maker</span>
              <Chip tone="neutral">{makerRows.length} people</Chip>
              <span className="ml-auto text-xs text-muted-foreground">
                Created {makerTotals.created} · Awaiting Checker {makerTotals.awaitingChecker} · Rejected back {makerTotals.rejectedBack}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="flex items-center justify-end gap-2 px-4 pb-2">
              <Button size="sm" variant="outline" onClick={() => setRebalanceOpen("Maker")}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rebalance
              </Button>
            </div>
            <table className="w-full compact-table">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-right px-3 py-2 font-medium">Created</th>
                  <th className="text-right px-3 py-2 font-medium">Awaiting Checker</th>
                  <th className="text-right px-3 py-2 font-medium">Rejected back</th>
                  <th className="text-right px-4 py-2 font-medium">Avg min/matter</th>
                </tr>
              </thead>
              <tbody>
                {makerRows.map((r) => (
                  <tr key={r.user.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2">{r.user.fullName}</td>
                    <DrillCell n={r.created} onClick={() => drillMails({ maker: r.user.id })} />
                    <DrillCell n={r.awaitingChecker} onClick={() => drillMails({ maker: r.user.id, pipeline: "Pending" })} />
                    <DrillCell n={r.rejectedBack} onClick={() => drillMails({ maker: r.user.id, pipeline: "Rejected" })} />
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.avgMin} min</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 text-xs font-medium">
                  <td className="px-4 py-2">Totals</td>
                  <td className="px-3 py-2 text-right font-mono">{makerTotals.created}</td>
                  <td className="px-3 py-2 text-right font-mono">{makerTotals.awaitingChecker}</td>
                  <td className="px-3 py-2 text-right font-mono">{makerTotals.rejectedBack}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>

        {/* CHECKER */}
        <AccordionItem value="checker" className="border border-border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3 w-full">
              <span className="font-medium">Checker</span>
              <Chip tone="neutral">{checkerRows.length} people</Chip>
              <span className="ml-auto text-xs text-muted-foreground">
                Pending {checkerTotals.pending} · Approved {checkerTotals.approved} · Rejected {checkerTotals.rejected}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <div className="flex items-center justify-end gap-2 px-4 pb-2">
              <Button size="sm" variant="outline" onClick={() => setRebalanceOpen("Checker")}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rebalance
              </Button>
            </div>
            <table className="w-full compact-table">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-right px-3 py-2 font-medium">Pending</th>
                  <th className="text-right px-3 py-2 font-medium">Approved</th>
                  <th className="text-right px-3 py-2 font-medium">Rejected</th>
                  <th className="text-left px-4 py-2 font-medium">Top reject reasons</th>
                </tr>
              </thead>
              <tbody>
                {checkerRows.map((r) => (
                  <tr key={r.user.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2">{r.user.fullName}</td>
                    <DrillCell n={r.pending} onClick={() => drillMails({ checker: r.user.id, pipeline: "Pending" })} />
                    <DrillCell n={r.approved} onClick={() => drillMails({ checker: r.user.id, pipeline: "Approved" })} />
                    <DrillCell n={r.rejected} onClick={() => drillMails({ checker: r.user.id, pipeline: "Rejected" })} />
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.topReasons.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        ) : (
                          r.topReasons.map(([reason, n]) => (
                            <Chip key={reason} tone="pending">{reason} {n}</Chip>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 text-xs font-medium">
                  <td className="px-4 py-2">Totals</td>
                  <td className="px-3 py-2 text-right font-mono">{checkerTotals.pending}</td>
                  <td className="px-3 py-2 text-right font-mono">{checkerTotals.approved}</td>
                  <td className="px-3 py-2 text-right font-mono">{checkerTotals.rejected}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>

        {/* MASTER DOCKETER (wired to /client/requests) */}
        <AccordionItem value="md" className="border border-border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3 w-full">
              <span className="font-medium">Master Docketer</span>
              <Chip tone="neutral">{mdRows.length} people</Chip>
              <span className="ml-auto text-xs text-muted-foreground">
                Pending {mdTotals.pending} · Approved {mdTotals.approved} · Rejected {mdTotals.rejected}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            <table className="w-full compact-table">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-right px-3 py-2 font-medium">Client req. pending</th>
                  <th className="text-right px-3 py-2 font-medium">Approved</th>
                  <th className="text-right px-3 py-2 font-medium">Rejected</th>
                  <th className="text-right px-4 py-2 font-medium">Oldest SLA</th>
                </tr>
              </thead>
              <tbody>
                {mdRows.map((r) => (
                  <tr key={r.user.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2">{r.user.fullName}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="font-mono text-xs underline decoration-dotted underline-offset-2 text-[hsl(var(--accent))] hover:text-foreground"
                        onClick={() => navigate({ to: "/client/requests" })}
                      >
                        {r.pending}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.approved}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.rejected}</td>
                    <td className={cn(
                      "px-4 py-2 text-right font-mono text-xs",
                      r.oldestHours > 24 && "text-[hsl(var(--warning))] font-medium",
                      r.oldestHours > 48 && "text-[hsl(var(--danger))]",
                    )}>
                      {r.oldestHours > 0 ? `${r.oldestHours}h` : "—"}
                      {r.oldestHours > 24 && <Clock className="inline h-3 w-3 ml-1" />}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 text-xs font-medium">
                  <td className="px-4 py-2">Totals</td>
                  <td className="px-3 py-2 text-right font-mono">{mdTotals.pending}</td>
                  <td className="px-3 py-2 text-right font-mono">{mdTotals.approved}</td>
                  <td className="px-3 py-2 text-right font-mono">{mdTotals.rejected}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Rebalance modal */}
      <RebalanceSheet
        openRole={rebalanceOpen}
        onClose={() => setRebalanceOpen(null)}
        pendingMails={mails.filter((m) => m.state === "Pending" && !reassignments[m.id])}
        users={users}
        onRebalance={(mailIds, toUserId, role, note) => {
          const at = new Date().toISOString();
          const previous = new Map<string, MailReassignment | undefined>();
          mailIds.forEach((mid) => {
            previous.set(mid, reassignments[mid]);
            const mail = mails.find((m) => m.id === mid);
            const fromUserId = mail?.assignedDocketerId ?? "";
            rebalanceMail(mid, { fromUserId, toUserId, role, at, note });
            appendAudit({
              actor: currentUserId,
              actorName: currentUser?.fullName ?? "manager",
              activeRole: currentRole,
              action: `pipeline.rebalance:${role}`,
              resource: "mails",
            });
          });
          const toUser = users.find((u) => u.id === toUserId);
          toast.success(`Reassigned ${mailIds.length} mail${mailIds.length === 1 ? "" : "s"} to ${toUser?.fullName ?? "user"}`, {
            duration: 6000,
            action: {
              label: "Undo",
              onClick: () => {
                mailIds.forEach((mid) => {
                  const prev = previous.get(mid);
                  if (prev) rebalanceMail(mid, prev);
                  else undoRebalanceMail(mid);
                });
                toast("Rebalance undone");
              },
            },
          });
          setRebalanceOpen(null);
        }}
      />
    </div>
  );
}

function DrillCell({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <td className="px-3 py-2 text-right">
      <button
        onClick={onClick}
        className="font-mono text-xs underline decoration-dotted underline-offset-2 text-[hsl(var(--accent))] hover:text-foreground disabled:opacity-40 disabled:no-underline"
        disabled={n === 0}
      >
        {n}
      </button>
    </td>
  );
}

function RebalanceSheet({
  openRole,
  onClose,
  pendingMails,
  users,
  onRebalance,
}: {
  openRole: PipelineRole | null;
  onClose: () => void;
  pendingMails: { id: string; subject: string; assignedDocketerId: string; receivedAt: string }[];
  users: { id: string; fullName: string; roles: string[]; capacityPct: number }[];
  onRebalance: (mailIds: string[], toUserId: string, role: PipelineRole, note: string) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [toUser, setToUser] = useState<string>("");
  const [note, setNote] = useState("");

  const roleMap: Record<PipelineRole, string> = {
    Docketer: "Docketer",
    Maker: "Maker",
    Checker: "Checker",
    "Master Docketer": "Master Docketer",
  };
  const eligibleUsers = openRole
    ? users.filter((u) => u.roles.includes(roleMap[openRole]))
    : [];

  return (
    <Sheet
      open={!!openRole}
      onOpenChange={(o) => {
        if (!o) {
          setPicked(new Set());
          setToUser("");
          setNote("");
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-[560px]">
        <SheetHeader>
          <SheetTitle>Rebalance {openRole}</SheetTitle>
          <SheetDescription>
            Move selected Pending mails to another {openRole?.toLowerCase()}. This is reversible.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Assign to
            </label>
            <Select value={toUser} onValueChange={setToUser}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder="Pick a teammate…" />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {u.capacityPct}% load
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Select mails ({picked.size} of {pendingMails.length})
            </label>
            <div className="mt-1 max-h-[280px] overflow-y-auto rounded-md border border-border">
              {pendingMails.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  No pending mails to rebalance.
                </div>
              ) : (
                pendingMails.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-start gap-2 px-3 py-1.5 border-b border-border last:border-b-0 text-xs cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={picked.has(m.id)}
                      onCheckedChange={(v) => {
                        setPicked((s) => {
                          const n = new Set(s);
                          if (v) n.add(m.id);
                          else n.delete(m.id);
                          return n;
                        });
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{m.subject || "(no subject)"}</div>
                      <div className="text-muted-foreground">
                        assigned {users.find((u) => u.id === m.assignedDocketerId)?.fullName ?? "unknown"}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <Textarea
              className="mt-1 min-h-[60px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for the assignee…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!toUser || picked.size === 0 || !openRole}
              onClick={() => {
                if (!openRole) return;
                onRebalance([...picked], toUser, openRole, note);
                setPicked(new Set());
                setToUser("");
                setNote("");
              }}
            >
              <ChevronDown className="h-4 w-4 mr-1 rotate-[-90deg]" />
              Confirm reassignment
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}