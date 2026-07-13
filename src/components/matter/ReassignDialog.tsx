import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsers } from "@/hooks/use-data";
import type { Role } from "@/types";

const REASSIGN_ROLES: Role[] = ["Case Partner", "Case Manager", "Associate", "Paralegal"];

export function ReassignDialog({
  open,
  count,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onOpenChange: (v: boolean) => void;
  onConfirm: (role: Role, userId: string, userName: string) => void;
}) {
  const { data: users } = useUsers();
  const [role, setRole] = useState<Role>("Case Manager");
  const [q, setQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const candidates = users
    .filter((u) => u.roles.includes(role))
    .filter((u) => (q ? u.fullName.toLowerCase().includes(q.toLowerCase()) : true))
    .slice(0, 8);

  const submit = () => {
    if (!selectedUserId) return;
    const u = users.find((x) => x.id === selectedUserId);
    if (!u) return;
    onConfirm(role, u.id, u.fullName);
    setSelectedUserId(null);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Re-Assign {count} matter{count === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Role</div>
            <Select value={role} onValueChange={(v) => { setRole(v as Role); setSelectedUserId(null); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASSIGN_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Assign to</div>
            <Input placeholder="Search team members" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
            <div className="mt-1 border rounded-md divide-y max-h-56 overflow-y-auto">
              {candidates.length === 0 && (
                <div className="text-xs text-muted-foreground p-3">No team members match this role.</div>
              )}
              {candidates.map((u) => (
                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer text-[13px]">
                  <input
                    type="radio"
                    name="reassign-user"
                    checked={selectedUserId === u.id}
                    onChange={() => setSelectedUserId(u.id)}
                  />
                  <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px] font-semibold">
                    {u.avatarInitials}
                  </div>
                  <span className="flex-1 truncate">{u.fullName}</span>
                  <span className="text-[10px] text-muted-foreground">{u.branch}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selectedUserId} onClick={submit}>Confirm re-assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
