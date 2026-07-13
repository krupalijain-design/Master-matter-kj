import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMails, useMatters, useClients } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { decideAll, isSampled } from "@/lib/autodocket";
import { formatDistanceToNow } from "date-fns";

export function AuditSampleQueue() {
  const { data: mails } = useMails();
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const cfg = useAppStore((s) => s.autodocketConfig);
  const verdicts = useAppStore((s) => s.auditVerdicts);
  const setVerdict = useAppStore((s) => s.setAuditVerdict);
  const revokeAutoFile = useAppStore((s) => s.revokeAutoFile);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [wrongForId, setWrongForId] = useState<string | null>(null);
  const [wrongReason, setWrongReason] = useState("");

  const rows = useMemo(() => {
    return decideAll(mails, cfg)
      .filter((d) => d.route === "auto-file" && isSampled(d.mailId, cfg.samplePct))
      .map((d) => {
        const mail = mails.find((m) => m.id === d.mailId)!;
        const matter = d.targetMatterId ? matters.find((m) => m.id === d.targetMatterId) : undefined;
        const client = matter ? clients.find((c) => c.id === matter.clientId) : undefined;
        return { d, mail, matter, client, verdict: verdicts[d.mailId] };
      });
  }, [mails, cfg, matters, clients, verdicts]);

  const markCorrect = (mailId: string) => {
    setVerdict({ mailId, verdict: "correct", at: new Date().toISOString(), actorId: currentUserId });
    appendAudit({ actor: currentUserId, actorName: "Checker", activeRole: "Checker", action: "audit.correct", resource: "mail" });
    toast.success("Marked correct");
  };
  const markWrong = (mailId: string) => {
    if (!wrongReason.trim()) {
      toast.error("Add a reason");
      return;
    }
    setVerdict({ mailId, verdict: "wrong", reason: wrongReason, at: new Date().toISOString(), actorId: currentUserId });
    revokeAutoFile(mailId);
    appendAudit({ actor: currentUserId, actorName: "Checker", activeRole: "Checker", action: "audit.wrong", resource: "mail" });
    toast.success("Rerouted to Maker queue", {
      description: "Effective confidence display lowered; flagged to /admin/rules.",
    });
    setWrongForId(null);
    setWrongReason("");
  };

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
        No auto-filed items sampled for audit.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      <div className="text-sm text-muted-foreground">
        Spot-verify a random {cfg.samplePct}% of straight-through auto-filed mails. Wrong verdicts reroute the mail and lower the effective confidence display.
      </div>
      <div className="space-y-2">
        {rows.map(({ d, mail, matter, client, verdict }) => (
          <div key={d.mailId} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-mono text-muted-foreground">{d.acsNo}</div>
                <div className="text-[13px] font-medium mt-0.5">{mail.subject || "(no subject)"}</div>
                <div className="text-[12px] text-muted-foreground truncate">{mail.from} · {formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true })}</div>
                {matter && (
                  <div className="text-[12px] mt-1">
                    Filed to{" "}
                    <Link to="/matter/$id" params={{ id: matter.id }} className="hover:underline">
                      <span className="font-mono text-[11px] text-muted-foreground mr-1">{matter.matterId}</span>
                      {matter.title}
                    </Link>
                    <span className="text-muted-foreground"> · {client?.name}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant="outline" className="font-mono text-[10px]">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  {Math.round(d.confidence * 100)}%
                </Badge>
                {verdict ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px]",
                      verdict.verdict === "wrong"
                        ? "border-[hsl(var(--danger))]/40 text-[hsl(var(--danger))]"
                        : "border-[hsl(var(--success))]/40 text-[hsl(var(--success))]",
                    )}
                  >
                    {verdict.verdict}
                  </Badge>
                ) : (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => markCorrect(d.mailId)}>
                      <Check className="h-3 w-3 mr-1" /> Correct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-[hsl(var(--danger))]/40 text-[hsl(var(--danger))]"
                      onClick={() => {
                        setWrongForId(d.mailId);
                        setWrongReason("");
                      }}
                    >
                      <X className="h-3 w-3 mr-1" /> Wrong
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {wrongForId === d.mailId && (
              <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                <Textarea
                  placeholder="Reason for reroute (visible to Maker + /admin/rules)…"
                  value={wrongReason}
                  onChange={(e) => setWrongReason(e.target.value)}
                  className="text-[12px] min-h-[64px]"
                />
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setWrongForId(null)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-[11px]" onClick={() => markWrong(d.mailId)}>
                    Confirm reroute
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}