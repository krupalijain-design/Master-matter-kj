import { useMemo, useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  RefreshCw, Search, X, Bell, RadioTower, Lock, ChevronDown, ChevronUp, ChevronsUpDown,
  Bookmark, Download, ArrowUpRight, UserCog, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useMatters, useClients, useUsers, useNotifications } from "@/hooks/use-data";
import { useAppStore, type MatterQuickFilter, type MatterTab, type MatterListView } from "@/store/app-store";
import { navGroupFor } from "@/lib/roles";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MatterPeekDrawer } from "@/components/shell/MatterPeekDrawer";
import { EditColumnsPopover } from "./EditColumnsPopover";
import { ReassignDialog } from "./ReassignDialog";
import { MATTER_COLUMNS, DEFAULT_COLUMN_KEYS } from "./columns";
import type { Matter, Role } from "@/types";
import { Chip, CategoryChip } from "@/components/ui/chip";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

const QUICK_FILTERS: { key: MatterQuickFilter; label: string; tone: "warning" | "pending" | "accent" | "danger" | "muted" }[] = [
  { key: "partial-details", label: "partial-details", tone: "warning" },
  { key: "client-pending", label: "client-pending", tone: "pending" },
  { key: "pending-checker", label: "Pending (Checker)", tone: "accent" },
  { key: "not-synced", label: "Not Synced", tone: "danger" },
  { key: "unallocated", label: "Unallocated", tone: "muted" },
];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
};

function toneClasses(tone: string, active: boolean) {
  const base = "h-7 px-2.5 text-[11px] rounded-full border inline-flex items-center gap-1 transition-colors";
  if (active) {
    const map: Record<string, string> = {
      warning: "bg-warning/15 border-warning/40 text-warning",
      pending: "bg-pending/15 border-pending/40 text-pending",
      accent: "bg-accent/15 border-accent/40 text-accent",
      danger: "bg-danger/15 border-danger/40 text-danger",
      muted: "bg-muted border-border text-foreground",
    };
    return cx(base, map[tone] ?? map.muted);
  }
  return cx(base, "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted");
}

function TagPill({ tag }: { tag: Matter["tags"][number] }) {
  if (tag === "partial-details") return <Chip tone="pending">partial-details</Chip>;
  if (tag === "client-pending") return <Chip tone="pending">client-pending</Chip>;
  if (tag === "conflict-review") return <Chip tone="danger">conflict-review</Chip>;
  if (tag === "SOF-exists") return <Chip tone="neutral" icon={<Lock className="h-2.5 w-2.5" />}>SOF</Chip>;
  return null;
}

function ColumnSearchTrigger({
  active,
  onChange,
  value,
  label,
}: { active: boolean; value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cx("h-4 w-4 grid place-items-center rounded hover:bg-muted", active && "text-accent")} aria-label={`Search ${label}`}>
          <Search className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <Input
          autoFocus
          placeholder={`Search ${label}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
        {value && (
          <button className="mt-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onChange("")}>
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function MatterList() {
  const navigate = useNavigate();
  const { data: matters } = useMatters();
  const isLoading = false;
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const { data: notifs } = useNotifications();
  const { currentRole, matterColumnKeys, setMatterColumnKeys, savedViews, addSavedView, activeSavedViewId, setActiveSavedViewId } = useAppStore();
  const isTeamManager = currentRole === "Team Manager";
  const navGroup = navGroupFor(currentRole);

  const [tab, setTab] = useState<MatterTab>("all");
  const [search, setSearch] = useState("");
  const [quickFilters, setQuickFilters] = useState<MatterQuickFilter[]>([]);
  const [columnSearches, setColumnSearches] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>({ key: "createdAt", dir: "desc" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAgo, setLastRefreshAgo] = useState(22);

  // Apply an active saved view once when it changes (e.g. via sidebar click)
  useEffect(() => {
    if (!activeSavedViewId) return;
    const v = savedViews.find((x) => x.id === activeSavedViewId);
    if (!v) return;
    setTab(v.tab);
    setSearch(v.search);
    setQuickFilters(v.quickFilters);
    setColumnSearches(v.columnSearches);
    setMatterColumnKeys(v.columnKeys);
    // Only apply once per activation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSavedViewId]);

  // Clear active view marker if user changes anything after applying
  useEffect(() => {
    if (!activeSavedViewId) return;
    const v = savedViews.find((x) => x.id === activeSavedViewId);
    if (!v) return;
    const same =
      v.tab === tab &&
      v.search === search &&
      v.quickFilters.length === quickFilters.length &&
      v.quickFilters.every((q) => quickFilters.includes(q));
    if (!same) setActiveSavedViewId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, quickFilters]);

  const columnKeys = matterColumnKeys ?? DEFAULT_COLUMN_KEYS;
  const visibleCols = MATTER_COLUMNS.filter((c) => columnKeys.includes(c.key));

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const notifCountByMatter = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notifs) {
      if (n.matterId && n.state === "Unread") map.set(n.matterId, (map.get(n.matterId) ?? 0) + 1);
    }
    return map;
  }, [notifs]);

  const rowValue = useCallback((m: Matter, key: string): string => {
    switch (key) {
      case "matterId": return String(m.matterId);
      case "clientName": return clientById[m.clientId]?.name ?? "";
      case "title": return m.title;
      case "deliverable": return m.deliverable;
      case "subType": return m.subType;
      case "subCategory": return m.subCategory;
      case "category": return m.category;
      case "matterType": return m.matterType;
      case "casePartner": return userById[m.casePartnerId]?.fullName ?? "";
      case "caseManager": return m.caseManagerId ? userById[m.caseManagerId]?.fullName ?? "" : "";
      case "caseAssociate": return m.caseAssociateIds.map((id) => userById[id]?.fullName ?? "").join(", ");
      case "branch": return m.branch;
      case "createdAt": return m.createdAt;
      case "status": return `${m.status} · ${m.pipelineState}`;
      case "maker": return m.makerId ? userById[m.makerId]?.fullName ?? "" : "";
      case "docRef": return m.docRefNumber ?? "";
      default: return "";
    }
  }, [clientById, userById]);

  const filtered = useMemo(() => {
    let rows = matters.slice();
    if (tab === "ongoing") rows = rows.filter((m) => m.status === "Ongoing");
    else if (tab === "completed") rows = rows.filter((m) => m.status === "Completed");

    for (const qf of quickFilters) {
      if (qf === "partial-details") rows = rows.filter((m) => m.tags.includes("partial-details"));
      else if (qf === "client-pending") rows = rows.filter((m) => m.tags.includes("client-pending"));
      else if (qf === "pending-checker") rows = rows.filter((m) => m.pipelineState === "Pending");
      else if (qf === "not-synced") rows = rows.filter((m) => m.syncStatus === "Not Synced");
      else if (qf === "unallocated") rows = rows.filter((m) => m.allocationState === "Unallocated");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((m) => {
        return (
          String(m.matterId).includes(q) ||
          m.title.toLowerCase().includes(q) ||
          (clientById[m.clientId]?.name.toLowerCase().includes(q) ?? false) ||
          (m.docRefNumber?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    for (const [key, term] of Object.entries(columnSearches)) {
      if (!term) continue;
      const q = term.toLowerCase();
      rows = rows.filter((m) => rowValue(m, key).toLowerCase().includes(q));
    }

    if (sort) {
      const { key, dir } = sort;
      const mul = dir === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        const av = rowValue(a, key);
        const bv = rowValue(b, key);
        if (key === "matterId") return (Number(av) - Number(bv)) * mul;
        if (key === "createdAt") return (new Date(av).getTime() - new Date(bv).getTime()) * mul;
        return av.localeCompare(bv) * mul;
      });
    }

    return rows;
  }, [matters, tab, quickFilters, search, columnSearches, sort, clientById, rowValue]);

  const toggleSort = (key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const clearAll = () => {
    setSearch("");
    setQuickFilters([]);
    setColumnSearches({});
  };

  const toggleQuick = (k: MatterQuickFilter) => {
    setQuickFilters((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  };

  const openPeek = (id: string) => {
    setPeekLoading(true);
    setPeekId(id);
    window.setTimeout(() => setPeekLoading(false), 120);
  };

  const onRowClick = (e: React.MouseEvent, m: Matter) => {
    if ((e.target as HTMLElement).closest("[data-row-stop]")) return;
    if (e.metaKey || e.ctrlKey) {
      navigate({ to: "/matter/$id", params: { id: m.id } });
      return;
    }
    openPeek(m.id);
  };

  const allSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0;

  const doRefresh = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      setLastRefreshAgo(0);
      toast.success("Refreshed", { description: "Court and mail sync are up to date." });
    }, 600);
  };

  const doExport = (kind: "CSV" | "Excel", scope: "all" | "selected") => {
    const count = scope === "selected" ? selectedIds.size : filtered.length;
    toast.success(`${kind} export queued`, { description: `${count} matter${count === 1 ? "" : "s"} · file will download shortly.` });
  };

  const doReassign = (role: Role, _userId: string, userName: string) => {
    const count = selectedIds.size;
    setReassignOpen(false);
    setSelectedIds(new Set());
    toast.success(`Re-assigned ${count} matter${count === 1 ? "" : "s"}`, {
      description: `${role} → ${userName}`,
      action: { label: "Undo", onClick: () => toast("Re-assign reverted.") },
    });
  };

  const saveView = () => {
    if (!newViewName.trim()) return;
    const view: MatterListView = {
      id: `sv-${Date.now()}`,
      name: newViewName.trim(),
      tab,
      search,
      quickFilters,
      columnKeys,
      columnSearches,
    };
    addSavedView(view);
    setNewViewName("");
    setSaveViewOpen(false);
    toast.success("View saved", { description: `"${view.name}" added to Saved views.` });
  };

  const activeViewName = savedViews.find((v) => v.id === activeSavedViewId)?.name;

  const renderCell = (m: Matter, key: string) => {
    switch (key) {
      case "matterId": {
        const unread = notifCountByMatter.get(m.id) ?? 0;
        return (
          <div className="flex items-center gap-1.5">
            <Link
              to="/matter/$id"
              params={{ id: m.id }}
              data-row-stop
              onClick={(e) => e.stopPropagation()}
              className="font-mono tabular-nums text-[12px] text-accent hover:underline"
            >
              #{m.matterId}
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cx("h-3 w-3 grid place-items-center", m.syncStatus === "Synced" ? "text-success" : "text-danger")}>
                  {m.syncStatus === "Synced" ? <RadioTower className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">Court/mail sync — last {lastRefreshAgo}m ago</TooltipContent>
            </Tooltip>
            {unread > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative inline-flex" data-row-stop>
                    <Bell className="h-3 w-3 text-warning" />
                    <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-danger" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{unread} unread notification{unread === 1 ? "" : "s"}</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      }
      case "clientName": {
        const c = clientById[m.clientId];
        return <span className="truncate block max-w-[180px]">{c?.name ?? "—"}</span>;
      }
      case "title":
        return (
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="truncate max-w-[320px]">{m.title}</div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">{m.title}</TooltipContent>
            </Tooltip>
            {m.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {m.tags.map((t) => <TagPill key={t} tag={t} />)}
              </div>
            )}
          </div>
        );
      case "deliverable": return <span className="text-muted-foreground text-[12px]">{m.deliverable}</span>;
      case "subType": return <span className="text-muted-foreground text-[12px]">{m.subType}</span>;
      case "subCategory": return <span className="text-muted-foreground text-[12px]">{m.subCategory}</span>;
      case "category": return <CategoryChip category={m.category} />;
      case "matterType": return <span className="text-muted-foreground text-[12px]">{m.matterType}</span>;
      case "casePartner": return <span>{userById[m.casePartnerId]?.fullName ?? "—"}</span>;
      case "caseManager": return <span>{m.caseManagerId ? userById[m.caseManagerId]?.fullName : <span className="text-muted-foreground italic">Unassigned</span>}</span>;
      case "caseAssociate": return <span className="text-muted-foreground text-[12px]">{m.caseAssociateIds.map((id) => userById[id]?.fullName).filter(Boolean).join(", ") || "—"}</span>;
      case "branch": return <Badge variant="outline" className="text-[10px] font-normal">{m.branch}</Badge>;
      case "createdAt": return <span className="font-mono tabular-nums text-[12px] text-muted-foreground">{fmtDate(m.createdAt)}</span>;
      case "status": return (
        <span className="inline-flex items-center gap-1 text-[12px]">
          <span className={cx("h-1.5 w-1.5 rounded-full", m.status === "Ongoing" ? "bg-accent" : "bg-danger")} />
          {m.status} · {m.pipelineState}
        </span>
      );
      case "maker": return <span className="text-muted-foreground text-[12px]">{m.makerId ? userById[m.makerId]?.fullName : "—"}</span>;
      case "docRef": return <span className="font-mono tabular-nums text-[11px] text-muted-foreground">{m.docRefNumber ?? "—"}</span>;
      default: return null;
    }
  };

  const activeColSearchKeys = Object.entries(columnSearches).filter(([, v]) => v).map(([k]) => k);
  const hasAnyFilter = search || quickFilters.length > 0 || activeColSearchKeys.length > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-[26px] font-normal tracking-tight">Matter</h1>
            {activeViewName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Bookmark className="h-2.5 w-2.5" /> {activeViewName}
              </Badge>
            )}
            <span className="text-[13px] text-muted-foreground ml-2 hidden md:inline">Every matter, one click deep.</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Here"
                className="h-8 pl-8 w-56 text-[13px]"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={doRefresh}>
                  <RefreshCw className={cx("h-3.5 w-3.5", refreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh · last {lastRefreshAgo}m ago</TooltipContent>
            </Tooltip>
            <EditColumnsPopover value={columnKeys} onChange={setMatterColumnKeys} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs">Export</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => doExport("CSV", someSelected ? "selected" : "all")}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport("Excel", someSelected ? "selected" : "all")}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isTeamManager && (
              <Button size="sm" className="h-8 gap-1.5" disabled={!someSelected} onClick={() => setReassignOpen(true)}>
                <UserCog className="h-3.5 w-3.5" /> Re-Assign
              </Button>
            )}
          </div>
        </div>

        {/* Tabs + save view */}
        <div className="mt-4 flex items-center gap-2 border-b">
          {(["all", "ongoing", "completed"] as MatterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                "h-9 px-3 text-[13px] border-b-2 -mb-px transition-colors",
                tab === t ? "border-accent text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "all" ? "All" : t === "ongoing" ? "Ongoing" : "Completed"}
            </button>
          ))}
          <div className="ml-auto pb-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setSaveViewOpen(true)}>
              <Bookmark className="h-3.5 w-3.5" /> Save view
            </Button>
          </div>
        </div>

        {/* Quick-filter chips */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Quick filters</span>
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              onClick={() => toggleQuick(qf.key)}
              className={toneClasses(qf.tone, quickFilters.includes(qf.key))}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Active-filter pills */}
        {hasAnyFilter && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Applied</span>
            {search && (
              <FilterPill label={`search: ${search}`} onClose={() => setSearch("")} />
            )}
            {quickFilters.map((qf) => (
              <FilterPill key={qf} label={QUICK_FILTERS.find((x) => x.key === qf)?.label ?? qf} onClose={() => toggleQuick(qf)} />
            ))}
            {activeColSearchKeys.map((k) => (
              <FilterPill
                key={k}
                label={`${MATTER_COLUMNS.find((c) => c.key === k)?.label}: ${columnSearches[k]}`}
                onClose={() => setColumnSearches((cur) => ({ ...cur, [k]: "" }))}
              />
            ))}
            <button
              onClick={clearAll}
              className="h-7 px-2 rounded-full text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Bulk bar */}
        {someSelected && (
          <div className="mt-3 flex items-center gap-3 rounded-md border bg-accent/5 px-3 h-11">
            <span className="text-[12px]">
              <span className="font-semibold">{selectedIds.size}</span> selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              {isTeamManager && (
                <Button size="sm" className="h-7 gap-1.5" onClick={() => setReassignOpen(true)}>
                  <UserCog className="h-3.5 w-3.5" /> Re-Assign
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => doExport("CSV", "selected")}>
                <Download className="h-3.5 w-3.5" /> Export selected
              </Button>
              <button onClick={() => setSelectedIds(new Set())} className="text-[11px] text-muted-foreground hover:text-foreground">Clear</button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="mt-4 border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="w-8 px-2 py-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(filtered.map((m) => m.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="w-6 px-1 py-2" />
                  {visibleCols.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => c.sortable && toggleSort(c.key)}
                          disabled={!c.sortable}
                        >
                          <span>{c.label}</span>
                          {c.sortable && (
                            sort?.key === c.key
                              ? (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                              : <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                        {c.searchable && (
                          <ColumnSearchTrigger
                            active={!!columnSearches[c.key]}
                            value={columnSearches[c.key] ?? ""}
                            onChange={(v) => setColumnSearches((cur) => ({ ...cur, [c.key]: v }))}
                            label={c.label}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-t">
                      <td className="px-2 py-3"><Skeleton className="h-4 w-4" /></td>
                      <td />
                      {visibleCols.map((c) => (
                        <td key={c.key} className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
                      ))}
                    </tr>
                  ))
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 2} className="p-10 text-center">
                      <div className="text-sm font-medium">No matters match these filters</div>
                      <div className="text-xs text-muted-foreground mt-1">Try clearing a filter or widening the search.</div>
                      {hasAnyFilter && (
                        <Button size="sm" variant="outline" className="mt-3 h-7" onClick={clearAll}>Clear all filters</Button>
                      )}
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={(e) => onRowClick(e, m)}
                    className={cx(
                      "border-t cursor-pointer hover:bg-muted/40 transition-colors align-top",
                      selectedIds.has(m.id) && "bg-accent/5",
                    )}
                  >
                    <td className="px-2 py-2.5" data-row-stop>
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={(v) => {
                          setSelectedIds((cur) => {
                            const next = new Set(cur);
                            if (v) next.add(m.id); else next.delete(m.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-1 py-2.5">
                      <span className={cx("inline-block h-2 w-2 rounded-full", m.status === "Ongoing" ? "bg-accent" : "bg-danger")} />
                    </td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 align-top">{renderCell(m, c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t bg-muted/20 text-[11px] text-muted-foreground flex items-center">
            Showing {filtered.length} of {matters.length} matters
            <button
              onClick={() => filtered[0] && openPeek(filtered[0].id)}
              className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
            >
              Open first <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <MatterPeekDrawer
          matterId={peekId}
          loading={peekLoading}
          onClose={() => setPeekId(null)}
        />

        <ReassignDialog
          open={reassignOpen}
          count={selectedIds.size}
          onOpenChange={setReassignOpen}
          onConfirm={doReassign}
        />

        <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Save current view</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-[13px]">
              <div className="text-muted-foreground text-xs">
                Saves the current tab, filters, column selection and column searches to the left rail.
              </div>
              <Input
                autoFocus
                placeholder="View name, e.g. My open GST customs"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
              <Button onClick={saveView} disabled={!newViewName.trim()}>Save view</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role hint (dev-only visual cue) */}
        {!isTeamManager && navGroup !== "team" && (
          <div className="sr-only">Re-Assign is only visible to the Team Manager role.</div>
        )}
      </div>
    </TooltipProvider>
  );
}

function FilterPill({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <span className="h-7 pl-2 pr-1 rounded-full text-[11px] inline-flex items-center gap-1 bg-muted border border-border">
      <span className="truncate max-w-[220px]">{label}</span>
      <button onClick={onClose} className="h-4 w-4 grid place-items-center rounded hover:bg-background" aria-label={`Remove ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
