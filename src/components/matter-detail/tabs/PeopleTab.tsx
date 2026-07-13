import { Mail, Phone } from "lucide-react";
import { cx } from "@/lib/format";
import type { Matter, Client, Office, User } from "@/types";

export function PeopleTab({ matter, client, office, users }: {
  matter: Matter; client?: Client; office?: Office; users: User[];
}) {
  const casePartner = users.find((u) => u.id === matter.casePartnerId);
  const caseManager = matter.caseManagerId ? users.find((u) => u.id === matter.caseManagerId) : null;
  const associates = matter.caseAssociateIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u);
  const paralegals = matter.paralegalIds.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-lg border shadow-sm p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Team</div>
        <div className="mt-3 space-y-3">
          {casePartner && <TeamRow role="Case Partner" u={casePartner} />}
          {caseManager && <TeamRow role="Case Manager" u={caseManager} />}
          {associates.map((u) => <TeamRow key={u.id} role="Associate" u={u} />)}
          {paralegals.map((u) => <TeamRow key={u.id} role="Paralegal" u={u} />)}
        </div>
      </div>

      <div className="rounded-lg border shadow-sm p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Client contacts</div>
        {client && office ? (
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-[12px] font-medium">{client.name} · {office.label}</div>
            </div>
            <ContactBlock label="Billing" address={office.billingAddress} contact={office.contacts[0]} />
            <ContactBlock label="Correspondence" address={office.correspondenceAddress} contact={office.contacts[0]} />
            <ContactBlock label="Invoice Dispatch" address={office.invoiceDispatchAddress} contact={office.contacts[0]} />
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground italic mt-3">No client on file.</div>
        )}
      </div>
    </div>
  );
}

function TeamRow({ role, u }: { role: string; u: User }) {
  const size = 32;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (u.capacityPct / 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted fill-none" />
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
            className={cx("fill-none", u.capacityPct >= 95 ? "stroke-danger" : u.capacityPct >= 85 ? "stroke-warning" : "stroke-accent")}
            strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-[10px] font-semibold">{u.avatarInitials}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px]">{u.fullName}</div>
        <div className="text-[11px] text-muted-foreground">{role} · {u.branch} · {u.capacityPct}% capacity</div>
      </div>
    </div>
  );
}

function ContactBlock({ label, address, contact }: { label: string; address: string; contact?: { name: string; email: string; phone: string; designation: string } }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {contact && (
        <div className="mt-1.5 text-[13px]">
          <div className="font-medium">{contact.name}</div>
          <div className="text-[11px] text-muted-foreground">{contact.designation}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px]"><Mail className="h-3 w-3 text-muted-foreground" />{contact.email}</div>
          <div className="flex items-center gap-1.5 text-[12px]"><Phone className="h-3 w-3 text-muted-foreground" />{contact.phone}</div>
        </div>
      )}
      <div className="mt-1.5 text-[12px] text-muted-foreground">{address}</div>
    </div>
  );
}