import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Paperclip, Scissors, Check, X, ArrowRight, Plus, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useMails, useMatters, useClients } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { decideAll } from "@/lib/autodocket";
import { formatDistanceToNow } from "date-fns";

export function MakerQueue() {
  const { data: mails } = useMails();
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const cfg = useAppStore((s) => s.autodocketConfig);
  const autoFileOverrides = useAppStore((s) => s.autoFileOverrides);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const appendAudit = useAppStore((s) => s.appendAudit);

  const decisions = useMemo(() => decideAll(mails, cfg), [mails, cfg]);
  const makerMails = useMemo(() => {
    return decisions
      .filter((d) => d.route === "maker" && autoFileOverrides[d.mailId] === undefined)
      .map((d) => ({ decision: d, mail: mails.find((m) => m.id === d.mailId)! }))
      .filter((x) => x.mail);
  }, [decisions, mails, autoFileOverrides]);

  const [selectedId, setSelectedId] = useState<string | null>(makerMails[0]?.mail.id ?? null);
  const currentSel = makerMails.find((x) => x.mail.id === selectedId) ?? makerMails[0] ?? null;

  const handleDiscard = (mailId: string) => {
    appendAudit({ actor: currentUserId, actorName: "Maker", activeRole: "Maker", action: "maker.discard", resource: "mail" });
    toast.success("Discarded", { duration: 6000, action: { label: "Undo", onClick: () => {} } });
  };

  const handleAttach = (mailId: string, matterId: string) => {
    const m = matters.find((x) => x.id === matterId);
    appendAudit({ actor: currentUserId, actorName: "Maker", activeRole: "Maker", action: "maker.attach", resource: "mail", matterId });
    toast.success(`Attached to matter ${m?.matterId ?? matterId}`, { description: "Source: Maker (from AI shortlist)" });
  };

  const handleCreateAssignment = (mailId: string, matterId: string) => {
    const m = matters.find((x) => x.id === matterId);
    appendAudit({ actor: currentUserId, actorName: "Maker", activeRole: "Maker", action: "maker.create-assignment", resource: "mail", matterId });
    toast.success(`New task created on matter ${m?.matterId}`, { description: "Mail linked as work instruction." });
  };

  if (makerMails.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nothing in the Maker queue.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[380px_1fr] h-[calc(100vh-7.5rem)]">
      {/* LIST */}
      <aside className="border-r border-border overflow-y-auto">
        {makerMails.map(({ mail, decision }) => (
          <button
            key={mail.id}
            onClick={() => setSelectedId(mail.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/40",
              currentSel?.mail.id === mail.id && "bg-accent/10",
            )}
          >
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono tabular-nums">
              <span>{decision.acsNo}</span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true })}</span>
            </div>
            <div className="text-[13px] font-medium truncate mt-0.5">{mail.subject || "(no subject)"}</div>
            <div className="text-[12px] text-muted-foreground truncate">{mail.from}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-normal">
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                {decision.suggestedTag} · {Math.round(decision.confidence * 100)}%
              </Badge>
              {mail.attachments.length > 0 && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  <Paperclip className="h-2.5 w-2.5 mr-1" />
                  {mail.attachments.length}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </aside>

      {/* REVIEW */}
      {currentSel && (
        <section className="overflow-y-auto p-5 space-y-4">
          <div>
            <div className="text-[11px] font-mono text-muted-foreground">{currentSel.decision.acsNo}</div>
            <h2 className="text-base font-medium leading-snug mt-1">{currentSel.mail.subject || "(no subject)"}</h2>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              <span className="text-foreground">{currentSel.mail.from}</span> → {currentSel.mail.to.join(", ")}
            </div>
          </div>

          {/* Attachments strip with Mark parts */}
          {currentSel.mail.attachments.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Attachments</div>
              <div className="space-y-1.5">
                {currentSel.mail.attachments.map((a) => (
                  <AttachmentRow key={a.name} mailId={currentSel.mail.id} name={a.name} summary={a.aiSummary} />
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed rounded-md border border-border p-3 bg-muted/20"
            dangerouslySetInnerHTML={{ __html: currentSel.mail.bodyHtml }}
          />

          {/* Decision actions */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Decision</div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/matter/new"
                search={{ fromMail: currentSel.mail.id } as never}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-[hsl(var(--accent))]/5 text-[13px] font-medium hover:bg-[hsl(var(--accent))]/10"
              >
                <Plus className="h-3.5 w-3.5" /> Create new case (AI-prefilled)
              </Link>
              <Button variant="outline" className="h-9" onClick={() => handleDiscard(currentSel.mail.id)}>
                <X className="h-3.5 w-3.5 mr-1" /> Discard
              </Button>
            </div>

            {/* Candidate cards */}
            {currentSel.mail.matchCandidates.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">Attach to existing matter or assignment</div>
                {currentSel.mail.matchCandidates.map((cand) => {
                  const m = matters.find((x) => x.id === cand.matterId);
                  const c = m ? clients.find((cl) => cl.id === m.clientId) : undefined;
                  if (!m) return null;
                  return (
                    <div key={cand.matterId} className="rounded-md border border-border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            <span className="font-mono text-[11px] text-muted-foreground mr-2">{m.matterId}</span>
                            {m.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{c?.name}</div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          {Math.round(cand.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px]">
                        {cand.refNoHit && <Badge variant="secondary" className="font-mono">Ref: {cand.refNoHit} ✓</Badge>}
                        {cand.entityHit && <Badge variant="secondary">Entity: {cand.entityHit} ✓</Badge>}
                        <Badge variant="secondary">
                          Deliverable {cand.deliverableMatch ? "✓" : "✗"}
                        </Badge>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => handleAttach(currentSel.mail.id, cand.matterId)}>
                          <ArrowRight className="h-3 w-3 mr-1" /> Attach to matter
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleCreateAssignment(currentSel.mail.id, cand.matterId)}>
                          <Plus className="h-3 w-3 mr-1" /> Create assignment
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function AttachmentRow({ mailId, name, summary }: { mailId: string; name: string; summary?: string }) {
  const addMarkedParts = useAppStore((s) => s.addMarkedParts);
  const markedParts = useAppStore((s) => s.markedParts[mailId]?.find((x) => x.attachmentName === name)?.parts);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ label: string; pageRange: string }[]>([
    { label: "", pageRange: "" },
    { label: "", pageRange: "" },
  ]);

  const save = () => {
    const clean = rows.filter((r) => r.label.trim() && r.pageRange.trim());
    if (clean.length < 2) {
      toast.error("Mark at least two parts");
      return;
    }
    addMarkedParts(mailId, name, clean);
    setOpen(false);
    toast.success(`Marked ${clean.length} parts`, {
      description: `${clean.length} typed Documents will be created when the mail files.`,
    });
  };

  return (
    <div className="rounded-md border border-border/60 px-2.5 py-2 text-[12px]">
      <div className="flex items-center gap-2">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{name}</div>
          {summary && <div className="text-[11px] text-muted-foreground truncate">{summary}</div>}
        </div>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setOpen((v) => !v)}>
          <Scissors className="h-3 w-3 mr-1" />
          {markedParts ? `${markedParts.length} parts` : "Mark parts"}
        </Button>
      </div>
      {open && (
        <div className="mt-2 space-y-1.5 pt-2 border-t border-border/60">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[100px_1fr_auto] gap-1.5 items-center">
              <Input placeholder="pp 1-4" value={r.pageRange} onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, pageRange: e.target.value } : x)))} className="h-7 text-[11px] font-mono" />
              <Input placeholder="Label (e.g. OIO 205/2026)" value={r.label} onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-7 text-[11px]" />
              {i === rows.length - 1 && (
                <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setRows((s) => [...s, { label: "", pageRange: "" }])}>
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-[11px]" onClick={save}>
              <Check className="h-3 w-3 mr-1" /> Save parts
            </Button>
          </div>
        </div>
      )}
      {markedParts && !open && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {markedParts.map((p, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] font-mono">{p.pageRange}: {p.label}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}