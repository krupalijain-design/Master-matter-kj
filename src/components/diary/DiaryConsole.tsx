import { useMemo, useState } from "react";
import { useHearings, useMatters, useUsers } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Gavel, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import type { Hearing } from "@/types";

const RESULTS: NonNullable<Hearing["result"]>[] = ["Appeal Allowed", "Part Heard", "Stay Granted", "Stay Rejected", "Notice on Stay", "Leave Granted", "No Direction", "Order Reserved"];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function DiaryConsole() {
  const { currentUserId } = useAppStore();
  const { data: users } = useUsers();
  const me = users.find((u) => u.id === currentUserId)!;
  const { data: hearings } = useHearings();
  const { data: matters } = useMatters();
  const appendAudit = useAppStore((s) => s.appendAudit);

  const branchHearings = useMemo(() => {
    const in7 = Date.now() + 7 * 86400000;
    return hearings
      .filter((h) => new Date(h.date).getTime() <= in7 && new Date(h.date).getTime() >= Date.now() - 86400000)
      .filter((h) => {
        const m = matters.find((mm) => mm.id === h.matterId);
        return m ? m.branch === me.branch : true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [hearings, matters, me.branch]);

  const [queue, setQueue] = useState<string[]>(() => branchHearings.map((h) => h.id));
  const [idx, setIdx] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const activeId = queue[idx];
  const active = branchHearings.find((h) => h.id === activeId);
  const matter = active ? matters.find((m) => m.id === active.matterId) : undefined;

  // Group upcoming by forum for the sidebar.
  const grouped = useMemo(() => {
    const g: Record<string, typeof branchHearings> = {};
    branchHearings.forEach((h) => {
      const key = h.forum + (h.bench ? " · " + h.bench : "");
      (g[key] ??= []).push(h);
    });
    return g;
  }, [branchHearings]);

  const [result, setResult] = useState<NonNullable<Hearing["result"]>>("Part Heard");
  const [nextDate, setNextDate] = useState("");
  const [description, setDescription] = useState("");
  const [appearedBy, setAppearedBy] = useState<string>("");

  const reset = () => {
    setResult("Part Heard");
    setNextDate("");
    setDescription("");
    setAppearedBy("");
  };

  const saveAndNext = () => {
    if (!active) return;
    setSavedIds((s) => new Set(s).add(active.id));
    appendAudit({
      actor: currentUserId,
      actorName: me.fullName,
      activeRole: "Court Staff",
      action: "hearing.recorded",
      resource: "hearings",
      matterId: active.matterId,
    });
    toast.success(`Saved ${active.forum} · Item ${active.causeListItemNo ?? "—"}`, {
      description: "Case team notified via bell + email.",
    });
    reset();
    if (idx < queue.length - 1) setIdx(idx + 1);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-[320px_1fr] bg-background">
      {/* Left: today + next 7d grouped */}
      <aside className="border-r bg-muted/20 overflow-y-auto">
        <div className="p-4 border-b">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Diary console</div>
          <div className="text-base font-semibold">{me.branch} clerk</div>
          <div className="text-[11px] text-muted-foreground mt-1">Today + next 7 days · {branchHearings.length} hearings</div>
        </div>
        {Object.entries(grouped).map(([forum, items]) => (
          <div key={forum} className="border-b">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/30">{forum}</div>
            <ul>
              {items.map((h) => {
                const active = h.id === activeId;
                const saved = savedIds.has(h.id);
                const m = matters.find((mm) => mm.id === h.matterId);
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => setIdx(queue.indexOf(h.id))}
                      className={
                        "w-full text-left px-3 py-2.5 border-b flex items-start gap-2 text-[13px] " +
                        (active ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-muted/40")
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-[11px] text-muted-foreground">{fmtDate(h.date)}</span>
                          {h.causeListItemNo && <Chip tone="neutral">#{h.causeListItemNo}</Chip>}
                          {saved && <Check className="h-3 w-3 text-success" />}
                        </div>
                        <div className="truncate text-[12px] mt-0.5">{m?.title ?? "—"}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      {/* Right: batch entry form */}
      <main className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          <Gavel className="h-3.5 w-3.5" /> Post-hearing entry
          <span className="ml-auto tabular-nums">{Math.min(idx + 1, queue.length)} / {queue.length}</span>
        </div>

        {!active ? (
          <Card className="p-8 text-center text-muted-foreground text-[13px]">No hearings in queue for {me.branch}.</Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Matter</div>
              <div className="mt-0.5 flex items-center gap-3">
                <span className="font-mono text-[13px]">{matter?.matterId}</span>
                <span className="text-[14px] font-medium">{matter?.title}</span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-1">
                {active.forum}{active.bench ? " · " + active.bench : ""} · Item {active.causeListItemNo ?? "—"} · {fmtDate(active.date)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Result">
                <Select value={result} onValueChange={(v) => setResult(v as NonNullable<Hearing["result"]>)}>
                  <SelectTrigger className="h-11 text-[14px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Next hearing date">
                <Input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  disabled={result === "Order Reserved"}
                  className="h-11 text-[14px] font-mono"
                />
              </Field>
              <Field label="Appeared by">
                <Select value={appearedBy || "none"} onValueChange={(v) => setAppearedBy(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-11 text-[14px]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not noted —</SelectItem>
                    {users.filter((u) => u.roles.some((r) => r === "Case Partner" || r === "Associate" || r === "Case Manager")).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div />
            </div>

            <Field label="Description / notes">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-[14px]" placeholder="Brief clerk note (visible to case team)." />
            </Field>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-[11px] text-muted-foreground">
                Source: <span className="font-medium text-foreground">Manual (clerk)</span> · fires notification to Case Team.
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="lg" className="h-11" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Back</Button>
                <Button size="lg" className="h-11 gap-1.5" onClick={saveAndNext}>
                  Save and next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}