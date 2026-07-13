import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useUsers } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { roleRegistry, CATEGORY_LABEL } from "@/rbac/matrix";
import type { Role, RoleCategory, User } from "@/types";

export const Route = createFileRoute("/admin/roles")({ component: RolesPage });

const ORDER: RoleCategory[] = ["matter-ops", "pipeline", "leadership", "support"];

function RolesPage() {
  const { data: users } = useUsers();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const canManage = !!currentUser?.roles.some((r) => r === "Admin Manager" || r === "DB Admin");
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = useMemo(
    () => users.filter((u) =>
      !q || u.fullName.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || u.branch.toLowerCase().includes(q.toLowerCase()),
    ),
    [users, q],
  );

  const editing = users.find((u) => u.id === editId) ?? null;

  if (!canManage) {
    return (
      <div className="p-6 max-w-3xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not authorized</AlertTitle>
          <AlertDescription>Only Admin Manager or DB Admin can manage roles.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Roles & assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">Grant or revoke roles. Every change is written to the audit trail.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" className="pl-7 h-8 w-64 text-xs" />
        </div>
      </div>

      <div className="rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full editorial-table">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Branch</th>
              <th className="text-left px-3 py-2 font-medium">Held roles</th>
              <th className="text-left px-3 py-2 font-medium">Default lens</th>
              <th className="text-left px-3 py-2 font-medium">Last active</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{u.fullName}</div>
                  <div className="text-[11px] text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{u.branch}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px] font-normal h-5">{r}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-[12px]">{u.roles[0] ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground font-mono tabular-nums text-[12px]">{lastActive(u.id)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(u.id)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditRolesDrawer user={editing} currentUserId={currentUserId} onClose={() => setEditId(null)} />
    </div>
  );
}

function lastActive(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const mins = (h % 720) + 1;
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

function EditRolesDrawer({ user, currentUserId, onClose }: { user: User | null; currentUserId: string; onClose: () => void }) {
  const setUserRoles = useAppStore((s) => s.setUserRoles);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentRole = useAppStore((s) => s.currentRole);
  const [selected, setSelected] = useState<Set<Role>>(new Set());

  useMemo(() => {
    if (user) setSelected(new Set(user.roles));
  }, [user?.id]);

  if (!user) return null;

  const isSelf = user.id === currentUserId;
  const hadAdmin = user.roles.includes("Admin Manager");
  const willHaveAdmin = selected.has("Admin Manager");
  const selfDemote = isSelf && hadAdmin && !willHaveAdmin;

  const grouped: Record<RoleCategory, Role[]> = { "matter-ops": [], pipeline: [], leadership: [], support: [] };
  roleRegistry.forEach((r) => grouped[r.category].push(r.role));

  const toggle = (r: Role) => {
    const next = new Set(selected);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    setSelected(next);
  };

  const save = () => {
    if (selfDemote) return;
    if (selected.size === 0) {
      toast.error("A user must hold at least one role");
      return;
    }
    const next = Array.from(selected);
    const added = next.filter((r) => !user.roles.includes(r));
    const removed = user.roles.filter((r) => !next.includes(r));
    setUserRoles(user.id, next);
    appendAudit({
      actor: currentUserId,
      actorName: "You",
      activeRole: currentRole,
      action: `Roles updated for ${user.fullName}${added.length ? ` +[${added.join(", ")}]` : ""}${removed.length ? ` -[${removed.join(", ")}]` : ""}`,
      resource: "admin",
    });
    toast.success(`${user.fullName}'s roles updated`);
    onClose();
  };

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{user.fullName}</SheetTitle>
          <SheetDescription>{user.email} · {user.branch}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {selfDemote && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>You cannot remove your own Admin Manager role</AlertTitle>
              <AlertDescription>Ask another Admin Manager or DB Admin to make this change.</AlertDescription>
            </Alert>
          )}
          {ORDER.map((cat) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{CATEGORY_LABEL[cat]}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {grouped[cat].map((r) => (
                  <label key={r} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[13px] hover:bg-muted/40 cursor-pointer">
                    <Checkbox checked={selected.has(r)} onCheckedChange={() => toggle(r)} />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={selfDemote}>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}