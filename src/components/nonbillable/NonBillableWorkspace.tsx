import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, Check, Download, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppStore } from "@/store/app-store";
import { useNonBillableResolved, useUsers } from "@/hooks/use-data";
import type { NonBillableWork } from "@/types";
import { cx } from "@/lib/format";

const KINDS: NonBillableWork["kind"][] = ["Article", "Newsletter", "Conference", "Seminar", "Webinar"];

function fmtDate(iso: string) {
  return iso.split("-").reverse().join("/");
}

function StatusChip({ s }: { s: NonBillableWork["status"] }) {
  const cls =
    s === "Approved" ? "bg-success/15 text-success border-success/30" :
    s === "Rejected" ? "bg-danger/15 text-danger border-danger/30" :
    "bg-pending/15 text-pending border-pending/30";
  return <Badge variant="outline" className={cx("h-5 text-[10px] font-normal", cls)}>{s}</Badge>;
}

export function NonBillableWorkspace() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const addNonBillable = useAppStore((s) => s.addNonBillable);
  const decideNonBillable = useAppStore((s) => s.decideNonBillable);
  const { data: nb } = useNonBillableResolved();
  const { data: users } = useUsers();

  const currentUser = users.find((u) => u.id === currentUserId);
  const isPartner = currentUser?.roles.includes("Case Partner") ?? false;
  const canApprove = isPartner && currentRole === "Case Partner";

  const partners = users.filter((u) => u.roles.includes("Case Partner") && u.id !== currentUserId);
  const defaultApprover = partners[0]?.id ?? "u-kavita";

  const [kind, setKind] = useState<NonBillableWork["kind"]>("Article");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [link, setLink] = useState("");
  const [approverId, setApproverId] = useState<string>(defaultApprover);

  const mySubs = useMemo(
    () => nb.filter((n) => n.userId === currentUserId).sort((a, b) => b.date.localeCompare(a.date)),
    [nb, currentUserId],
  );

  const pendingForMe = useMemo(
    () => nb.filter((n) => n.status === "Submitted" && (n.approverId === currentUserId || (!n.approverId && canApprove))),
    [nb, currentUserId, canApprove],
  );

  const fyCredits = useMemo(() => {
    const map: Record<NonBillableWork["kind"], number> = { Article: 0, Newsletter: 0, Conference: 0, Seminar: 0, Webinar: 0 };
    for (const n of nb) {
      if (n.userId !== currentUserId) continue;
      if (n.status !== "Approved") continue;
      map[n.kind] += 1;
    }
    return map;
  }, [nb, currentUserId]);
  const fyTotal = Object.values(fyCredits).reduce((a, b) => a + b, 0);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    const id = `nb-${Date.now().toString(36)}`;
    addNonBillable({ id, userId: currentUserId, kind, title: title.trim(), date, status: "Submitted", approverId });
    setTitle("");
    setLink("");
    const approverName = users.find((u) => u.id === approverId)?.fullName ?? "approver";
    toast.success("Submitted for approval", { description: `${kind} sent to ${approverName}` });
  };

  const exportHR = () => {
    toast.success(`Exported ${fyTotal} approved items`, { description: "FY credit summary queued for HR (CSV mock)." });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-normal tracking-tight">Non-billable work</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Credit for the work beyond the brief: articles, newsletters, conferences, seminars, webinars.
        </p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My work</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approvals">
              Approvals {pendingForMe.length > 0 && <span className="ml-1 rounded bg-accent/15 text-accent text-[10px] px-1.5 py-0.5 font-mono">{pendingForMe.length}</span>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="text-sm font-medium">My submissions</div>
                  <div className="text-[11px] text-muted-foreground">{mySubs.length} total</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full compact-table">
                    <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Kind</th>
                        <th className="text-left px-3 py-2">Title</th>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-left px-3 py-2">Approver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySubs.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-[12px] text-muted-foreground">Nothing submitted yet. Use the card on the right to submit for approval.</td></tr>
                      )}
                      {mySubs.map((n) => {
                        const approver = users.find((u) => u.id === n.approverId);
                        return (
                          <tr key={n.id} className="border-t">
                            <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{n.kind}</Badge></td>
                            <td className="px-3 py-2 truncate max-w-[420px]">{n.title}</td>
                            <td className="px-3 py-2 font-mono text-[12px]">{fmtDate(n.date)}</td>
                            <td className="px-3 py-2"><StatusChip s={n.status} /></td>
                            <td className="px-3 py-2 text-[12px] text-muted-foreground">{approver?.fullName ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-accent" />
                    <div>
                      <div className="text-sm font-medium">FY credit summary</div>
                      <div className="text-[11px] text-muted-foreground">Approved items in FY26 (feeds appraisal export).</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={exportHR}>
                    <Download className="h-3.5 w-3.5" /> Export for HR
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {KINDS.map((k) => (
                    <div key={k} className="rounded-md border p-3">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{k}</div>
                      <div className="text-2xl font-semibold font-mono tabular-nums mt-1">{fyCredits[k]}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[12px] text-muted-foreground">
                  Total approved credits: <span className="font-mono tabular-nums text-foreground">{fyTotal}</span>
                </div>
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-4">
              <Card className="p-4 sticky top-4">
                <div className="text-sm font-medium mb-3">Submit new</div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Kind</Label>
                    <Select value={kind} onValueChange={(v) => setKind(v as NonBillableWork["kind"])}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title</Label>
                    <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GST cross-charge: practical playbook" />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</Label>
                    <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Link (optional)</Label>
                    <Input className="mt-1" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Approver</Label>
                    <Select value={approverId} onValueChange={setApproverId}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {partners.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={submit} disabled={!title.trim()}>
                    Submit for approval
                  </Button>
                  <div className="text-[11px] text-muted-foreground">
                    Appears in your Waiting-on list on My Work until the approver decides.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {canApprove && (
          <TabsContent value="approvals" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="text-sm font-medium">Awaiting your decision</div>
                <div className="text-[11px] text-muted-foreground">{pendingForMe.length} pending</div>
              </div>
              {pendingForMe.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-muted-foreground">All caught up. No non-billable submissions waiting.</div>
              ) : (
                <div className="divide-y">
                  {pendingForMe.map((n) => {
                    const u = users.find((x) => x.id === n.userId);
                    return <ApprovalRow key={n.id} nb={n} submitterName={u?.fullName ?? n.userId} onDecide={(status, note) => {
                      decideNonBillable(n.id, status, currentUserId, note);
                      toast.success(status === "Approved" ? "Approved" : "Rejected", { description: `${u?.fullName ?? "Submitter"} · ${n.title}` });
                    }} />;
                  })}
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ApprovalRow({ nb, submitterName, onDecide }: { nb: NonBillableWork; submitterName: string; onDecide: (status: "Approved" | "Rejected", note?: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <Badge variant="outline" className="text-[10px]">{nb.kind}</Badge>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] truncate">{nb.title}</div>
        <div className="text-[11px] text-muted-foreground">{submitterName} · {fmtDate(nb.date)}</div>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><X className="h-3 w-3" /> Reject</Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-2">
          <div className="text-[12px] font-medium">Reason</div>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note to the submitter" />
          <Button size="sm" variant="destructive" className="w-full" onClick={() => onDecide("Rejected", note.trim() || undefined)}>Reject with note</Button>
        </PopoverContent>
      </Popover>
      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onDecide("Approved")}>
        <Check className="h-3 w-3" /> Approve
      </Button>
    </div>
  );
}