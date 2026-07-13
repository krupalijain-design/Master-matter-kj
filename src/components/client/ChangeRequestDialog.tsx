import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import type { Client, ClientContact, ClientChangeRequest, ClientRequestFieldDiff, ClientRequestKind, Office } from "@/types";

type Target =
  | { kind: "update-client"; client: Client }
  | { kind: "update-office"; client: Client; office: Office }
  | { kind: "update-contact"; client: Client; office: Office; contact: ClientContact };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: Target | null;
}

const CLIENT_FIELDS: { key: keyof Client; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "groupParent", label: "Group / Parent" },
  { key: "sector", label: "Sector" },
  { key: "subSector", label: "Sub-sector" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "gstin", label: "GSTIN" },
];

const OFFICE_FIELDS: { key: keyof Office; label: string }[] = [
  { key: "label", label: "Office label" },
  { key: "billingAddress", label: "Billing address" },
  { key: "correspondenceAddress", label: "Correspondence address" },
  { key: "invoiceDispatchAddress", label: "Invoice dispatch address" },
];

const CONTACT_FIELDS: { key: keyof ClientContact; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "designation", label: "Designation" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

export function ChangeRequestDialog({ open, onOpenChange, target }: Props) {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const addClientRequest = useAppStore((s) => s.addClientRequest);
  const { data: users } = useUsers();
  const me = users.find((u) => u.id === currentUserId);

  const initial = useMemo(() => {
    if (!target) return {};
    if (target.kind === "update-client") {
      const c = target.client;
      const out: Record<string, string> = {};
      CLIENT_FIELDS.forEach((f) => (out[f.key as string] = String(c[f.key] ?? "")));
      return out;
    }
    if (target.kind === "update-office") {
      const o = target.office;
      const out: Record<string, string> = {};
      OFFICE_FIELDS.forEach((f) => (out[f.key as string] = String(o[f.key] ?? "")));
      return out;
    }
    const c = target.contact;
    const out: Record<string, string> = {};
    CONTACT_FIELDS.forEach((f) => (out[f.key as string] = String(c[f.key] ?? "")));
    return out;
  }, [target]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [note, setNote] = useState("");

  // Reset when target changes
  useMemo(() => setValues(initial), [initial]);

  if (!target || !me) return null;

  const fields =
    target.kind === "update-client" ? CLIENT_FIELDS
    : target.kind === "update-office" ? OFFICE_FIELDS
    : CONTACT_FIELDS;

  const submit = () => {
    const diff: ClientRequestFieldDiff[] = [];
    const current: Record<string, string | undefined> = {};
    const proposed: Record<string, string | undefined> = {};
    fields.forEach((f) => {
      const k = f.key as string;
      const cur = initial[k] ?? "";
      const nxt = values[k] ?? "";
      current[k] = cur;
      proposed[k] = nxt;
      if (cur !== nxt) diff.push({ field: f.label, current: cur || undefined, proposed: nxt || undefined });
    });
    if (diff.length === 0) {
      toast.error("No changes to submit");
      return;
    }
    const kind: ClientRequestKind = target.kind;
    const req: ClientChangeRequest = {
      id: `cr-${Date.now()}`,
      kind,
      status: "Pending Maker",
      requesterId: me.id,
      requesterName: me.fullName,
      requesterRole: currentRole,
      clientId: target.client.id,
      clientNamePreview: target.client.name,
      officeId: target.kind === "update-client" ? undefined : target.kind === "update-office" ? target.office.id : target.office.id,
      contactId: target.kind === "update-contact" ? target.contact.id : undefined,
      proposed,
      current,
      diff,
      dedupeMatches: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thread: [
        {
          id: `t-${Date.now()}`,
          authorId: me.id,
          authorName: me.fullName,
          authorRole: currentRole,
          body: note || "Change request submitted from client detail.",
          at: new Date().toISOString(),
          kind: "comment",
        },
      ],
      slaHours: 0,
    };
    addClientRequest(req);
    toast.success("Change request sent to Master Docketer", {
      description: "You will be notified when the CCM checker approves or rejects it.",
    });
    onOpenChange(false);
    setNote("");
  };

  const title =
    target.kind === "update-client" ? `Request change: ${target.client.name}`
    : target.kind === "update-office" ? `Request office change: ${target.office.label}`
    : `Request contact change: ${target.contact.name}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="outline" className="text-[10px]">CCM required</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2">
          Master Docketer (maker) completes the record, a second reviewer (checker) validates before it lands on file.
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {fields.map((f) => (
            <div key={f.key as string} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <div className="text-[10px] text-muted-foreground">Current: {initial[f.key as string] || "—"}</div>
              <Input
                className="h-8 text-xs"
                value={values[f.key as string] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key as string]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1 mt-2">
          <Label className="text-xs">Note to Master Docketer</Label>
          <Textarea
            className="text-xs min-h-[70px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this change, effective date, any supporting reference."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
