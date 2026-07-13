import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FolderKanban, Building2, Clock, CheckSquare, BarChart3, Bell, Award, Inbox,
  Activity, ChevronsLeft, ChevronsRight, Pin, Bookmark, PieChart,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useNotifications, useMatters } from "@/hooks/use-data";
import { navGroupFor } from "@/lib/roles";
import { cx } from "@/lib/format";

type Item = { to: string; label: string; Icon: typeof Inbox };
type Zone = { label: string; items: Item[] };

function zonesFor(group: ReturnType<typeof navGroupFor>): { zones: Zone[]; extras: Item[] } {
  if (group === "docketing") {
    return {
      zones: [
        { label: "Pipeline", items: [
          { to: "/mails", label: "Inbox", Icon: Inbox },
        ] },
        { label: "Clients & Matters", items: [
          { to: "/matter", label: "Matter", Icon: FolderKanban },
          { to: "/client", label: "Client", Icon: Building2 },
        ] },
      ],
      extras: [{ to: "/notifications", label: "Notifications", Icon: Bell }],
    };
  }
  if (group === "team") {
    return {
      zones: [
        { label: "Pipeline", items: [
          { to: "/pipeline", label: "Pipeline", Icon: Activity },
        ] },
        { label: "Clients & Matters", items: [
          { to: "/matter", label: "Matter", Icon: FolderKanban },
          { to: "/client", label: "Client", Icon: Building2 },
        ] },
        { label: "Work", items: [
          { to: "/timesheet", label: "TimeSheet", Icon: Clock },
          { to: "/approvals", label: "Approvals", Icon: CheckSquare },
        ] },
        { label: "Reports", items: [
          { to: "/reports", label: "Reports", Icon: BarChart3 },
          { to: "/mis", label: "MIS boards", Icon: PieChart },
        ] },
      ],
      extras: [{ to: "/notifications", label: "Notifications", Icon: Bell }],
    };
  }
  const partner = group === "partner";
  const workItems: Item[] = [
    { to: partner ? "/cockpit" : "/today", label: partner ? "Cockpit" : "My Work", Icon: LayoutDashboard },
    { to: "/timesheet", label: "TimeSheet", Icon: Clock },
    ...(partner ? [{ to: "/approvals", label: "Approvals", Icon: CheckSquare }] : []),
  ];
  const reportItems: Item[] = [
    { to: "/reports", label: "Reports", Icon: BarChart3 },
    ...(partner || group === "leadership" || group === "support"
      ? [{ to: "/mis", label: "MIS boards", Icon: PieChart }]
      : []),
  ];
  return {
    zones: [
      { label: "Work", items: workItems },
      { label: "Clients & Matters", items: [
        { to: "/matter", label: "Matter", Icon: FolderKanban },
        { to: "/client", label: "Client", Icon: Building2 },
      ] },
      { label: "Reports", items: reportItems },
    ],
    extras: [
      { to: "/notifications", label: "Notifications", Icon: Bell },
      { to: "/nonbillable", label: "Non Billable", Icon: Award },
    ],
  };
}

export function Sidebar() {
  const {
    currentRole, railCollapsed, toggleRail, pinnedMatterIds, unpinMatter,
    savedViews, activeSavedViewId, setActiveSavedViewId, removeSavedView,
  } = useAppStore();
  const { data: notifs } = useNotifications();
  const { data: matters } = useMatters();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const group = navGroupFor(currentRole);
  const { zones, extras } = zonesFor(group);
  const unactionedCritical = notifs.some((n) => n.priority === "Critical" && n.state === "Unread");

  const NavRow = ({ to, label, Icon, dot }: Item & { dot?: boolean }) => {
    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={cx(
          "group flex items-center gap-2 h-8 px-2 rounded-md relative text-[13px]",
          active
            ? "bg-accent/10 text-accent font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={railCollapsed ? label : undefined}
      >
        <Icon className={cx("h-4 w-4 shrink-0", active ? "text-accent" : "")} />
        {!railCollapsed && <span className="truncate">{label}</span>}
        {dot && !railCollapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-danger" />}
        {dot && railCollapsed && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-danger" />}
      </Link>
    );
  };

  return (
    <aside
      className={cx(
        "shrink-0 border-r bg-background text-foreground flex flex-col transition-[width] duration-150",
        railCollapsed ? "w-16" : "w-60",
      )}
    >
      {!railCollapsed && (
        <div className="shrink-0 px-3 pt-4 pb-3 border-b border-sidebar-border">
          <div className="font-display text-[18px] leading-none text-foreground">Snowfig</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Powered by AI · Built for LKS
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-1">
        {zones.map((zone, zi) => (
          <div key={zone.label} className={cx(zi > 0 && "pt-3 mt-2 border-t border-sidebar-border")}>
            {!railCollapsed && (
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {zone.label}
              </div>
            )}
            <div className="space-y-0.5">
              {zone.items.map((it) => <NavRow key={it.to} to={it.to} label={it.label} Icon={it.Icon} />)}
            </div>
          </div>
        ))}
        <div className="pt-3 mt-2 border-t border-sidebar-border" />
        {extras.map((it) => (
          <NavRow key={it.to} to={it.to} label={it.label} Icon={it.Icon} dot={it.to === "/notifications" && unactionedCritical} />
        ))}

        {!railCollapsed && pinnedMatterIds.length > 0 && (
          <div className="pt-4">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pinned</div>
            <div className="space-y-0.5">
              {pinnedMatterIds.map((id) => {
                const m = matters.find((x) => x.id === id);
                if (!m) return null;
                return (
                  <div key={id} className="group flex items-center gap-2 px-2 h-7 rounded-md hover:bg-muted text-[12px]">
                    <Pin className="h-3 w-3 text-muted-foreground" />
                    <Link to="/matter/$id" params={{ id }} className="truncate flex-1 text-muted-foreground hover:text-foreground">
                      <span className="font-mono tabular-nums text-[11px] mr-1">#{m.matterId}</span>
                      <span className="truncate">{m.title.slice(0, 22)}…</span>
                    </Link>
                    <button
                      onClick={() => unpinMatter(id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px]"
                      aria-label="Unpin"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!railCollapsed && (
          <div className="pt-4">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved views</div>
            {savedViews.length === 0 && (
              <div className="px-2 py-1 text-[12px] text-muted-foreground italic">No saved views yet.</div>
            )}
            <div className="space-y-0.5">
              <Link
                to="/timesheet"
                search={{ filter: "draft" }}
                className={cx(
                  "group flex items-center gap-2 px-2 h-7 rounded-md text-[12px]",
                  pathname === "/timesheet" ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <Bookmark className="h-3 w-3 text-accent" />
                <span className="truncate flex-1">Draft entries</span>
              </Link>
              {savedViews.map((v) => {
                const active = v.id === activeSavedViewId;
                return (
                  <div key={v.id} className={cx("group flex items-center gap-2 px-2 h-7 rounded-md text-[12px]", active ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground") }>
                    <Bookmark className={cx("h-3 w-3", active ? "text-accent" : "text-muted-foreground")} />
                    <Link to="/matter" onClick={() => setActiveSavedViewId(v.id)} className="truncate flex-1">
                      {v.name}
                    </Link>
                    <button
                      onClick={() => removeSavedView(v.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px]"
                      aria-label="Remove saved view"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          onClick={toggleRail}
          className="w-full h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center gap-1 text-xs"
          aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={railCollapsed ? "Expand" : "Collapse"}
        >
          {railCollapsed ? <ChevronsRight className="h-4 w-4" /> : (<><ChevronsLeft className="h-4 w-4" /> Collapse</>)}
        </button>
      </div>
    </aside>
  );
}