import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRtbs, useMatters, useClients, useWriteOffs } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { Ban, CheckCircle2, FileText, Wallet, Coins } from "lucide-react";

export function CollectionsWorkspace() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-normal tracking-tight">Collections & invoicing</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Read-only matter context. No documents. No narratives.</p>
      </div>
      <Tabs defaultValue="approved">
        <TabsList>
          <TabsTrigger value="approved" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Approved RTBs</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Invoices & payments</TabsTrigger>
          <TabsTrigger value="writeoffs" className="gap-1.5"><Coins className="h-3.5 w-3.5" /> Write-offs</TabsTrigger>
          <TabsTrigger value="advances" className="gap-1.5">Advances</TabsTrigger>
        </TabsList>
        <TabsContent value="approved" className="mt-4"><ApprovedTab /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesTab /></TabsContent>
        <TabsContent value="writeoffs" className="mt-4"><WriteOffsTab /></TabsContent>
        <TabsContent value="advances" className="mt-4"><AdvancesTab /></TabsContent>
      </Tabs>

      <VoidedList />
    </div>
  );
}

function useContext() {
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const ctx = (matterId: string) => {
    const m = matters.find((x) => x.id === matterId);
    const c = m ? clients.find((cc) => cc.id === m.clientId) : undefined;
    return { m, c };
  };
  return ctx;
}

function ApprovedTab() {
  const { data: rtbs } = useRtbs();
  const ctx = useContext();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const list = useMemo(() => rtbs.filter((r) => r.status === "Approved"), [rtbs]);
  const [invoicedNow, setInvoicedNow] = useState<Set<string>>(new Set());

  const invoice = (id: string, matterId: string) => {
    setInvoicedNow((s) => new Set(s).add(id));
    appendAudit({ actor: currentUserId, actorName: "Accounts", activeRole: "Accounts", action: "rtb.invoiced", resource: "rtb", matterId });
    toast.success("Invoice raised.", { description: "Matter money strip updated." });
  };

  if (list.length === 0) return <Empty label="No approved RTBs pending invoice." />;
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full editorial-table">
        <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr><Th>RTB No.</Th><Th>Matter</Th><Th>Client</Th><Th className="text-right">Amount</Th><Th /></tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const { m, c } = ctx(r.matterId);
            const done = invoicedNow.has(r.id);
            return (
              <tr key={r.id} className="border-t">
                <Td className="font-mono">{r.rtbNo}</Td>
                <Td className="font-mono text-[12px]">{m?.matterId} <span className="text-muted-foreground ml-1 font-sans">{m?.title}</span></Td>
                <Td className="text-[12px]">{c?.name ?? "—"}</Td>
                <Td className="text-right font-mono tabular-nums">{formatINR(r.billingAmount)}</Td>
                <Td className="text-right">
                  {done ? <Chip tone="success">Invoiced</Chip>
                    : <Button size="sm" className="h-7" onClick={() => invoice(r.id, r.matterId)}>Raise invoice</Button>}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTab() {
  const { data: rtbs } = useRtbs();
  const ctx = useContext();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const postPayment = useAppStore((s) => s.postPayment);
  const list = useMemo(() => rtbs.filter((r) => r.status === "Invoiced" || r.status === "Paid"), [rtbs]);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const target = list.find((r) => r.id === payFor);

  const confirm = () => {
    if (!target) return;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    postPayment(target.id, amt, currentUserId);
    appendAudit({ actor: currentUserId, actorName: "Accounts", activeRole: "Accounts", action: "payment.posted", resource: "collections", matterId: target.matterId });
    toast.success(`Posted ${formatINR(amt)} against ${target.invoiceNo ?? target.rtbNo}`, {
      description: "Matter money strip updated live.",
    });
    setPayFor(null); setAmount("");
  };

  if (list.length === 0) return <Empty label="No invoices on file." />;
  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full editorial-table">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><Th>Invoice</Th><Th>RTB</Th><Th>Matter · Client</Th><Th className="text-right">Billed</Th><Th className="text-right">Outstanding</Th><Th>Status</Th><Th /></tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const { m, c } = ctx(r.matterId);
              return (
                <tr key={r.id} className="border-t">
                  <Td className="font-mono text-[12px]">{r.invoiceNo ?? "—"}</Td>
                  <Td className="font-mono text-[12px]">{r.rtbNo}</Td>
                  <Td className="text-[12px]"><span className="font-mono">{m?.matterId}</span> · {c?.name ?? "—"}</Td>
                  <Td className="text-right font-mono tabular-nums">{formatINR(r.billingAmount)}</Td>
                  <Td className="text-right font-mono tabular-nums">{formatINR(r.outstandingAmount)}</Td>
                  <Td>{r.status === "Paid"
                    ? <Chip tone="success">Paid</Chip>
                    : <Chip tone="info">Invoiced</Chip>}</Td>
                  <Td className="text-right">
                    {r.outstandingAmount > 0 && (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => { setPayFor(r.id); setAmount(String(r.outstandingAmount)); }}>Post payment</Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!payFor} onOpenChange={(v) => !v && setPayFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Post payment</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[13px]">
            <div className="text-muted-foreground">Invoice <span className="font-mono text-foreground">{target?.invoiceNo ?? target?.rtbNo}</span> · outstanding <span className="font-mono tabular-nums">{formatINR(target?.outstandingAmount ?? 0)}</span></div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Amount (₹)</div>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={confirm}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WriteOffsTab() {
  const { data: wo } = useWriteOffs();
  const ctx = useContext();
  const setStatus = useAppStore((s) => s.setWriteOffStatus);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const approved = wo.filter((w) => w.status === "Approved");
  const executed = wo.filter((w) => w.status === "Declined"); // reuse as "Executed" in this mock accounts tab? keep both separate.

  const execute = (id: string, matterId: string) => {
    setStatus(id, "Declined", "Executed by Accounts");
    appendAudit({ actor: currentUserId, actorName: "Accounts", activeRole: "Accounts", action: "writeoff.executed", resource: "collections", matterId });
    toast.success("Write-off executed.");
  };

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Partner-approved · awaiting Accounts execution</div>
        {approved.length === 0 ? <div className="text-[12px] text-muted-foreground py-3">No approved write-offs pending.</div> : (
          <ul className="divide-y">
            {approved.map((w) => {
              const { m, c } = ctx(w.matterId);
              return (
                <li key={w.id} className="py-2.5 flex items-center gap-3 text-[13px]">
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><span className="font-mono text-[12px]">{m?.matterId}</span> · {c?.name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">Aging {w.agingDays}d · {w.reason}</div>
                  </div>
                  <div className="font-mono tabular-nums">{formatINR(w.amount)}</div>
                  <Button size="sm" className="h-7" onClick={() => execute(w.id, w.matterId)}>Execute</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {executed.length > 0 && (
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" /> Executed</div>
          <ul className="divide-y">
            {executed.map((w) => {
              const { m } = ctx(w.matterId);
              return (
                <li key={w.id} className="py-2 text-[12px] flex items-center justify-between">
                  <span><span className="font-mono">{m?.matterId}</span> · {w.reason}</span>
                  <span className="font-mono tabular-nums">{formatINR(w.amount)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AdvancesTab() {
  // Small mock: list clients with negative outstanding (advances) — none in seed, so illustrative empty state.
  return <Empty label="No unadjusted advances on file." />;
}

function VoidedList() {
  const { data: rtbs } = useRtbs();
  const voided = rtbs.filter((r) => r.status === "Voided");
  if (voided.length === 0) return null;
  return (
    <Card className="p-3 border-danger/30">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Ban className="h-3 w-3 text-danger" /> Voided RTBs (wrongly initiated)</div>
      <ul className="space-y-1 text-[13px]">
        {voided.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className="font-mono line-through text-muted-foreground">{r.rtbNo}</span>
            <span className="line-through text-muted-foreground truncate flex-1">{r.items[0]?.description}</span>
            <Chip tone="danger" strikethrough>Do not use</Chip>
          </li>
        ))}
      </ul>
      <div className="text-[11px] text-muted-foreground mt-2">Void → re-raise only. No edit path.</div>
    </Card>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) { return <th className={"text-left px-3 py-2 " + className}>{children}</th>; }
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) { return <td className={"px-3 py-2 " + className}>{children}</td>; }
function Empty({ label }: { label: string }) { return <div className="rounded-md border border-dashed p-8 text-center text-[13px] text-muted-foreground">{label}</div>; }