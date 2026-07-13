import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Ban, Check, ChevronDown, ChevronRight, Copy as CopyIcon, MessageSquare, Users as UsersIcon, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAppStore } from "@/store/app-store";
import { useMatters, useRtbs, useTimeEntries, useUsers, useClients, useWriteOffs } from "@/hooks/use-data";
import { can } from "@/rbac/matrix";
import { formatINR } from "@/lib/format";
import { fmtHm, toDecimal } from "@/lib/duration";
import type { RTB, TimeEntry } from "@/types";
import { Chip } from "@/components/ui/chip";

type Anomaly = "over12" | "duplicate" | "outside-team";

function anomaliesFor(entry: TimeEntry, allDay: TimeEntry[], matterTeam: Set<string>): Anomaly[] {
  const flags: Anomaly[] = [];
  const dayTotal = allDay
    .filter((e) => e.userId === entry.userId && e.date === entry.date)
    .reduce((s, e) => s + toDecimal(e.hours, e.minutes), 0);
  if (dayTotal > 12) flags.push("over12");
  const dupes = allDay.filter(
    (e) => e.id !== entry.id && e.userId === entry.userId && e.date === entry.date && e.matterId === entry.matterId && e.activityType === entry.activityType && e.hours === entry.hours && e.minutes === entry.minutes,
  );
  if (dupes.length > 0) flags.push("duplicate");
  if (!matterTeam.has(entry.userId)) flags.push("outside-team");
  return flags;
}

const anomalyLabel: Record<Anomaly, string> = {
  over12: ">12h day",
  duplicate: "duplicate-looking",
  "outside-team": "non-team matter",
};

export function ApprovalsWorkspace() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const { data: users } = useUsers();
  const { data: matters } = useMatters();
  const { data: rtbs } = useRtbs();
  const { data: entries } = useTimeEntries();
  const { data: clients } = useClients();
  const { data: writeOffs } = useWriteOffs();
  const tsOverrides = useAppStore((s) => s.tsApprovalOverrides);
  const approveTimeEntry = useAppStore((s) => s.approveTimeEntry);
  const queryTimeEntry = useAppStore((s) => s.queryTimeEntry);
  const undoTimeEntryDecision = useAppStore((s) => s.undoTimeEntryDecision);
  const approveRTB = useAppStore((s) => s.approveRTB);
  const declineRTB = useAppStore((s) => s.declineRTB);
  const setWriteOffStatus = useAppStore((s) => s.setWriteOffStatus);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentUser = users.find((u) => u.id === currentUserId);

  const canApproveTs = !!currentUser && can(currentUser, "approve", "approvals-ts");
  const canApproveRtb = !!currentUser && can(currentUser, "approve", "rtb");

  const myMatterIds = useMemo(() => new Set(matters.filter((m) => m.casePartnerId === currentUserId).map((m) => m.id)), [matters, currentUserId]);
  const matterById = useMemo(() => Object.fromEntries(matters.map((m) => [m.id, m])), [matters]);
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const pendingEntries = useMemo(
    () => entries.filter((e) => e.status === "Submitted" && !tsOverrides[e.id] && myMatterIds.has(e.matterId)),
    [entries, tsOverrides, myMatterIds],
  );
  const grouped = useMemo(() => {
    const byPerson = new Map<string, Map<string, TimeEntry[]>>();
    for (const e of pendingEntries) {
      if (!matterById[e.matterId]) continue;
      if (!byPerson.has(e.userId)) byPerson.set(e.userId, new Map());
      const bm = byPerson.get(e.userId)!;
      if (!bm.has(e.matterId)) bm.set(e.matterId, []);
      bm.get(e.matterId)!.push(e);
    }
    return byPerson;
  }, [pendingEntries, matterById]);

  const [openPersons, setOpenPersons] = useState<Set<string>>(new Set());
  const togglePerson = (id: string) =>
    setOpenPersons((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const entryFlags = useMemo(() => {
    const map = new Map<string, Anomaly[]>();
    for (const e of pendingEntries) {
      const matter = matterById[e.matterId];
      if (!matter) continue;
      const team = new Set<string>([matter.casePartnerId, ...(matter.caseManagerId ? [matter.caseManagerId] : []), ...matter.caseAssociateIds, ...matter.paralegalIds]);
      map.set(e.id, anomaliesFor(e, pendingEntries, team));
    }
    return map;
  }, [pendingEntries, matterById]);

  const handleApproveEntry = (e: TimeEntry) => {
    approveTimeEntry(e.id);
    if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Approved time entry ${e.id}`, matterId: e.matterId });
    toast.success("Entry approved", { duration: 4000, action: { label: "Undo", onClick: () => undoTimeEntryDecision(e.id) } });
  };

  const handleBulkApprove = () => {
    const clean = pendingEntries.filter((e) => (entryFlags.get(e.id) ?? []).length === 0);
    const held = pendingEntries.length - clean.length;
    clean.forEach((e) => approveTimeEntry(e.id));
    if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Bulk-approved ${clean.length} timesheet entries` });
    toast.success(`${clean.length} approved · ${held} held`, {
      duration: 6000,
      action: { label: "Undo", onClick: () => clean.forEach((e) => undoTimeEntryDecision(e.id)) },
    });
  };

  const [queryOpen, setQueryOpen] = useState<string | null>(null);
  const [queryBody, setQueryBody] = useState("");
  const submitQuery = (e: TimeEntry) => {
    if (!queryBody.trim() || !currentUser) return;
    queryTimeEntry(e.id, { authorId: currentUser.id, authorName: currentUser.fullName, body: queryBody.trim() });
    appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Queried time entry ${e.id}`, matterId: e.matterId });
    toast.message(`Query sent to ${userById[e.userId]?.fullName ?? "associate"}`, { description: "Their Today gets a row." });
    setQueryBody("");
    setQueryOpen(null);
  };

  const pendingRtbs = useMemo(() => rtbs.filter((r) => r.status === "Pending Approval"), [rtbs]);
  const [rtbDeclineOpen, setRtbDeclineOpen] = useState<string | null>(null);
  const [rtbDeclineReason, setRtbDeclineReason] = useState("");

  const handleApproveRTB = (r: RTB) => {
    approveRTB(r.id, currentUserId);
    if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Approved RTB ${r.rtbNo}`, matterId: r.matterId });
    toast.success(`RTB ${r.rtbNo} approved`, { duration: 6000, description: `Notified raiser: ${userById[r.billedBy]?.fullName ?? r.billedBy}` });
  };
  const submitDeclineRTB = (r: RTB) => {
    if (!rtbDeclineReason.trim()) return;
    declineRTB(r.id, rtbDeclineReason.trim(), currentUserId);
    if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Declined RTB ${r.rtbNo}: ${rtbDeclineReason.trim()}`, matterId: r.matterId });
    toast(`RTB ${r.rtbNo} sent back`, { description: rtbDeclineReason.trim() });
    setRtbDeclineReason("");
    setRtbDeclineOpen(null);
  };

  const crtbs = useMemo(() => rtbs.filter((r) => r.status === "Cancellation Requested"), [rtbs]);
  const voidedRtbs = useMemo(() => rtbs.filter((r) => r.status === "Voided"), [rtbs]);
  const [crtbDeclineOpen, setCrtbDeclineOpen] = useState<string | null>(null);
  const [crtbDeclineReason, setCrtbDeclineReason] = useState("");
  const [woDeclineOpen, setWoDeclineOpen] = useState<string | null>(null);
  const [woDeclineReason, setWoDeclineReason] = useState("");

  const tsCount = pendingEntries.length;
  const rtbCount = pendingRtbs.length;
  const crtbCount = crtbs.length + writeOffs.filter((w) => w.status === "Pending").length;

  if (!currentUser || (!canApproveTs && !canApproveRtb)) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="font-display text-[26px] font-normal tracking-tight">Approvals</h1>
        <Alert className="mt-4"><AlertDescription>You don't have partner approval permissions on this workspace.</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1280px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-normal tracking-tight">Approvals</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Timesheets, RTBs and cancellations awaiting your decision. Every action logs to the audit trail.</p>
      </div>

      <Tabs defaultValue="ts">
        <TabsList>
          <TabsTrigger value="ts">Timesheets <Badge variant="secondary" className="ml-2 font-mono">{tsCount}</Badge></TabsTrigger>
          <TabsTrigger value="rtb">RTB <Badge variant="secondary" className="ml-2 font-mono">{rtbCount}</Badge></TabsTrigger>
          <TabsTrigger value="crtb">CRTB &amp; Write-offs <Badge variant="secondary" className="ml-2 font-mono">{crtbCount}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="ts" className="mt-4 space-y-3">
          {tsCount === 0 ? (
            <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">No timesheet entries awaiting your approval.</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{tsCount} entries across {grouped.size} {grouped.size === 1 ? "person" : "people"}. Flagged rows skip bulk approve.</p>
                <Button size="sm" onClick={handleBulkApprove}><Check className="h-3.5 w-3.5 mr-1" /> Approve all unflagged</Button>
              </div>
              <div className="border rounded-lg divide-y bg-background">
                {[...grouped.entries()].map(([personId, matterMap]) => {
                  const person = userById[personId];
                  const isOpen = openPersons.has(personId);
                  const allE = [...matterMap.values()].flat();
                  const personTotal = allE.reduce((s, e) => s + toDecimal(e.hours, e.minutes), 0);
                  return (
                    <div key={personId}>
                      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left" onClick={() => togglePerson(personId)}>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{person?.fullName ?? personId}</span>
                        <span className="text-xs text-muted-foreground">{person?.branch}</span>
                        <span className="ml-auto text-xs text-muted-foreground font-mono">{personTotal.toFixed(1)}h · {allE.length} entries</span>
                      </button>
                      {isOpen && (
                        <div className="bg-muted/20">
                          {[...matterMap.entries()].map(([mid, es]) => {
                            const m = matterById[mid];
                            return (
                              <div key={mid} className="border-t">
                                <div className="px-6 py-2 flex items-center gap-2 text-xs">
                                  <span className="font-mono text-muted-foreground">{m?.matterId}</span>
                                  <span className="truncate">{m?.title}</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-muted-foreground">{clientById[m?.clientId ?? ""]?.name}</span>
                                </div>
                                <table className="w-full compact-table">
                                  <thead className="text-muted-foreground">
                                    <tr className="border-t">
                                      <th className="text-left px-6 py-1.5 font-medium">Date</th>
                                      <th className="text-left px-2 py-1.5 font-medium">Activity</th>
                                      <th className="text-left px-2 py-1.5 font-medium">h:mm</th>
                                      <th className="text-left px-2 py-1.5 font-medium">Narrative</th>
                                      <th className="text-left px-2 py-1.5 font-medium">Flags</th>
                                      <th className="text-right px-4 py-1.5 font-medium">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {es.map((e) => {
                                      const flags = entryFlags.get(e.id) ?? [];
                                      return (
                                        <tr key={e.id} className="border-t hover:bg-muted/30">
                                          <td className="px-6 py-2 font-mono">{e.date}</td>
                                          <td className="px-2 py-2">{e.activityType}</td>
                                          <td className="px-2 py-2 font-mono">{fmtHm(e.hours, e.minutes)}</td>
                                          <td className="px-2 py-2 max-w-[380px] truncate" title={e.narrative}>{e.narrative}</td>
                                          <td className="px-2 py-2">
                                            {flags.length === 0 ? <span className="text-muted-foreground">—</span> : (
                                              <div className="flex flex-wrap gap-1">
                                                {flags.map((f) => (
                                                  <Chip key={f} tone={f === "over12" ? "danger" : "pending"}>{anomalyLabel[f]}</Chip>
                                                ))}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-right">
                                            <div className="inline-flex gap-1">
                                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleApproveEntry(e)}><Check className="h-3.5 w-3.5" /></Button>
                                              <Popover open={queryOpen === e.id} onOpenChange={(o) => { setQueryOpen(o ? e.id : null); if (!o) setQueryBody(""); }}>
                                                <PopoverTrigger asChild>
                                                  <Button size="sm" variant="ghost" className="h-7 px-2"><MessageSquare className="h-3.5 w-3.5" /></Button>
                                                </PopoverTrigger>
                                                <PopoverContent align="end" className="w-80">
                                                  <p className="text-xs font-medium mb-2">Query to {userById[e.userId]?.fullName}</p>
                                                  <Textarea rows={3} value={queryBody} onChange={(ev) => setQueryBody(ev.target.value)} placeholder="What needs clarification?" className="text-xs" />
                                                  <div className="flex justify-end gap-2 mt-2">
                                                    <Button size="sm" variant="ghost" onClick={() => setQueryOpen(null)}>Cancel</Button>
                                                    <Button size="sm" onClick={() => submitQuery(e)} disabled={!queryBody.trim()}>Send</Button>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="rtb" className="mt-4 space-y-3">
          {pendingRtbs.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">No RTBs pending your approval.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pendingRtbs.map((r) => {
                const m = matterById[r.matterId];
                const client = clientById[m?.clientId ?? ""];
                const raiser = userById[r.billedBy];
                return (
                  <div key={r.id} className="border rounded-lg p-4 bg-background space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono">{r.rtbNo}</span>
                          <Chip tone="pending">Pending Approval</Chip>
                        </div>
                        <p className="text-sm font-medium mt-1 truncate">{m?.title}</p>
                        <p className="text-xs text-muted-foreground">{client?.name} · <span className="font-mono">{m?.matterId}</span> · raised by {raiser?.fullName ?? r.billedBy}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-mono">{formatINR(r.billingAmount)}</p>
                        <p className="text-[11px] text-muted-foreground">{r.items.length} line{r.items.length === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <ul className="text-xs space-y-0.5">
                      {r.items.map((it, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate"><span className="text-muted-foreground">{it.kind}:</span> {it.description}</span>
                          <span className="font-mono">{formatINR(it.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    {r.apportionment && r.apportionment.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.apportionment.map((a) => (
                          <span key={a.partnerId} className="inline-flex text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">
                            {userById[a.partnerId]?.avatarInitials ?? a.partnerId} {a.pct}%
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={() => handleApproveRTB(r)} disabled={!canApproveRtb}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                      <Popover open={rtbDeclineOpen === r.id} onOpenChange={(o) => { setRtbDeclineOpen(o ? r.id : null); if (!o) setRtbDeclineReason(""); }}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline"><X className="h-3.5 w-3.5 mr-1" /> Decline</Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-80">
                          <p className="text-xs font-medium mb-2">Reason for decline</p>
                          <Textarea rows={3} value={rtbDeclineReason} onChange={(e) => setRtbDeclineReason(e.target.value)} placeholder="Required. Sent back to raiser." className="text-xs" />
                          <div className="flex justify-end gap-2 mt-2">
                            <Button size="sm" variant="ghost" onClick={() => setRtbDeclineOpen(null)}>Cancel</Button>
                            <Button size="sm" variant="destructive" onClick={() => submitDeclineRTB(r)} disabled={!rtbDeclineReason.trim()}>Send back</Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="crtb" className="mt-4 space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Cancellation requests</h2>
            {crtbs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cancellation requests.</p>
            ) : (
              <div className="border rounded-lg divide-y bg-background">
                {crtbs.map((r) => {
                  const m = matterById[r.matterId];
                  return (
                    <div key={r.id} className="p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono">{r.rtbNo}</span>
                          <Badge variant="outline" className="text-[10px]">Cancellation Requested</Badge>
                          <span className="text-muted-foreground">raised by {userById[r.billedBy]?.fullName}</span>
                        </div>
                        <p className="text-sm truncate mt-1">{m?.title}</p>
                        <p className="text-xs text-muted-foreground">Reason: Client disputed engagement scope, requesting reissue.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">{formatINR(r.billingAmount)}</p>
                        {r.invoiceNo && <p className="text-[11px] text-muted-foreground font-mono">{r.invoiceNo}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => {
                          approveRTB(r.id, currentUserId);
                          toast.success(`Cancellation of ${r.rtbNo} approved`, { duration: 6000 });
                          if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Approved cancellation of RTB ${r.rtbNo}`, matterId: r.matterId });
                        }} disabled={!canApproveRtb}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                        <Popover open={crtbDeclineOpen === r.id} onOpenChange={(o) => { setCrtbDeclineOpen(o ? r.id : null); if (!o) setCrtbDeclineReason(""); }}>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline"><X className="h-3.5 w-3.5 mr-1" /> Decline</Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80">
                            <p className="text-xs font-medium mb-2">Reason for decline</p>
                            <Textarea rows={3} value={crtbDeclineReason} onChange={(e) => setCrtbDeclineReason(e.target.value)} className="text-xs" />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button size="sm" variant="ghost" onClick={() => setCrtbDeclineOpen(null)}>Cancel</Button>
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (!crtbDeclineReason.trim()) return;
                                declineRTB(r.id, crtbDeclineReason.trim(), currentUserId);
                                toast(`Cancellation of ${r.rtbNo} declined`, { description: crtbDeclineReason.trim() });
                                if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Declined cancellation of RTB ${r.rtbNo}` });
                                setCrtbDeclineReason("");
                                setCrtbDeclineOpen(null);
                              }} disabled={!crtbDeclineReason.trim()}>Send back</Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Write-off requests</h2>
            {writeOffs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No write-off requests.</p>
            ) : (
              <div className="border rounded-lg divide-y bg-background">
                {writeOffs.map((w) => {
                  const r = rtbs.find((x) => x.id === w.rtbId);
                  const m = matterById[w.matterId];
                  return (
                    <div key={w.id} className="p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono">{r?.rtbNo ?? w.rtbId}</span>
                          <Badge variant="outline" className="text-[10px]">Write-off · {w.agingDays}d aged</Badge>
                          <span className="text-muted-foreground">raised by {w.requestedByName}</span>
                        </div>
                        <p className="text-sm truncate mt-1">{m?.title}</p>
                        <p className="text-xs text-muted-foreground">{w.reason}</p>
                        {w.status === "Approved" && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-[hsl(var(--pending)/0.15)] text-[hsl(var(--pending))] mt-2">
                            <ArrowRight className="h-3 w-3" /> Accounts action pending
                          </span>
                        )}
                        {w.status === "Declined" && w.declineReason && (
                          <p className="text-[11px] text-[hsl(var(--danger))] mt-2">Declined: {w.declineReason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">{formatINR(w.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">write-off</p>
                      </div>
                      {w.status === "Pending" ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => {
                            setWriteOffStatus(w.id, "Approved");
                            toast.success(`Write-off ${formatINR(w.amount)} approved`, { duration: 6000, description: "Accounts action pending." });
                            if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Approved write-off ${formatINR(w.amount)} on RTB ${r?.rtbNo}`, matterId: w.matterId });
                          }} disabled={!canApproveRtb}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                          <Popover open={woDeclineOpen === w.id} onOpenChange={(o) => { setWoDeclineOpen(o ? w.id : null); if (!o) setWoDeclineReason(""); }}>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline"><X className="h-3.5 w-3.5 mr-1" /> Decline</Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80">
                              <p className="text-xs font-medium mb-2">Reason for decline</p>
                              <Textarea rows={3} value={woDeclineReason} onChange={(e) => setWoDeclineReason(e.target.value)} className="text-xs" />
                              <div className="flex justify-end gap-2 mt-2">
                                <Button size="sm" variant="ghost" onClick={() => setWoDeclineOpen(null)}>Cancel</Button>
                                <Button size="sm" variant="destructive" onClick={() => {
                                  if (!woDeclineReason.trim()) return;
                                  setWriteOffStatus(w.id, "Declined", woDeclineReason.trim());
                                  toast(`Write-off declined`, { description: woDeclineReason.trim() });
                                  if (currentUser) appendAudit({ actor: currentUser.id, actorName: currentUser.fullName, activeRole: currentRole, action: `Declined write-off on RTB ${r?.rtbNo}` });
                                  setWoDeclineReason("");
                                  setWoDeclineOpen(null);
                                }} disabled={!woDeclineReason.trim()}>Send back</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{w.status}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {voidedRtbs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Ban className="h-4 w-4 text-[hsl(var(--danger))]" /> Voided RTBs</h2>
              <p className="text-[11px] text-muted-foreground">Wrongly-initiated RTBs are marked voided; they cannot be edited and must not be reused.</p>
              <div className="border rounded-lg divide-y bg-background">
                {voidedRtbs.map((r) => (
                  <div key={r.id} className="p-3 flex items-center gap-3">
                    <CopyIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs line-through text-muted-foreground">{r.rtbNo}</span>
                    <span className="text-xs line-through text-muted-foreground truncate">{matterById[r.matterId]?.title}</span>
                    <span className="ml-auto text-[11px] font-semibold text-[hsl(var(--danger))] uppercase tracking-wide">Do not use</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
