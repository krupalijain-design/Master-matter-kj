import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Inbox,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useMatters, useMails, useUsers, useClients } from "@/hooks/use-data";
import { useAppStore, type CheckerRejectReason } from "@/store/app-store";
import { getCheckerPayload } from "@/mocks/checkerReview";
import { formatDistanceToNow } from "date-fns";
import { InlineErrorAlert } from "@/components/common/ErrorAlert";

type QueueTab = "pending" | "approved" | "rejected" | "abandoned";

const REJECT_REASONS: { value: CheckerRejectReason; label: string }[] = [
  { value: "Duplicate", label: "Duplicate, link surviving Matter ID" },
  { value: "Wrong client", label: "Wrong client" },
  { value: "Incomplete", label: "Incomplete details" },
  { value: "Other", label: "Other (add note)" },
];

export function CheckerReviewQueue() {
  const { data: matters } = useMatters();
  const { data: mails } = useMails();
  const { data: users } = useUsers();
  const { data: clients } = useClients();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const setOverride = useAppStore((s) => s.setMatterPipelineOverride);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const overrides = useAppStore((s) => s.matterPipelineOverrides);

  const [tab, setTab] = useState<QueueTab>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejectPickerOpen, setRejectPickerOpen] = useState(false);
  const [errored, setErrored] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId);

  // Only mail-created matters land in the Checker queue.
  const mailMatters = useMemo(
    () => matters.filter((m) => m.createdVia === "mail"),
    [matters],
  );

  const byTab = useMemo(() => {
    const p = mailMatters.filter((m) => m.pipelineState === "Pending");
    const a = mailMatters.filter((m) => m.pipelineState === "Approved");
    const r = mailMatters.filter((m) => m.pipelineState === "Rejected");
    const ab = mailMatters.filter((m) => m.pipelineState === "Abandoned");
    return { pending: p, approved: a, rejected: r, abandoned: ab };
  }, [mailMatters]);

  const active = byTab[tab];

  const openMatter = active.find((m) => m.id === openId) ?? null;
  const payload = openMatter ? getCheckerPayload(openMatter.id) : undefined;
  const sourceMail = payload ? mails.find((m) => m.id === payload.sourceMailId) : undefined;
  const maker = openMatter?.makerId ? users.find((u) => u.id === openMatter.makerId) : undefined;
  const client = openMatter ? clients.find((c) => c.id === openMatter.clientId) : undefined;
  const partner = openMatter ? users.find((u) => u.id === openMatter.casePartnerId) : undefined;

  const advanceToNextPending = useCallback(
    (currentMatterId: string) => {
      const remaining = byTab.pending.filter((m) => m.id !== currentMatterId);
      if (remaining.length) {
        setOpenId(remaining[0].id);
      } else {
        setOpenId(null);
      }
    },
    [byTab.pending],
  );

  const approve = useCallback(
    (matterId: string) => {
      const m = matters.find((x) => x.id === matterId);
      if (!m) return;
      setOverride(matterId, {
        pipelineState: "Approved",
        actorId: currentUserId,
        actorRole: currentRole,
        at: new Date().toISOString(),
      });
      appendAudit({
        actor: currentUserId,
        actorName: currentUser?.fullName ?? "Checker",
        activeRole: currentRole,
        action: "checker.approve",
        resource: "matter",
        matterId,
      });
      toast.success(`Approved: matter ${m.matterId}`, {
        description: `Enters allocation queue. Notification sent to ${partner?.fullName ?? "Case Partner"}.`,
      });
      advanceToNextPending(matterId);
    },
    [matters, setOverride, currentUserId, currentRole, appendAudit, currentUser, partner, advanceToNextPending],
  );

  const reject = useCallback(
    (matterId: string, reason: CheckerRejectReason, note?: string, dupOf?: string) => {
      const m = matters.find((x) => x.id === matterId);
      if (!m) return;
      setOverride(matterId, {
        pipelineState: "Rejected",
        reason,
        reasonNote: note,
        duplicateOfMatterId: dupOf,
        actorId: currentUserId,
        actorRole: currentRole,
        at: new Date().toISOString(),
      });
      appendAudit({
        actor: currentUserId,
        actorName: currentUser?.fullName ?? "Checker",
        activeRole: currentRole,
        action: `checker.reject:${reason}`,
        resource: "matter",
        matterId,
      });
      toast(`Rejected: matter ${m.matterId}`, {
        description: `Reason: ${reason}. Returned to ${maker?.fullName ?? "Maker"} as Action needed.`,
      });
      advanceToNextPending(matterId);
    },
    [matters, setOverride, currentUserId, currentRole, appendAudit, currentUser, maker, advanceToNextPending],
  );

  // Keyboard: ↵ approve, R reject
  useEffect(() => {
    if (!openMatter) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!openMatter) return;
      if (e.key === "Enter" && openMatter.pipelineState === "Pending") {
        e.preventDefault();
        approve(openMatter.id);
      } else if (e.key.toLowerCase() === "r" && openMatter.pipelineState === "Pending") {
        e.preventDefault();
        setRejectPickerOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMatter, approve]);

  // Coaching stats derived from overrides
  const coachingStats = useMemo(() => {
    const counts = new Map<string, Record<CheckerRejectReason, number>>();
    for (const [mid, o] of Object.entries(overrides)) {
      if (o.pipelineState !== "Rejected" || !o.reason) continue;
      const m = matters.find((x) => x.id === mid);
      const makerId = m?.makerId;
      if (!makerId) continue;
      const bucket = counts.get(makerId) ?? { Duplicate: 0, "Wrong client": 0, Incomplete: 0, Other: 0 };
      bucket[o.reason] += 1;
      counts.set(makerId, bucket);
    }
    return counts;
  }, [overrides, matters]);

  if (errored) {
    return (
      <div className="p-6">
        <InlineErrorAlert
          title="Could not load Checker queue"
          message="Mail metadata service did not respond."
          errorSeed={`checker-${tab}`}
          onRetry={() => setErrored(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Review queue</h1>
          <p className="text-sm text-muted-foreground">
            Matters created via mail, awaiting Checker sign-off.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Reviewer: <span className="font-medium text-foreground">{currentUser?.fullName}</span>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-border">
        {(
          [
            { key: "pending", label: "Pending", n: byTab.pending.length, accent: true },
            { key: "approved", label: "Approved", n: byTab.approved.length },
            { key: "rejected", label: "Rejected", n: byTab.rejected.length },
            { key: "abandoned", label: "Abandoned", n: byTab.abandoned.length },
          ] as { key: QueueTab; label: string; n: number; accent?: boolean }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px flex items-center gap-2",
              tab === t.key
                ? "border-[hsl(var(--accent))] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[11px]",
                t.accent && t.n > 0 && "border-[hsl(var(--accent))]/50 text-[hsl(var(--accent))]",
              )}
            >
              {t.n}
            </Badge>
          </button>
        ))}
      </div>

      {/* Coaching strip */}
      {tab === "rejected" && coachingStats.size > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div className="font-medium mb-1.5">Maker coaching, session</div>
          <div className="flex flex-wrap gap-3">
            {[...coachingStats.entries()].map(([mid, bucket]) => {
              const u = users.find((x) => x.id === mid);
              return (
                <div key={mid} className="flex items-center gap-2">
                  <span className="font-medium">{u?.fullName ?? mid}:</span>
                  {(Object.entries(bucket) as [CheckerRejectReason, number][])
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => (
                      <Badge key={k} variant="secondary" className="font-mono">
                        {k} {n}
                      </Badge>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nothing in {tab}.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full compact-table">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Matter ID</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Client</th>
                <th className="text-left px-3 py-2 font-medium">Maker</th>
                <th className="text-left px-3 py-2 font-medium">Created</th>
                <th className="text-left px-3 py-2 font-medium">Source mail</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {active.map((m) => {
                const c = clients.find((x) => x.id === m.clientId);
                const mk = users.find((u) => u.id === m.makerId);
                const pl = getCheckerPayload(m.id);
                const mail = pl ? mails.find((x) => x.id === pl.sourceMailId) : undefined;
                return (
                  <tr
                    key={m.id}
                    className="border-t border-border hover:bg-muted/40 cursor-pointer"
                    onClick={() => setOpenId(m.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{m.matterId}</td>
                    <td className="px-3 py-2">{m.title}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{mk?.fullName ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[240px]">
                      {mail ? (
                        <span title={mail.subject}>
                          <Mail className="inline h-3 w-3 mr-1" />
                          {mail.subject || "(no subject)"}
                        </span>
                      ) : (
                        <span className="italic">no linked mail</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      <ChevronRight className="inline h-4 w-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Drawer */}
      <Sheet open={!!openMatter} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-[720px] sm:max-w-[720px] p-0 flex flex-col">
          {openMatter && (
            <>
              <SheetHeader className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="text-base">
                      <span className="font-mono text-xs mr-2 text-muted-foreground">
                        {openMatter.matterId}
                      </span>
                      {openMatter.title}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-xs">
                      {client?.name} · Maker {maker?.fullName ?? "unknown"} ·{" "}
                      {formatDistanceToNow(new Date(openMatter.createdAt), { addSuffix: true })}
                    </SheetDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[11px]",
                      openMatter.pipelineState === "Pending" &&
                        "border-[hsl(var(--pending))]/40 text-[hsl(var(--pending))]",
                      openMatter.pipelineState === "Approved" &&
                        "border-[hsl(var(--success))]/40 text-[hsl(var(--success))]",
                      openMatter.pipelineState === "Rejected" &&
                        "border-[hsl(var(--danger))]/40 text-[hsl(var(--danger))]",
                    )}
                  >
                    {openMatter.pipelineState}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {/* Side-by-side diff */}
                {payload ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        AI confidence{" "}
                        <span className="font-mono text-foreground">
                          {Math.round(payload.aiConfidence * 100)}%
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-[160px_1fr_1fr] gap-0 text-xs border border-border rounded-md overflow-hidden">
                      <div className="bg-muted/60 px-3 py-2 font-medium">Field</div>
                      <div className="bg-muted/60 px-3 py-2 font-medium border-l border-border">
                        AI extracted
                      </div>
                      <div className="bg-muted/60 px-3 py-2 font-medium border-l border-border">
                        Maker submitted
                      </div>
                      {payload.fields.map((f) => (
                        <>
                          <div key={`${f.field}-l`} className="border-t border-border px-3 py-1.5 text-muted-foreground">
                            {f.field}
                          </div>
                          <div
                            key={`${f.field}-a`}
                            className={cn(
                              "border-t border-l border-border px-3 py-1.5",
                              f.changed && "bg-[hsl(var(--warning))]/10",
                            )}
                          >
                            {f.aiExtracted ?? <span className="italic text-muted-foreground">—</span>}
                          </div>
                          <div
                            key={`${f.field}-m`}
                            className={cn(
                              "border-t border-l border-border px-3 py-1.5",
                              f.changed && "bg-[hsl(var(--accent))]/10 font-medium",
                            )}
                          >
                            {f.makerSubmitted ?? <span className="italic text-muted-foreground">—</span>}
                          </div>
                        </>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <InlineErrorAlert
                      title="No diff payload"
                      message="Could not locate AI extraction payload for this matter."
                      errorSeed={`payload-${openMatter.id}`}
                    />
                  </div>
                )}

                {/* Source mail preview */}
                <div className="p-4">
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      Source mail
                      {sourceMail && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(sourceMail.receivedAt), { addSuffix: true })}
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                      {sourceMail ? (
                        <div className="space-y-1">
                          <div>
                            <span className="text-muted-foreground">From:</span> {sourceMail.from}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Subject:</span>{" "}
                            {sourceMail.subject || "(no subject)"}
                          </div>
                          <Separator className="my-2" />
                          <div
                            className="text-foreground"
                            dangerouslySetInnerHTML={{ __html: sourceMail.bodyHtml }}
                          />
                          {sourceMail.attachments.length > 0 && (
                            <div className="mt-2 text-muted-foreground">
                              {sourceMail.attachments.length} attachment(s):{" "}
                              {sourceMail.attachments.map((a) => a.name).join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-muted-foreground">Source mail not available.</span>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {openMatter.pipelineState === "Rejected" && overrides[openMatter.id]?.reason && (
                  <div className="mx-4 mb-4 rounded-md border border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/5 p-3 text-xs">
                    <div className="font-medium">
                      Rejected: {overrides[openMatter.id]?.reason}
                    </div>
                    {overrides[openMatter.id]?.reasonNote && (
                      <div className="text-muted-foreground mt-1">
                        {overrides[openMatter.id]?.reasonNote}
                      </div>
                    )}
                    {overrides[openMatter.id]?.duplicateOfMatterId && (
                      <div className="mt-1">
                        Surviving matter:{" "}
                        <span className="font-mono">
                          {overrides[openMatter.id]?.duplicateOfMatterId}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {openMatter.pipelineState === "Pending" && (
                <div className="border-t border-border p-3 flex items-center justify-between bg-background">
                  <div className="text-[11px] text-muted-foreground">
                    ↵ Approve · R Reject · Auto-advances to next Pending
                  </div>
                  <div className="flex items-center gap-2">
                    <RejectPicker
                      open={rejectPickerOpen}
                      onOpenChange={setRejectPickerOpen}
                      matters={mailMatters}
                      onReject={(reason, note, dupOf) => {
                        reject(openMatter.id, reason, note, dupOf);
                        setRejectPickerOpen(false);
                      }}
                    />
                    <Button size="sm" onClick={() => approve(openMatter.id)}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RejectPicker({
  open,
  onOpenChange,
  matters,
  onReject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matters: { id: string; matterId: number; title: string }[];
  onReject: (reason: CheckerRejectReason, note?: string, dupOf?: string) => void;
}) {
  const [reason, setReason] = useState<CheckerRejectReason>("Duplicate");
  const [note, setNote] = useState("");
  const [dupSearch, setDupSearch] = useState("");
  const [dupPickId, setDupPickId] = useState<string | null>(null);

  const dupOptions = matters
    .filter((m) =>
      dupSearch
        ? String(m.matterId).includes(dupSearch) || m.title.toLowerCase().includes(dupSearch.toLowerCase())
        : true,
    )
    .slice(0, 6);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => onOpenChange(true)}>
        <X className="h-4 w-4 mr-1" /> Reject
      </Button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px]">
          <SheetHeader>
            <SheetTitle>Reject with reason</SheetTitle>
            <SheetDescription>
              This returns the matter to the Maker with an Action-needed notification.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="text-xs text-muted-foreground">Reason</label>
              <Select value={reason} onValueChange={(v) => setReason(v as CheckerRejectReason)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reason === "Duplicate" && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Link surviving Matter ID
                </label>
                <Input
                  className="mt-1 h-9"
                  placeholder="Search matter ID or title…"
                  value={dupSearch}
                  onChange={(e) => setDupSearch(e.target.value)}
                />
                <div className="mt-2 space-y-1 max-h-[160px] overflow-y-auto">
                  {dupOptions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setDupPickId(m.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-xs border border-border",
                        dupPickId === m.id ? "bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/40" : "hover:bg-muted",
                      )}
                    >
                      <span className="font-mono mr-2">{m.matterId}</span>
                      {m.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {reason === "Other" && (
              <div>
                <label className="text-xs text-muted-foreground">Note (required)</label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Explain why this cannot be approved…"
                />
              </div>
            )}
            {reason !== "Other" && (
              <div>
                <label className="text-xs text-muted-foreground">Note (optional)</label>
                <Textarea
                  className="mt-1 min-h-[60px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={reason === "Other" && !note.trim()}
                onClick={() =>
                  onReject(
                    reason,
                    note.trim() || undefined,
                    reason === "Duplicate" ? dupPickId ?? undefined : undefined,
                  )
                }
              >
                Reject &amp; return to Maker
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}