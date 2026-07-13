import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cx, formatINR } from "@/lib/format";
import type { RTB, RTBItem, TimeEntry, User } from "@/types";
import { Chip, type ChipTone } from "@/components/ui/chip";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function rtbTone(s: RTB["status"]): ChipTone {
  switch (s) {
    case "Draft": return "neutral";
    case "Pending Approval": return "pending";
    case "Approved": return "info";
    case "Invoiced": return "pending";
    case "Paid": return "success";
    case "Cancellation Requested": return "danger";
    case "Written Off": return "danger";
    case "Voided": return "danger";
  }
}

export function TimeBillingTab({ matterId, timeEntries, users, rtbs, billFilter, onCreateRTB }: {
  matterId: string;
  timeEntries: TimeEntry[];
  users: User[];
  rtbs: RTB[];
  billFilter?: string;
  onCreateRTB: (rtb: RTB) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredRtbs = useMemo(() => {
    if (!billFilter) return rtbs;
    switch (billFilter) {
      case "billed": return rtbs;
      case "collected": return rtbs.filter((r) => r.billingAmount - r.outstandingAmount > 0);
      case "due": return rtbs.filter((r) => r.outstandingAmount > 0);
      case "overdue": return rtbs.filter((r) => r.status === "Invoiced" && r.outstandingAmount > 0);
      default: return rtbs;
    }
  }, [rtbs, billFilter]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-4">
      <div className="rounded-lg border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Time entries</div>
          <div className="text-[12px] text-muted-foreground">{timeEntries.length} entries</div>
        </div>
        <table className="w-full editorial-table">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Activity</th>
              <th className="text-left px-3 py-2">h:mm</th>
              <th className="text-left px-3 py-2">Narrative</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {timeEntries.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-[13px]">
                <div className="font-medium">No time entries yet</div>
                <div className="text-[11px] text-muted-foreground mt-1">Use Log time from the header to record work.</div>
              </td></tr>
            )}
            {timeEntries.map((t) => {
              const u = users.find((x) => x.id === t.userId);
              return (
                <tr key={t.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono tabular-nums text-[12px]">{fmtDate(t.date)}</td>
                  <td className="px-3 py-2.5">{u?.fullName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{t.activityType}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{t.hours}:{String(t.minutes).padStart(2, "0")}</td>
                  <td className="px-3 py-2.5 text-[12px] max-w-sm truncate">{t.narrative}</td>
                  <td className="px-3 py-2.5"><Chip tone={t.status === "Approved" ? "success" : t.status === "Submitted" ? "info" : t.status === "Queried" ? "danger" : "neutral"}>{t.status}</Chip></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Requests to Bill</div>
          <Button size="sm" className="h-7 gap-1.5" onClick={() => setDrawerOpen(true)}><Plus className="h-3.5 w-3.5" /> Create RTB</Button>
        </div>
        {billFilter && (
          <div className="px-3 py-2 border-b bg-muted/20 text-[11px] flex items-center gap-2">
            <span className="text-muted-foreground">Filtered:</span>
            <span className="font-medium">{billFilter}</span>
          </div>
        )}
        <div className="divide-y">
          {filteredRtbs.length === 0 && <div className="p-6 text-center text-[13px]">
            <div className="font-medium">No RTBs match this filter</div>
            <div className="text-[11px] text-muted-foreground mt-1">Clear the filter or create the first RTB.</div>
          </div>}
          {filteredRtbs.map((r) => (
            <div key={r.id} className="p-3 hover:bg-muted/30">
              <div className="flex items-center gap-2">
                <span className={cx("font-mono tabular-nums text-[13px]", r.status === "Voided" && "line-through opacity-70")}>{r.rtbNo}</span>
                <span className="ml-auto"><Chip tone={rtbTone(r.status)} strikethrough={r.status === "Voided"}>{r.status}</Chip></span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bill amount</div><div className="font-mono tabular-nums">{formatINR(r.billingAmount)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</div><div className="font-mono tabular-nums">{formatINR(r.billingAmount - r.outstandingAmount)}</div></div>
              </div>
              {r.invoiceNo && <div className="mt-1 text-[11px] text-muted-foreground font-mono">Invoice {r.invoiceNo} · {r.invoiceDate ? fmtDate(r.invoiceDate) : ""}</div>}
            </div>
          ))}
        </div>
      </div>

      <CreateRTBDrawer
        open={drawerOpen}
        matterId={matterId}
        users={users}
        onClose={() => setDrawerOpen(false)}
        onSubmit={(rtb) => { onCreateRTB(rtb); setDrawerOpen(false); }}
      />
    </div>
  );
}

function CreateRTBDrawer({ open, matterId, users, onClose, onSubmit }: {
  open: boolean; matterId: string; users: User[]; onClose: () => void; onSubmit: (rtb: RTB) => void;
}) {
  const partners = users.filter((u) => u.roles.includes("Case Partner"));
  const [billedBy, setBilledBy] = useState<string>(partners[0]?.id ?? "");
  const [apportion, setApportion] = useState(false);
  const [splits, setSplits] = useState<{ partnerId: string; pct: number }[]>([{ partnerId: partners[0]?.id ?? "", pct: 100 }]);
  const [items, setItems] = useState<RTBItem[]>([{ kind: "Fee", description: "Fees for services rendered", amount: 0 }]);

  useEffect(() => {
    if (open) {
      setBilledBy(partners[0]?.id ?? "");
      setApportion(false);
      setSplits([{ partnerId: partners[0]?.id ?? "", pct: 100 }]);
      setItems([{ kind: "Fee", description: "Fees for services rendered", amount: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const splitSum = splits.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const splitOk = !apportion || splitSum === 100;
  const canSave = total > 0 && billedBy && splitOk;

  const submit = (asDraft: boolean) => {
    const rtb: RTB = {
      id: `r-${Date.now()}`,
      rtbNo: `00008${Math.floor(30000 + Math.random() * 9999)}`,
      matterId,
      billedBy,
      apportionment: apportion ? splits : undefined,
      items,
      billingAmount: total,
      outstandingAmount: total,
      status: asDraft ? "Draft" : "Pending Approval",
    };
    onSubmit(rtb);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[560px] sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="text-base">Create RTB</SheetTitle>
        </SheetHeader>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Billed By</div>
            <Select value={billedBy} onValueChange={setBilledBy}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={apportion} onCheckedChange={setApportion} />
              Apportionment required?
            </label>
            {apportion && (
              <div className="space-y-2">
                {splits.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_28px] gap-2 items-center">
                    <Select value={s.partnerId} onValueChange={(v) => setSplits((cur) => cur.map((x, j) => j === i ? { ...x, partnerId: v } : x))}>
                      <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Partner" /></SelectTrigger>
                      <SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min={0} max={100} value={s.pct} onChange={(e) => setSplits((cur) => cur.map((x, j) => j === i ? { ...x, pct: Number(e.target.value) || 0 } : x))} className="h-8 font-mono text-[12px]" />
                    <button onClick={() => setSplits((cur) => cur.filter((_, j) => j !== i))} className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-danger" aria-label="Remove split"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setSplits((cur) => [...cur, { partnerId: partners[0]?.id ?? "", pct: 0 }])}>
                  <Plus className="h-3 w-3" /> Add partner
                </Button>
                <div className={cx("text-[11px]", splitSum === 100 ? "text-success" : "text-danger")}>
                  Total: {splitSum}% {splitSum !== 100 && "— must equal 100%"}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Line items</div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[130px_1fr_120px_28px] gap-2 items-center">
                  <Select value={it.kind} onValueChange={(v) => setItems((cur) => cur.map((x, j) => j === i ? { ...x, kind: v as RTBItem["kind"] } : x))}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fee">Fee</SelectItem>
                      <SelectItem value="Fixed Fee">Fixed Fee</SelectItem>
                      <SelectItem value="Reimbursement">Reimbursement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={it.description} onChange={(e) => setItems((cur) => cur.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" className="h-8 text-[12px]" />
                  <Input type="number" value={it.amount} onChange={(e) => setItems((cur) => cur.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="h-8 font-mono text-[12px]" />
                  <button onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))} className="h-8 w-8 grid place-items-center text-muted-foreground hover:text-danger" aria-label="Remove item"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setItems((cur) => [...cur, { kind: "Fee", description: "", amount: 0 }])}>
                <Plus className="h-3 w-3" /> Add item
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted/40 border p-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Running total</span>
            <span className="font-mono tabular-nums text-[15px]">{formatINR(total)}</span>
          </div>

          {apportion && !splitOk && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription className="text-[12px]">Apportionment must total 100% before submitting.</AlertDescription>
            </Alert>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={!canSave} onClick={() => submit(true)}>Save as Draft</Button>
          <Button disabled={!canSave} onClick={() => submit(false)}>Submit for approval</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}