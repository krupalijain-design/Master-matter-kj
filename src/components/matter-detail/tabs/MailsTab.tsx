import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Paperclip, FilePlus2, ArrowUpRight, Sparkles, Flag } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/app-store";
import { decide } from "@/lib/autodocket";
import { cx, timeAgo } from "@/lib/format";
import type { MailItem, MailAttachment } from "@/types";

export function MailsTab({ matterId, mails, onFileAttachment }: {
  matterId: string;
  mails: MailItem[];
  onFileAttachment: (mail: MailItem, att: MailAttachment) => void;
}) {
  const cfg = useAppStore((s) => s.autodocketConfig);
  const addMisfileReport = useAppStore((s) => s.addMisfileReport);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [reportMailId, setReportMailId] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState("");
  const ordered = useMemo(() => [...mails].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()), [mails]);
  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.id ?? null);
  const selected = ordered.find((m) => m.id === selectedId) ?? ordered[0];

  const submitReport = (mail: MailItem) => {
    addMisfileReport({
      mailId: mail.id,
      matterId,
      reporterId: currentUserId,
      reporterName: "Matter team",
      note: reportNote,
      at: new Date().toISOString(),
    });
    toast.success("Mis-file reported", { description: "Routed to Checker audit queue." });
    setReportMailId(null);
    setReportNote("");
  };

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border shadow-sm p-10 text-center">
        <div className="text-[13px] font-medium">No mails filed against this matter yet</div>
        <div className="text-[11px] text-muted-foreground mt-1">Docketing files matched mails here automatically.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4 h-[calc(100vh-320px)] min-h-[520px]">
      <div className="rounded-lg border shadow-sm overflow-y-auto">
        {ordered.map((m) => (
          <button key={m.id} onClick={() => setSelectedId(m.id)} className={cx("w-full text-left px-3 py-2.5 border-b hover:bg-muted/40", selected?.id === m.id && "bg-accent/10")}>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="truncate flex-1 font-medium">{m.from}</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(m.receivedAt)}</span>
            </div>
            <div className="text-[13px] truncate mt-0.5">{m.subject || <span className="italic text-muted-foreground">(no subject)</span>}</div>
            <div className="text-[11px] text-muted-foreground truncate">{m.bodyPreview}</div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {m.attachments.slice(0, 2).map((a) => <Badge key={a.name} variant="outline" className="text-[10px] font-normal gap-1 h-4"><Paperclip className="h-2.5 w-2.5" />{a.name.slice(0, 18)}</Badge>)}
              {m.attachments.length > 2 && <span className="text-[10px] text-muted-foreground">+{m.attachments.length - 2}</span>}
              {m.aiSuggestedTag && <Badge variant="outline" className="text-[10px] font-normal">AI · {Math.round((m.aiConfidence ?? 0) * 100)}%</Badge>}
            </div>
          </button>
        ))}
      </div>
      <div className="rounded-lg border shadow-sm p-5 overflow-y-auto">
        {selected && (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-[16px] font-medium leading-snug">{selected.subject || "(no subject)"}</h2>
                {selected.acsNo && (
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{selected.acsNo}</div>
                )}
                <div className="mt-1 text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">{selected.from}</span> → {selected.to.join(", ")}{selected.cc.length > 0 && <> · cc {selected.cc.join(", ")}</>}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5">{new Date(selected.receivedAt).toLocaleString("en-IN")}</div>
                {(() => {
                  const d = decide(selected, cfg);
                  if (d.route !== "auto-file") return null;
                  return (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        <Sparkles className="h-2.5 w-2.5 mr-1" />
                        Auto · {Math.round(d.confidence * 100)}%
                      </Badge>
                      <Popover open={reportMailId === selected.id} onOpenChange={(o) => setReportMailId(o ? selected.id : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
                            <Flag className="h-3 w-3 mr-1" /> Report mis-file
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 p-3 space-y-2">
                          <div className="text-[12px] font-medium">Report mis-file</div>
                          <Textarea
                            placeholder="What's wrong with this filing?"
                            value={reportNote}
                            onChange={(e) => setReportNote(e.target.value)}
                            className="text-[12px] min-h-[80px]"
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setReportMailId(null)}>Cancel</Button>
                            <Button size="sm" className="h-7 text-[11px]" onClick={() => submitReport(selected)}>Submit</Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })()}
              </div>
              <Link
                to="/matter/new"
                search={{ fromMail: selected.id } as any}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border text-[12px] hover:bg-muted"
              >
                <FilePlus2 className="h-3.5 w-3.5" /> New Matter from this mail
              </Link>
            </div>
            <div className="prose prose-sm max-w-none mt-4 text-[13px] leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.bodyHtml }} />
            {selected.attachments.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Attachments</div>
                <div className="space-y-1.5">
                  {selected.attachments.map((a) => (
                    <div key={a.name} className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{a.name}</div>
                        {a.aiSummary && <div className="text-[11px] text-muted-foreground truncate">{a.aiSummary}</div>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => onFileAttachment(selected, a)}>
                        <ArrowUpRight className="h-3 w-3" /> File → Documents
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}