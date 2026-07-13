import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, XCircle, MessageSquare, ArrowRight, Clock, Send, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClientRequests, useClientsResolved, useMatters, useUsers } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/lib/format";
import type { ClientChangeRequest } from "@/types";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const slaTone = (h: number) => {
  if (h < 24) return { label: "Fresh", cls: "text-muted-foreground" };
  if (h < 48) return { label: "Ageing", cls: "text-warning" };
  return { label: "Overdue", cls: "text-danger" };
};

const KIND_LABEL: Record<ClientChangeRequest["kind"], string> = {
  "create-client": "New client",
  "update-client": "Update client",
  "create-office": "New office",
  "update-office": "Update office",
  "create-contact": "New contact",
  "update-contact": "Update contact",
};

const STATUS_TONE: Record<ClientChangeRequest["status"], ChipTone> = {
  "Pending Maker": "pending",
  "Pending Checker": "pending",
  "Approved": "success",
  "Rejected": "danger",
};

export function ClientRequestsQueue() {
  const { data: requests } = useClientRequests();
  const { data: clients } = useClientsResolved();
  const { data: matters } = useMatters();
  const { data: users } = useUsers();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const me = users.find((u) => u.id === currentUserId);
  const updateReq = useAppStore((s) => s.updateClientRequest);
  const appendComment = useAppStore((s) => s.appendClientRequestComment);
  const approvePendingClient = useAppStore((s) => s.approvePendingClient);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentRole = useAppStore((s) => s.currentRole);

  const [filter, setFilter] = useState<"all" | "Pending Maker" | "Pending Checker" | "Approved" | "Rejected">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [comment, setComment] = useState("");

  const filtered = useMemo(() => {
    let out = requests;
    if (filter !== "all") out = out.filter((r) => r.status === filter);
    if (q.trim()) {
      const query = q.toLowerCase();
      out = out.filter((r) =>
        r.clientNamePreview.toLowerCase().includes(query) ||
        r.requesterName.toLowerCase().includes(query) ||
        (r.sourceMatterId ?? "").toLowerCase().includes(query),
      );
    }
    return [...out].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, filter, q]);

  const openReq = requests.find((r) => r.id === openId) ?? null;

  const counts = {
    all: requests.length,
    "Pending Maker": requests.filter((r) => r.status === "Pending Maker").length,
    "Pending Checker": requests.filter((r) => r.status === "Pending Checker").length,
    Approved: requests.filter((r) => r.status === "Approved").length,
    Rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  const submitMakerComplete = (r: ClientChangeRequest) => {
    if (!me) return;
    updateReq(r.id, { status: "Pending Checker", makerId: me.id, makerName: me.fullName });
    appendComment(r.id, {
      id: `t-${Date.now()}`,
      authorId: me.id,
      authorName: me.fullName,
      authorRole: currentRole,
      body: "Maker completed record. Sending to checker.",
      at: new Date().toISOString(),
      kind: "system",
    });
    appendAudit({ actor: me.id, actorName: me.fullName, activeRole: currentRole, action: "ccm-maker-complete", resource: "clients" });
    toast.success("Sent to CCM checker");
  };

  const approve = (r: ClientChangeRequest) => {
    if (!me) return;
    updateReq(r.id, { status: "Approved", checkerId: me.id, checkerName: me.fullName });
    appendComment(r.id, {
      id: `t-${Date.now()}`,
      authorId: me.id,
      authorName: me.fullName,
      authorRole: currentRole,
      body: `Approved by checker. ${r.kind === "create-client" ? "Client is now Active." : "Change is on file."}`,
      at: new Date().toISOString(),
      kind: "system",
    });
    appendAudit({ actor: me.id, actorName: me.fullName, activeRole: currentRole, action: "ccm-approve", resource: "clients", matterId: r.sourceMatterId });
    if (r.kind === "create-client" && r.clientId) {
      approvePendingClient(r.clientId);
      const clearedCount = matters.filter((m) => m.clientId === r.clientId && m.tags.includes("client-pending")).length;
      toast.success(`Client approved. Cleared client-pending on ${clearedCount} matter${clearedCount === 1 ? "" : "s"}.`);
    } else {
      toast.success("Change accepted and recorded on the client.");
    }
  };

  const submitReject = () => {
    if (!me || !rejectFor) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Please add a reason so the requester understands the decision.");
      return;
    }
    updateReq(rejectFor, { status: "Rejected", checkerId: me.id, checkerName: me.fullName });
    appendComment(rejectFor, {
      id: `t-${Date.now()}`,
      authorId: me.id,
      authorName: me.fullName,
      authorRole: currentRole,
      body: reason,
      at: new Date().toISOString(),
      kind: "reject-reason",
    });
    appendAudit({ actor: me.id, actorName: me.fullName, activeRole: currentRole, action: "ccm-reject", resource: "clients" });
    toast.message("Request rejected", { description: "Requester has been notified with the reason." });
    setRejectFor(null);
    setRejectReason("");
  };

  const addComment = (r: ClientChangeRequest) => {
    if (!me || !comment.trim()) return;
    appendComment(r.id, {
      id: `t-${Date.now()}`,
      authorId: me.id,
      authorName: me.fullName,
      authorRole: currentRole,
      body: comment.trim(),
      at: new Date().toISOString(),
      kind: "comment",
    });
    setComment("");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-normal">CCM requests</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Client-contact master queue: new clients from intake and change requests from client detail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search requester, client, matter"
            className="h-8 text-xs w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {(["all", "Pending Maker", "Pending Checker", "Approved", "Rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              "h-7 px-3 text-xs rounded-full border",
              filter === f ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : f} <span className="ml-1 opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-md border border-border p-10 text-center text-xs text-muted-foreground">
            Queue is clear. New requests from intake and client detail will land here.
          </div>
        )}
        {filtered.map((r) => {
          const sla = slaTone(r.slaHours);
          const matter = matters.find((m) => m.id === r.sourceMatterId);
          return (
            <button
              key={r.id}
              onClick={() => setOpenId(r.id)}
              className="w-full text-left rounded-lg border border-border bg-background p-3 hover:border-accent/50 hover:bg-accent/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip tone="neutral">{KIND_LABEL[r.kind]}</Chip>
                    <span className="font-medium text-sm">{r.clientNamePreview}</span>
                    {r.clientId && (
                      <span className="font-mono text-[10px] text-muted-foreground">{r.clientId}</span>
                    )}
                    <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Requested by <span className="text-foreground">{r.requesterName}</span> ({r.requesterRole})
                    {matter && (
                      <> · from matter <span className="font-mono">{matter.matterId}</span></>
                    )}
                    <span className={cx("ml-2 inline-flex items-center gap-1", sla.cls)}>
                      <Clock className="h-3 w-3" /> {r.slaHours}h · {sla.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.diff.length} field change{r.diff.length === 1 ? "" : "s"}
                    {r.dedupeMatches.length > 0 && (
                      <span className="ml-2 inline-flex items-center">·&nbsp;
                        <Chip tone="pending">{r.dedupeMatches.length} potential duplicate</Chip>
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
              </div>
            </button>
          );
        })}
      </div>

      <Sheet open={!!openReq} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] p-0 overflow-y-auto">
          {openReq && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-base flex items-center gap-2">
                  {KIND_LABEL[openReq.kind]}: {openReq.clientNamePreview}
                </SheetTitle>
                <div className="text-xs text-muted-foreground">
                  {openReq.requesterName} ({openReq.requesterRole}) · {fmtDate(openReq.createdAt)}
                </div>
              </SheetHeader>
              <div className="p-4 space-y-4 flex-1">
                {openReq.dedupeMatches.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-xs">
                      Possible duplicates. Review before creating a new record.
                      <div className="mt-2 space-y-1">
                        {openReq.dedupeMatches.map((d) => {
                          const c = clients.find((x) => x.id === d.clientId);
                          return (
                            <div key={d.clientId} className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="text-xs">{d.strengthPct}% similar to <span className="font-medium">{c?.name ?? d.clientId}</span></div>
                                <div className="text-[11px] text-muted-foreground">{d.matchedOn}</div>
                                <div className="mt-1 h-1 w-32 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-warning" style={{ width: `${d.strengthPct}%` }} />
                                </div>
                              </div>
                              {c && (
                                <Link to="/client/$id" params={{ id: c.id }} className="text-[11px] text-accent hover:underline">
                                  Open
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Proposed changes</div>
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full compact-table">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Field</th>
                          <th className="px-2 py-1.5 text-left">Current</th>
                          <th className="px-2 py-1.5 text-left">Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openReq.diff.map((d) => (
                          <tr key={d.field} className="border-t border-border">
                            <td className="px-2 py-1.5 text-muted-foreground">{d.field}</td>
                            <td className="px-2 py-1.5 line-through opacity-70">{d.current ?? "—"}</td>
                            <td className="px-2 py-1.5 text-foreground">{d.proposed ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Message thread
                  </div>
                  <div className="rounded-md border border-border divide-y divide-border">
                    {openReq.thread.map((t) => (
                      <div key={t.id} className="p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.authorName}</span>
                          <span className="text-muted-foreground">({t.authorRole})</span>
                          <span className="text-muted-foreground ml-auto">{fmtDate(t.at)}</span>
                        </div>
                        <div className={cx(
                          "mt-1",
                          t.kind === "reject-reason" && "text-danger",
                          t.kind === "system" && "text-muted-foreground italic",
                        )}>{t.body}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a note to the thread"
                      className="h-8 text-xs"
                    />
                    <Button size="sm" className="h-8" onClick={() => addComment(openReq)} disabled={!comment.trim()}>
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {me?.roles.includes("Master Docketer") ? (
                <div className="border-t border-border p-3 flex items-center justify-end gap-2">
                  {openReq.status === "Pending Maker" && (
                    <Button size="sm" onClick={() => submitMakerComplete(openReq)}>
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Submit to checker
                    </Button>
                  )}
                  {openReq.status === "Pending Checker" && (
                    <>
                      <Button size="sm" variant="outline" className="text-danger border-danger/40" onClick={() => setRejectFor(openReq.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => approve(openReq)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                      </Button>
                    </>
                  )}
                  {(openReq.status === "Approved" || openReq.status === "Rejected") && (
                    <div className="text-xs text-muted-foreground">
                      Closed by {openReq.checkerName ?? "—"}.
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-border p-3 text-[11px] text-muted-foreground text-center">
                  Only Master Docketer can act. Comments are visible to you.
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!rejectFor} onOpenChange={(v) => { if (!v) { setRejectFor(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            The requester will see this reason on the thread and as a notification.
          </div>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain what needs to change before this can be approved."
            className="min-h-[100px] text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectFor(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
