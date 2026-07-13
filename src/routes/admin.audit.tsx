import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { auditLog } from "@/mocks/audit";
import { roleRegistry } from "@/rbac/matrix";
import { Chip } from "@/components/ui/chip";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

function AuditPage() {
  const store = useAppStore((s) => s.auditLog);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [resource, setResource] = useState<string>("all");

  const items = useMemo(() => [...store, ...auditLog], [store]);

  const resources = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.resource && s.add(i.resource));
    return Array.from(s).sort();
  }, [items]);

  const filtered = items.filter((i) => {
    if (role !== "all" && i.activeRole !== role) return false;
    if (resource !== "all" && i.resource !== resource) return false;
    if (q && !`${i.action} ${i.actorName} ${i.matterId ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const exportCsv = () => {
    const header = "at,actor,activeRole,action,resource,matterId\n";
    const body = filtered
      .map((i) => [i.at, i.actorName, i.activeRole, JSON.stringify(i.action), i.resource ?? "", i.matterId ?? ""].join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground mt-1">Every approve, reject, create, allocate, role change — with actor and active role.</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, actor, matter ID" className="pl-7 h-8 text-xs" />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roleRegistry.map((r) => <SelectItem key={r.role} value={r.role} className="text-xs">{r.role}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resource} onValueChange={setResource}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Resource" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {resources.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border shadow-sm overflow-hidden bg-background">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">No audit events match.</div>
        ) : (
          <table className="w-full editorial-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>As role</th>
                <th>Resource</th>
                <th>Action</th>
                <th>Matter</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td className="font-mono tabular-nums text-[12px] text-muted-foreground whitespace-nowrap">
                    {new Date(it.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td>{it.actorName}</td>
                  <td><Chip tone="neutral">{it.activeRole}</Chip></td>
                  <td>{it.resource ? <Chip tone="info">{it.resource}</Chip> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-[12px]">{it.action}</td>
                  <td className="font-mono tabular-nums text-[11px] text-muted-foreground">{it.matterId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}