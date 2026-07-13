import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, RefreshCw, Download, Columns3, BellOff, Bell, ChevronsUpDown, ChevronUp, ChevronDown, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, ChipList } from "@/components/ui/chip";
import { useClientsResolved } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { searchClients, matchLabel } from "@/lib/client-match";
import { cx } from "@/lib/format";
import type { Client } from "@/types";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

const ALL_COLUMNS = [
  { key: "clientId", label: "Client ID" },
  { key: "name", label: "Client Name" },
  { key: "oldName", label: "Client Old Name" },
  { key: "newName", label: "Client New Name" },
  { key: "alias", label: "Alias" },
  { key: "sector", label: "Sector" },
  { key: "onboardingDate", label: "Onboarding Date" },
  { key: "status", label: "Status" },
] as const;

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function StatusChip({ status }: { status: Client["status"] }) {
  if (status === "active") return <Chip tone="success">Active</Chip>;
  return <Chip tone="pending">Pending master</Chip>;
}

function ColumnSearch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cx("p-1 rounded hover:bg-muted", value && "text-accent")} aria-label={`Search ${label}`}>
          <Search className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <Input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Filter ${label.toLowerCase()}`} className="h-8 text-xs" />
      </PopoverContent>
    </Popover>
  );
}

export function ClientList() {
  const { data: clients } = useClientsResolved();
  const toggleMute = useAppStore((s) => s.toggleClientMute);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(ALL_COLUMNS.map((c) => c.key));
  const [search, setSearch] = useState("");
  const [colSearch, setColSearch] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    let out: (Client & { _matchLabel?: string | null })[] = [];
    if (search.trim()) {
      const matches = searchClients(clients, search, 40);
      out = matches.map((m) => ({ ...m.client, _matchLabel: matchLabel(m) }));
    } else {
      out = clients.map((c) => ({ ...c }));
    }
    // per-column filters
    out = out.filter((c) => {
      for (const [k, v] of Object.entries(colSearch)) {
        if (!v) continue;
        const q = v.toLowerCase();
        const src = k === "clientId" ? c.id : k === "alias" ? (c.alias ?? []).join(", ")
          : k === "onboardingDate" ? fmtDate(c.onboardingDate)
          : (c as unknown as Record<string, string | undefined>)[k] ?? "";
        if (!String(src).toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sort) {
      const { key, dir } = sort;
      out = [...out].sort((a, b) => {
        const av = String((a as unknown as Record<string, string | undefined>)[key] ?? "");
        const bv = String((b as unknown as Record<string, string | undefined>)[key] ?? "");
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return out;
  }, [clients, search, colSearch, sort]);

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const sortIcon = (key: string) => {
    if (sort?.key !== key) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />;
    return sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };
  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  };

  const cols = ALL_COLUMNS.filter((c) => visibleKeys.includes(c.key));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-normal">Client</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Who we act for. {rows.length} of {clients.length} clients; search hits name, former name, new name, and alias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, old name, alias, GSTIN"
              className="h-8 pl-7 w-72 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => toast.success("Client list refreshed")}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Columns3 className="h-3.5 w-3.5" /> Edit Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
                  <Checkbox
                    checked={visibleKeys.includes(c.key)}
                    onCheckedChange={(v) =>
                      setVisibleKeys((keys) => (v ? [...keys, c.key] : keys.filter((k) => k !== c.key)))
                    }
                  />
                  {c.label}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => toast.success(`Exported ${rows.length} clients as CSV`)}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast.success(`Exported ${rows.length} clients as XLSX`)}>Export as XLSX</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-xs">
          <span><span className="font-medium">{selected.size}</span> selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7" onClick={() => toast.success(`Exported ${selected.size} clients`)}>Export selected</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] editorial-table">
            <thead>
              <tr>
                <th className="w-8">
                  <Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={toggleAll} />
                </th>
                {cols.map((c) => (
                  <th key={c.key} className={cx(c.key === "status" && "w-[140px]")}>
                    <div className="inline-flex items-center gap-1">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key)}>
                        {c.label} {sortIcon(c.key)}
                      </button>
                      <ColumnSearch label={c.label} value={colSearch[c.key] ?? ""} onChange={(v) => setColSearch({ ...colSearch, [c.key]: v })} />
                    </div>
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 2} className="text-center text-xs text-muted-foreground" style={{ padding: "48px 12px" }}>
                    No clients match your filters. Clear the search to see all {clients.length}.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} data-selected={selected.has(c.id) || undefined} className="group">
                  <td>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  {cols.map((col) => {
                    const key = col.key;
                    if (key === "clientId") {
                      return (
                        <td key={key} className="font-mono text-xs tabular-nums text-muted-foreground">
                          {c.id}
                        </td>
                      );
                    }
                    if (key === "name") {
                      return (
                        <td key={key}>
                          <div className="flex flex-col">
                            <Link to="/client/$id" params={{ id: c.id }} className="font-medium text-foreground hover:text-accent inline-flex items-center gap-1">
                              {c.name}
                            </Link>
                            {c._matchLabel && (
                              <span className="text-[11px] text-muted-foreground italic">{c._matchLabel}</span>
                            )}
                          </div>
                        </td>
                      );
                    }
                    if (key === "oldName") {
                      return <td key={key} className="text-xs text-muted-foreground">{c.oldName ?? "—"}</td>;
                    }
                    if (key === "newName") {
                      return <td key={key} className="text-xs text-muted-foreground">{c.newName ?? "—"}</td>;
                    }
                    if (key === "alias") {
                      const list = c.alias ?? [];
                      return (
                        <td key={key} className="whitespace-nowrap">
                          <ChipList
                            items={list}
                            max={2}
                            render={(label) => (
                              <Chip tone="neutral" title={label}>{label}</Chip>
                            )}
                          />
                        </td>
                      );
                    }
                    if (key === "sector") {
                      return (
                        <td key={key} className="text-xs">
                          {c.sector} <span className="text-muted-foreground">/ {c.subSector}</span>
                        </td>
                      );
                    }
                    if (key === "onboardingDate") {
                      return (
                        <td key={key} className="font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtDate(c.onboardingDate)}
                        </td>
                      );
                    }
                    if (key === "status") {
                      return <td key={key} className="whitespace-nowrap"><StatusChip status={c.status} /></td>;
                    }
                    return null;
                  })}
                  <td>
                    <button
                      className={cx("p-1 rounded hover:bg-muted", c.mutedNotifications ? "text-warning" : "text-muted-foreground opacity-0 group-hover:opacity-100")}
                      onClick={(e) => { e.stopPropagation(); toggleMute(c.id); toast.message(c.mutedNotifications ? `Notifications un-muted for ${c.name}` : `Notifications muted for ${c.name}`); }}
                      aria-label={c.mutedNotifications ? "Un-mute notifications" : "Mute notifications"}
                    >
                      {c.mutedNotifications ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
        <ArrowUpRight className="h-3 w-3" />
        Old/New Name and Alias are searched everywhere clients are matched, including intake and ⌘K.
      </div>
    </div>
  );
}
