import { useEffect, useState } from "react";
import { Gavel, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cx } from "@/lib/format";
import type { Hearing, User, Task } from "@/types";
import { Chip } from "@/components/ui/chip";

const RESULTS: NonNullable<Hearing["result"]>[] = ["Appeal Allowed", "Part Heard", "Stay Granted", "Stay Rejected", "Notice on Stay", "Leave Granted", "No Direction", "Order Reserved"];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function HearingsTab({ matterId, hearings, users, onRecord }: {
  matterId: string; hearings: Hearing[]; users: User[];
  onRecord: (h: Hearing, prepTask?: Task) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Hearing | null>(null);

  const sorted = [...hearings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] text-muted-foreground">{hearings.length} hearing{hearings.length === 1 ? "" : "s"} on file</div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Record hearing
        </Button>
      </div>

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full editorial-table">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Forum</th>
              <th className="text-left px-3 py-2">Bench</th>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">Appeared By</th>
              <th className="text-left px-3 py-2">Result</th>
              <th className="text-left px-3 py-2">Next date</th>
              <th className="text-left px-3 py-2">Readiness</th>
              <th className="text-left px-3 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-[13px]">
                <div className="font-medium">No hearings recorded</div>
                <div className="text-[11px] text-muted-foreground mt-1">Record the first hearing to start the timeline.</div>
              </td></tr>
            )}
            {sorted.map((h) => {
              const appearer = h.appearedById ? users.find((u) => u.id === h.appearedById) : null;
              return (
                <tr key={h.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono tabular-nums text-[12px]">{fmtDate(h.date)}</td>
                  <td className="px-3 py-2.5">{h.forum}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[12px]">{h.bench ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-[12px]">{h.causeListItemNo ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px]">{appearer?.fullName ?? "—"}</td>
                  <td className="px-3 py-2.5">{h.result ? <Chip tone={h.result === "Appeal Allowed" || h.result === "Stay Granted" || h.result === "Leave Granted" ? "success" : h.result === "Stay Rejected" ? "danger" : "info"}>{h.result}</Chip> : <span className="text-muted-foreground text-[12px]">—</span>}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-[12px]">{h.nextDate ? fmtDate(h.nextDate) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <Chip tone={h.readiness === "Ready" ? "success" : "pending"}>{h.readiness}</Chip>
                  </td>
                  <td className="px-3 py-2.5"><Chip tone="neutral">{h.source}</Chip></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RecordHearingDrawer
        open={open}
        matterId={matterId}
        users={users}
        initial={editing}
        onClose={() => setOpen(false)}
        onSubmit={(h, prep) => { onRecord(h, prep); setOpen(false); }}
      />
    </>
  );
}

function RecordHearingDrawer({ open, matterId, users, initial, onClose, onSubmit }: {
  open: boolean; matterId: string; users: User[]; initial: Hearing | null;
  onClose: () => void; onSubmit: (h: Hearing, prep?: Task) => void;
}) {
  const [result, setResult] = useState<NonNullable<Hearing["result"]>>("Part Heard");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextDate, setNextDate] = useState("");
  const [appearedBy, setAppearedBy] = useState<string>(users[0]?.id ?? "");
  const [assistedBy, setAssistedBy] = useState<string>("");
  const [description, setDescription] = useState("");
  const [forum, setForum] = useState<Hearing["forum"]>("CESTAT Delhi");

  useEffect(() => {
    if (open) {
      setResult(initial?.result ?? "Part Heard");
      setDate((initial?.date ?? new Date().toISOString()).slice(0, 10));
      setNextDate(initial?.nextDate ? initial.nextDate.slice(0, 10) : "");
      setAppearedBy(initial?.appearedById ?? users[0]?.id ?? "");
      setAssistedBy(initial?.assistedById ?? "");
      setDescription(initial?.description ?? "");
      setForum(initial?.forum ?? "CESTAT Delhi");
    }
  }, [open, initial, users]);

  const isReserved = result === "Order Reserved";

  const submit = () => {
    const h: Hearing = {
      id: initial?.id ?? `h-${Date.now()}`,
      matterId,
      forum,
      bench: initial?.bench,
      causeListItemNo: initial?.causeListItemNo,
      date: new Date(date).toISOString(),
      nextDate: isReserved || !nextDate ? undefined : new Date(nextDate).toISOString(),
      result,
      appearedById: appearedBy || undefined,
      assistedById: assistedBy || undefined,
      description: description.trim() || undefined,
      source: "Manual",
      readiness: isReserved ? "Ready" : (nextDate ? "Prep pending" : "Ready"),
    };
    let prep: Task | undefined;
    if (!isReserved && nextDate) {
      prep = {
        id: `t-${Date.now()}`,
        matterId,
        taskType: "Drafting",
        subject: `Prep for hearing on ${fmtDate(new Date(nextDate).toISOString())} at ${forum}`,
        assignedById: "u-kavita",
        assigneeId: appearedBy || users[0]!.id,
        dueDate: new Date(new Date(nextDate).getTime() - 2 * 864e5).toISOString(),
        status: "Open",
        priority: "High",
        source: "Hearing",
        createdAt: new Date().toISOString(),
      };
    }
    onSubmit(h, prep);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[520px] sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="text-base flex items-center gap-2"><Gavel className="h-4 w-4" /> Record hearing</SheetTitle>
        </SheetHeader>
        <div className="p-5 space-y-3 overflow-y-auto">
          <Field label="Result">
            <Select value={result} onValueChange={(v) => setResult(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Forum">
            <Select value={forum} onValueChange={(v) => setForum(v as Hearing["forum"])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["CESTAT Delhi", "GSTAT", "Delhi High Court", "Supreme Court", "Commissioner (Appeals)"] as Hearing["forum"][]).map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 font-mono" /></Field>
            {!isReserved && (
              <Field label="Next hearing date"><Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="h-9 font-mono" /></Field>
            )}
          </div>
          {isReserved && (
            <div className="rounded-md bg-muted/40 border border-border p-2 text-[11px] text-muted-foreground">
              Order reserved — no further hearings; matter can be closed after billing.
            </div>
          )}
          <Field label="Appeared By">
            <Select value={appearedBy} onValueChange={setAppearedBy}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Assisted By">
            <Select value={assistedBy || "none"} onValueChange={(v) => setAssistedBy(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note of what happened" /></Field>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save hearing</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}