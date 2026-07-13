import { createFileRoute, Outlet, useRouterState, Link } from "@tanstack/react-router";
import { Users, Sliders, ScrollText, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { auditLog } from "@/mocks/audit";

export const Route = createFileRoute("/admin")({ component: Layout });

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin") return <Outlet />;
  return <AdminIndex />;
}

function AdminIndex() {
  const { data: users } = useUsers();
  const cfg = useAppStore((s) => s.autodocketConfig);
  const storeAudit = useAppStore((s) => s.auditLog);
  const auditCount = storeAudit.length + auditLog.length;
  const roleGrantsToday = storeAudit.filter((a) => a.action.startsWith("Roles updated")).length;

  const cards = [
    {
      to: "/admin/roles",
      icon: Users,
      title: "Roles & assignments",
      desc: "Grant or revoke roles, assign users to queues.",
      stat: `${users.length} users`,
      sub: `${roleGrantsToday} role changes today`,
    },
    {
      to: "/admin/rules",
      icon: Sliders,
      title: "Docketing rules",
      desc: "Ingestion exclusions, queue weights, automation thresholds.",
      stat: cfg.killSwitch ? "Kill switch ON" : `T_auto ${cfg.tAuto}`,
      sub: `${cfg.samplePct}% audit sample`,
      danger: cfg.killSwitch,
    },
    {
      to: "/admin/audit",
      icon: ScrollText,
      title: "Audit trail",
      desc: "Every approve, reject, create, allocate — with actor and role.",
      stat: `${auditCount} events`,
      sub: "Filterable and exportable",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-normal tracking-tight">Admin console</h1>
        <p className="text-sm text-muted-foreground mt-1">Users, roles, rules, audit trail.</p>
      </div>
      {cfg.killSwitch && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[13px]">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
          <div>
            <div className="font-medium text-destructive">Automation kill switch is active</div>
            <div className="text-muted-foreground">All inbound mail is routing to Docketer triage. Disable in <Link to="/admin/rules" className="underline">Docketing rules</Link>.</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="rounded-lg border border-border bg-card p-4 shadow-sm hover:border-accent transition">
            <div className="flex items-center gap-2">
              <c.icon className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">{c.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{c.desc}</p>
            <div className={`mt-3 font-mono tabular-nums text-sm ${c.danger ? "text-destructive" : ""}`}>{c.stat}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}