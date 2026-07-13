import { useMemo, useState } from "react";
import { Gavel, CheckSquare, Pencil, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, cx } from "@/lib/format";
import type { Matter, Hearing, Task, RTB, TimeEntry, MailItem } from "@/types";
import type { MatterDoc } from "./DocumentsTab";
import type { HistoryItem } from "./HistoryTab";

type Filter = "all" | "mail" | "document" | "time" | "hearing" | "status";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mail", label: "Mails" },
  { key: "document", label: "Documents" },
  { key: "time", label: "Time" },
  { key: "hearing", label: "Hearings" },
  { key: "status", label: "Status" },
];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function OverviewTab({
  matter, hearings, tasks, rtbs, timeEntries, mails, docs, history,
  onCompleteTask, onUpdateField, onClearPartial, onOpenBilling,
}: {
  matter: Matter;
  hearings: Hearing[];
  tasks: Task[];
  rtbs: RTB[];
  timeEntries: TimeEntry[];
  mails: MailItem[];
  docs: MatterDoc[];
  history: HistoryItem[];
  onCompleteTask: (id: string) => void;
  onUpdateField: (patch: Partial<Matter>) => void;
  onClearPartial: () => void;
  onOpenBilling: (filter: "billed" | "collected" | "due" | "overdue") => void;
}) {
  const now = Date.now();
  const nextHearing = useMemo(() => [...hearings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).find((h) => new Date(h.date).getTime() >= now - 864e5), [hearings, now]);
  const nearestTasks = useMemo(() => tasks.filter((t) => t.status === "Open").sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 3), [tasks]);

  const billed = rtbs.reduce((s, r) => s + r.billingAmount, 0);
  const collected = rtbs.reduce((s, r) => s + (r.billingAmount - r.outstandingAmount), 0);
  const due = rtbs.reduce((s, r) => s + r.outstandingAmount, 0);
  const overdue = rtbs.filter((r) => r.status === "Invoiced" && r.outstandingAmount > 0).reduce((s, r) => s + r.outstandingAmount, 0);

  const [filter, setFilter] = useState<Filter>("all");

  const activity = useMemo(() => {
    type A = { at: string; kind: Filter; text: string; source?: string; confidence?: number };
    const items: A[] = [];
    for (const m of mails) items.push({ at: m.receivedAt, kind: "mail", text: `Mail filed: ${m.subject || "(no subject)"}`, source: m.aiSuggestedTag ? "AI" : "Mail rule", confidence: m.aiConfidence });
    for (const d of docs) for (const v of d.versions) items.push({ at: v.uploadedAt, kind: "document", text: `${d.title} — ${v.label}${v.isFinal ? " (Final)" : ""}` });
    const byDay = new Map<string, number>();
    for (const t of timeEntries) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.hours * 60 + t.minutes);
    for (const [d, mins] of byDay) items.push({ at: `${d}T18:00:00.000Z`, kind: "time", text: `Time logged: ${Math.floor(mins / 60)}h ${mins % 60}m` });
    for (const h of hearings) if (h.result) items.push({ at: h.date, kind: "hearing", text: `Hearing at ${h.forum}: ${h.result}`, source: h.source });
    for (const hi of history) items.push({ at: hi.at, kind: "status", text: hi.what, source: hi.source });
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 40);
  }, [mails, docs, timeEntries, hearings, history]);

  const filteredActivity = filter === "all" ? activity : activity.filter((a) => a.kind === filter);

  const isPartial = matter.tags.includes("partial-details");
  const missing = useMemo(() => {
    const list: { key: keyof Matter; label: string }[] = [];
    if (!matter.docRefNumber) list.push({ key: "docRefNumber", label: "Doc Ref Number" });
    if (!matter.referenceDate) list.push({ key: "referenceDate", label: "Reference Date" });
    if (!matter.feeQuote) list.push({ key: "feeQuote", label: "Fee Quote" });
    if (!matter.caseManagerId) list.push({ key: "caseManagerId", label: "Case Manager" });
    return list;
  }, [matter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        {isPartial && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-4">
            <div className="text-[13px] font-medium text-warning">Complete matter details</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Fill the missing fields below to clear the partial-details tag.</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {missing.length === 0 && <div className="text-[12px] text-muted-foreground italic col-span-2">All required fields are filled.</div>}
              {missing.map((f) => (
                <InlineFill key={String(f.key)} label={f.label} onSave={(v) => onUpdateField({ [f.key]: v } as Partial<Matter>)} />
              ))}
            </div>
            {missing.length === 0 && (
              <div className="mt-3">
                <Button size="sm" className="h-7" onClick={onClearPartial}>Clear partial-details tag</Button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Next up</div>
          <div className="mt-2">
            {nextHearing ? (
              <div className="flex items-center gap-2 text-[13px]">
                <Gavel className="h-4 w-4 text-accent" />
                <span className="font-mono tabular-nums">{fmtDate(nextHearing.date)}</span>
                <span className="text-muted-foreground">·</span>
                <span>{nextHearing.forum}</span>
                {nextHearing.causeListItemNo && <Badge variant="outline" className="text-[10px] font-normal">Item {nextHearing.causeListItemNo}</Badge>}
                <Badge variant="outline" className={cx("text-[10px] font-normal", nextHearing.readiness === "Ready" ? "text-success border-success/40" : "text-warning border-warning/40")}>{nextHearing.readiness}</Badge>
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground italic">No hearing scheduled.</div>
            )}
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Nearest open tasks</div>
            {nearestTasks.length === 0 && <div className="text-[12px] text-muted-foreground italic">Nothing due.</div>}
            {nearestTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-[13px] py-1">
                <button onClick={() => onCompleteTask(t.id)} className="h-4 w-4 rounded border grid place-items-center hover:bg-muted" aria-label="Complete task">
                  <CheckSquare className="h-3 w-3 opacity-40" />
                </button>
                <span className="flex-1 truncate">{t.subject}</span>
                <span className="font-mono tabular-nums text-[11px] text-muted-foreground">{fmtDate(t.dueDate)}</span>
                <Badge variant="outline" className={cx("text-[10px] font-normal", t.priority === "High" ? "text-danger border-danger/40" : "")}>{t.priority}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Activity</div>
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={cx("h-6 px-2 rounded-full text-[11px] border", filter === f.key ? "bg-accent/15 border-accent/40 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {filteredActivity.length === 0 && <div className="text-[12px] text-muted-foreground italic py-3 text-center">No activity yet in this window.</div>}
            {filteredActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-[13px] py-1.5 border-b last:border-0">
                <span className={cx("h-1.5 w-1.5 rounded-full mt-2", a.kind === "mail" ? "bg-accent" : a.kind === "document" ? "bg-pending" : a.kind === "time" ? "bg-success" : a.kind === "hearing" ? "bg-warning" : "bg-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{a.text}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="font-mono tabular-nums">{fmtDate(a.at)}</span>
                    {a.source && <Badge variant="outline" className="text-[10px] font-normal h-4">{a.source}</Badge>}
                    {typeof a.confidence === "number" && <span>{Math.round(a.confidence * 100)}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Matter brief</div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-[13px]">
            <FieldRow label="Matter Type" value={matter.matterType} onSave={(v) => onUpdateField({ matterType: v as Matter["matterType"] })} options={["Litigation", "Consulting"]} />
            <FieldRow label="Sub Type" value={matter.subType} onSave={(v) => onUpdateField({ subType: v as Matter["subType"] })} options={["Hearing", "Opinion", "Projects", "Projects (Retainership)"]} />
            <FieldRow label="Category" value={matter.category} onSave={(v) => onUpdateField({ category: v as Matter["category"] })} options={["Tax - Indirect", "Tax - Direct", "International Trade", "Corporate"]} />
            <FieldRow label="Sub Category" value={matter.subCategory} onSave={(v) => onUpdateField({ subCategory: v as Matter["subCategory"] })} options={["Customs", "GST", "Mixed - Corporate", "Arbitration and Conciliation", "Competition Law/MRTP"]} />
            <FieldRow label="Deliverable" value={matter.deliverable} onSave={(v) => onUpdateField({ deliverable: v as Matter["deliverable"] })} options={["Retainership", "Legal Opinion", "Appearance", "Civil Appeal", "Reply to SCN"]} />
            <FieldRow label="Issue in Brief" value={matter.issueInBrief} onSave={(v) => onUpdateField({ issueInBrief: v })} multiline />
            <FieldRow label="Doc Ref Number" value={matter.docRefNumber ?? ""} mono onSave={(v) => onUpdateField({ docRefNumber: v })} />
            <FieldRow label="Reference Date" value={matter.referenceDate ? fmtDate(matter.referenceDate) : ""} mono onSave={(v) => onUpdateField({ referenceDate: v })} />
            <FieldRow label="Engagement" value={matter.engagement} onSave={(v) => onUpdateField({ engagement: v as Matter["engagement"] })} options={["T&M", "Fixed Fee", "Per Appearance"]} />
            {matter.deliverable === "Retainership" && (
              <>
                <FieldRow label="Billing Cycle" value={matter.billingCycle ?? ""} onSave={(v) => onUpdateField({ billingCycle: v as Matter["billingCycle"] })} options={["Monthly", "Quarterly"]} />
                <FieldRow label="Contract Start" value={matter.contractStart ? fmtDate(matter.contractStart) : ""} mono onSave={(v) => onUpdateField({ contractStart: v })} />
                <FieldRow label="Contract End" value={matter.contractEnd ? fmtDate(matter.contractEnd) : ""} mono onSave={(v) => onUpdateField({ contractEnd: v })} />
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Billing details</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
            <FigureCell label="Fee Quote" value={matter.feeQuote ? formatINR(matter.feeQuote) : "—"} />
            <FigureCell label="Billing Amount" value={formatINR(billed)} />
            <FigureCell label="Matter Outstanding" value={formatINR(due)} tone={due > 0 ? "warning" : undefined} />
            <FigureCell label="Client Outstanding" value={formatINR(Math.round(due * 1.4))} tone={due > 0 ? "warning" : undefined} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <MoneyStrip label="Billed" value={billed} onClick={() => onOpenBilling("billed")} />
            <MoneyStrip label="Collected" value={collected} onClick={() => onOpenBilling("collected")} tone="success" />
            <MoneyStrip label="Due" value={due} onClick={() => onOpenBilling("due")} tone={due > 0 ? "warning" : undefined} />
            <MoneyStrip label="Overdue" value={overdue} onClick={() => onOpenBilling("overdue")} tone={overdue > 0 ? "danger" : undefined} />
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground italic">Based on 82% timesheet coverage. <button className="underline hover:text-foreground">Chase gaps</button></div>
        </div>
      </div>
    </div>
  );
}

function InlineFill({ label, onSave }: { label: string; onSave: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground w-32 shrink-0">{label}</label>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={`Enter ${label}`} className="h-8 text-[12px]" />
      <Button size="sm" variant="outline" className="h-8 px-2" disabled={!v.trim()} onClick={() => onSave(v.trim())}>Save</Button>
    </div>
  );
}

function FieldRow({ label, value, onSave, options, multiline, mono }: {
  label: string; value: string; onSave: (v: string) => void; options?: readonly string[]; multiline?: boolean; mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [savedFlash, setSavedFlash] = useState(false);
  const commit = () => {
    if (draft !== value) { onSave(draft); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); }
    setEditing(false);
  };
  return (
    <div className="group grid grid-cols-[130px_1fr_auto] items-start gap-2 py-1 border-b last:border-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground pt-1">{label}</div>
      <div className={cx("min-w-0", mono && "font-mono tabular-nums text-[12px]")}>
        {editing ? (
          options ? (
            <Select value={draft || value} onValueChange={(v) => { setDraft(v); onSave(v); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); setEditing(false); }}>
              <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder={value} /></SelectTrigger>
              <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          ) : multiline ? (
            <Textarea rows={3} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
          ) : (
            <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} className="h-8 text-[12px]" />
          )
        ) : (
          <div className="truncate">{value || <span className="text-muted-foreground italic">Not set</span>}</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {savedFlash && <span className="text-[10px] text-success inline-flex items-center gap-1"><Save className="h-3 w-3" />Saved</span>}
        {!editing && (
          <button className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded hover:bg-muted" onClick={() => { setDraft(value); setEditing(true); }} aria-label={`Edit ${label}`}>
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

function FigureCell({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cx("font-mono tabular-nums", tone === "warning" && "text-warning")}>{value}</div>
    </div>
  );
}

function MoneyStrip({ label, value, onClick, tone }: { label: string; value: number; onClick: () => void; tone?: "success" | "warning" | "danger" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "";
  return (
    <button onClick={onClick} className="rounded-md border p-2 text-left hover:bg-muted/50 transition-colors">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cx("font-mono tabular-nums text-[13px]", toneCls)}>{formatINR(value)}</div>
    </button>
  );
}