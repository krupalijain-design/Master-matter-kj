import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Mail, Phone, User as UserIcon, Edit3, FileText, History as HistoryIcon, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, CategoryChip, ChipList } from "@/components/ui/chip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useClientsResolved, useMatters, useRtbs, useClientRequests } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { can } from "@/rbac/matrix";
import { users } from "@/mocks/users";
import { formatINR, cx } from "@/lib/format";
import { ChangeRequestDialog } from "./ChangeRequestDialog";
import type { Client, ClientContact, Office } from "@/types";

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function ClientDetail({ id }: { id: string }) {
  const { data: clients } = useClientsResolved();
  const { data: matters } = useMatters();
  const { data: rtbs } = useRtbs();
  const { data: requests } = useClientRequests();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);

  const client = clients.find((c) => c.id === id);
  const me = users.find((u) => u.id === currentUserId);

  const [target, setTarget] = useState<Parameters<typeof ChangeRequestDialog>[0]["target"]>(null);
  const [open, setOpen] = useState(false);

  const clientMatters = useMemo(() => matters.filter((m) => m.clientId === id), [matters, id]);
  const clientRtbs = useMemo(() => {
    const ids = new Set(clientMatters.map((m) => m.id));
    return rtbs.filter((r) => ids.has(r.matterId));
  }, [rtbs, clientMatters]);
  const relatedRequests = useMemo(() => requests.filter((r) => r.clientId === id), [requests, id]);

  if (!client || !me) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
          Client not found. <Link to="/client" className="text-accent hover:underline">Back to clients</Link>
        </div>
      </div>
    );
  }

  const isCcm = me.roles.includes("Master Docketer");
  // Billing tab: visible when the user can view money on the clients resource
  const showBilling = can(me, "view", "money") && currentRole !== "Associate" && currentRole !== "Paralegal" && currentRole !== "Court Staff";

  const totals = clientRtbs.reduce(
    (acc, r) => {
      if (r.status === "Paid") acc.paid += r.billingAmount;
      if (r.status === "Invoiced" || r.status === "Approved") acc.billed += r.billingAmount;
      acc.due += r.outstandingAmount;
      return acc;
    },
    { billed: 0, paid: 0, due: 0 },
  );

  const openRequest = (t: Parameters<typeof ChangeRequestDialog>[0]["target"]) => {
    setTarget(t);
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/client" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Clients
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{client.name}</span>
      </div>

      <div className="rounded-lg border border-border p-4 bg-background">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{client.id}</span>
              <h1 className="text-lg font-semibold">{client.name}</h1>
              <Chip tone={client.status === "active" ? "success" : "pending"}>
                {client.status === "active" ? "Active" : "Pending master"}
              </Chip>
              {client.oldName && (
                <Chip tone="neutral">Formerly {client.oldName}</Chip>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{client.sector} / {client.subSector}</span>
              <span>·</span>
              <span>{client.city}, {client.state}</span>
              {client.gstin && (<><span>·</span><span className="font-mono">{client.gstin}</span></>)}
              {client.groupParent && (<><span>·</span><span>Group: {client.groupParent}</span></>)}
              <span>·</span>
              <span>Onboarded {fmtDate(client.onboardingDate)}</span>
            </div>
            {(client.alias?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">Alias:</span>
                <ChipList items={client.alias!} max={2} render={(a) => <Chip tone="neutral">{a}</Chip>} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCcm ? (
              <Button size="sm" variant="outline" className="h-8" onClick={() => openRequest({ kind: "update-client", client })}>
                <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit client
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8" onClick={() => openRequest({ kind: "update-client", client })}>
                Request change → Master Docketer
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="matters">Matters <span className="ml-1 text-[10px] text-muted-foreground">{clientMatters.length}</span></TabsTrigger>
          {showBilling && <TabsTrigger value="billing">Billing summary</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          {relatedRequests.some((r) => r.status !== "Approved" && r.status !== "Rejected") && (
            <Alert>
              <AlertDescription className="text-xs">
                {relatedRequests.filter((r) => r.status !== "Approved" && r.status !== "Rejected").length} open change request(s) with Master Docketer.
                <Link to="/client/requests" className="text-accent hover:underline ml-2">Open queue</Link>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {client.offices.map((o) => (
              <OfficeCard
                key={o.id}
                client={client}
                office={o}
                isCcm={isCcm}
                onEditOffice={() => openRequest({ kind: "update-office", client, office: o })}
                onEditContact={(c) => openRequest({ kind: "update-contact", client, office: o, contact: c })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matters">
          <div className="rounded-lg border border-border overflow-hidden bg-background">
            <table className="w-full editorial-table">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Matter ID</th>
                  <th className="px-3 py-2 text-left font-medium">Title</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {clientMatters.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-10 text-center text-xs text-muted-foreground">No matters for this client yet.</td></tr>
                )}
                {clientMatters.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono tabular-nums text-xs">
                      <Link to="/matter/$id" params={{ id: m.id }} className="hover:text-accent">{m.matterId}</Link>
                    </td>
                    <td className="px-3 py-2">{m.title}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="inline-flex items-center gap-1.5">
                        <CategoryChip category={m.category} />
                        <span className="text-muted-foreground">/ {m.subCategory}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Chip tone={m.status === "Ongoing" ? "info" : "success"}>{m.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {showBilling && (
          <TabsContent value="billing">
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Billed" value={formatINR(totals.billed)} />
              <StatCard label="Paid" value={formatINR(totals.paid)} tone="success" />
              <StatCard label="Due" value={formatINR(totals.due)} tone="warning" />
              <StatCard label="Realization Rate" value={`${client.realizationRate}%`} />
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Based on {clientRtbs.length} RTB(s) across {clientMatters.length} matter(s).
            </div>
          </TabsContent>
        )}

        <TabsContent value="history">
          <div className="rounded-lg border border-border p-3 bg-background space-y-2">
            {relatedRequests.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">No change requests recorded yet.</div>
            )}
            {relatedRequests.map((r) => (
              <div key={r.id} className="flex items-start gap-3 text-xs border-b border-border last:border-0 py-2">
                <HistoryIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-foreground">
                    {r.requesterName} <span className="text-muted-foreground">({r.requesterRole})</span> requested {r.kind.replace("-", " ")}
                  </div>
                  <div className="text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{r.status}</span> · {fmtDate(r.updatedAt)}
                  </div>
                </div>
                <Link to="/client/requests" className="text-accent hover:underline text-[11px] inline-flex items-center gap-0.5">
                  Open <FileText className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <ChangeRequestDialog open={open} onOpenChange={setOpen} target={target} />
    </div>
  );
}

function OfficeCard({
  client, office, isCcm, onEditOffice, onEditContact,
}: {
  client: Client; office: Office; isCcm: boolean;
  onEditOffice: () => void;
  onEditContact: (c: ClientContact) => void;
}) {
  const sofExists = client.gstin && client.status === "active";
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div className="font-medium text-sm">{office.label}</div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEditOffice}>
          <Edit3 className="h-3 w-3 mr-1" />
          {isCcm ? "Edit" : "Request change"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs">
        <AddressRow label="Billing" value={office.billingAddress} />
        <AddressRow label="Correspondence" value={office.correspondenceAddress} />
        <AddressRow label="Invoice dispatch" value={office.invoiceDispatchAddress} />
      </div>
      <div className="border-t border-border pt-2 space-y-1.5">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center justify-between">
          <span>Contacts</span>
          {sofExists && (
            <span className="inline-flex items-center gap-1 text-muted-foreground normal-case">
              <Lock className="h-2.5 w-2.5" /> SOF on file
            </span>
          )}
        </div>
        {office.contacts.length === 0 && (
          <div className="text-xs text-muted-foreground italic">No contacts on file.</div>
        )}
        {office.contacts.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 text-xs py-1">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <UserIcon className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">· {c.designation}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-muted-foreground pl-5">
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>
              </div>
            </div>
            <button
              className="text-[11px] text-muted-foreground hover:text-accent inline-flex items-center gap-1"
              onClick={() => onEditContact(c)}
            >
              <Edit3 className="h-3 w-3" /> {isCcm ? "Edit" : "Request change"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground w-24 mt-0.5">{label}</span>
      <span className="text-xs text-foreground flex-1">{value}</span>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cx(
        "text-lg font-mono tabular-nums mt-1",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
      )}>
        {value}
      </div>
    </div>
  );
}
