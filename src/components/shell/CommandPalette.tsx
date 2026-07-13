import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useMatters, useClients, useRtbs } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { firmTemplates } from "@/mocks/reports";
import { FileText, LayoutDashboard, Plus } from "lucide-react";
import { toast } from "sonner";

type Scope = "all" | "matter" | "client" | "rtb";
const scopes: Scope[] = ["all", "matter", "client", "rtb"];

export function CommandPalette({ open, setOpen, onPeekMatter }: { open: boolean; setOpen: (v: boolean) => void; onPeekMatter: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const navigate = useNavigate();
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const { data: rtbs } = useRtbs();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const savedReports = useAppStore((s) => s.reports);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const i = scopes.indexOf(scope);
        setScope(scopes[(i + 1) % scopes.length]!);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, scope]);

  const q = query.toLowerCase().replace(/^(matter|client|rtb):/, "").trim();

  const MIS_ROLES = new Set(["Case Partner","Case Manager","Team Manager","Group Head","Practice Head","Executive Head","Management","Admin Manager"]);
  const misVisible = MIS_ROLES.has(currentRole);
  const reportsVisible = !["Paralegal","Court Staff"].includes(currentRole);
  const detectedScope: Scope = query.startsWith("matter:") ? "matter" : query.startsWith("client:") ? "client" : query.startsWith("rtb:") ? "rtb" : scope;

  const reportPool = useMemo(() => {
    const own = savedReports.filter((r) => r.ownerId === currentUserId);
    const shared = savedReports.filter((r) => r.ownerId !== currentUserId && r.visibility !== "Private");
    return [...own, ...shared, ...firmTemplates];
  }, [savedReports, currentUserId]);

  const reportMatches = useMemo(() => {
    if (!q) return reportPool.slice(0, 5);
    return reportPool
      .filter((r) => `${r.name} ${r.description ?? ""} ${r.dataset}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [reportPool, q]);

  const matterMatches = useMemo(
    () => matters.filter((m) => `${m.matterId} ${m.title} ${m.clientId}`.toLowerCase().includes(q)).slice(0, 6),
    [matters, q],
  );
  const clientMatches = useMemo(() => {
    if (!q) return clients.slice(0, 6).map((c) => ({ client: c, matchedOn: "name" as const, matchedValue: c.name, score: 100 }));
    // Local search on name, oldName, newName, alias, gstin
    const out: { client: typeof clients[number]; matchedOn: "name" | "oldName" | "newName" | "alias" | "gstin"; matchedValue: string; score: number }[] = [];
    for (const c of clients) {
      const candidates: { key: "name" | "oldName" | "newName" | "alias" | "gstin"; value: string }[] = [
        { key: "name", value: c.name },
      ];
      if (c.oldName) candidates.push({ key: "oldName", value: c.oldName });
      if (c.newName && c.newName !== c.name) candidates.push({ key: "newName", value: c.newName });
      (c.alias ?? []).forEach((a) => candidates.push({ key: "alias", value: a }));
      if (c.gstin) candidates.push({ key: "gstin", value: c.gstin });
      let best: typeof out[number] | null = null;
      for (const cand of candidates) {
        if (cand.value.toLowerCase().includes(q)) {
          const score = cand.value.toLowerCase() === q ? 100 : 80;
          if (!best || score > best.score) best = { client: c, matchedOn: cand.key, matchedValue: cand.value, score };
        }
      }
      if (best) out.push(best);
    }
    return out.slice(0, 6);
  }, [clients, q]);
  const rtbMatches = useMemo(
    () => rtbs.filter((r) => r.rtbNo.includes(q)).slice(0, 6),
    [rtbs, q],
  );

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search matters, clients, RTBs… (Tab to switch scope, ⌘↵ to peek)"
        value={query}
        onValueChange={setQuery}
      />
      <div className="border-b px-3 py-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        Scope:
        {scopes.map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-1.5 py-0.5 rounded ${detectedScope === s ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {detectedScope === "all" && reportsVisible && reportMatches.length > 0 && (
          <CommandGroup heading="Reports">
            {reportMatches.map((r) => (
              <CommandItem
                key={r.id}
                onSelect={() => { navigate({ to: "/reports/$id", params: { id: r.id } }); close(); }}
              >
                <FileText className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <span className="truncate">{r.name}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{r.visibility}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(detectedScope === "all" || detectedScope === "matter") && matterMatches.length > 0 && (
          <CommandGroup heading="Matters">
            {matterMatches.map((m) => (
              <CommandItem
                key={m.id}
                onSelect={(_v) => {
                  const withMeta = (window.event as KeyboardEvent | undefined) as { metaKey?: boolean; ctrlKey?: boolean } | undefined;
                  if (withMeta?.metaKey || withMeta?.ctrlKey) {
                    onPeekMatter(m.id);
                  } else {
                    navigate({ to: "/matter/$id", params: { id: m.id } });
                  }
                  close();
                }}
              >
                <span className="font-mono tabular-nums text-xs mr-2">#{m.matterId}</span>
                <span className="truncate">{m.title}</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground">↵ open · ⌘↵ peek</kbd>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(detectedScope === "all" || detectedScope === "client") && clientMatches.length > 0 && (
          <CommandGroup heading="Clients">
            {clientMatches.map((m) => (
              <CommandItem key={m.client.id} onSelect={() => { navigate({ to: "/client/$id", params: { id: m.client.id } }); close(); }}>
                <div className="flex flex-col">
                  <span>{m.client.name}</span>
                  {m.matchedOn !== "name" && (
                    <span className="text-[10px] text-muted-foreground italic">
                      matched on {m.matchedOn === "oldName" ? "former name" : m.matchedOn === "newName" ? "new name" : m.matchedOn === "alias" ? "alias" : "GSTIN"} "{m.matchedValue}"
                    </span>
                  )}
                </div>
                <span className="ml-auto text-[11px] text-muted-foreground">{m.client.sector}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(detectedScope === "all" || detectedScope === "rtb") && rtbMatches.length > 0 && (
          <CommandGroup heading="RTBs">
            {rtbMatches.map((r) => (
              <CommandItem key={r.id} onSelect={() => { navigate({ to: "/matter/$id", params: { id: r.matterId } }); close(); }}>
                <span className="font-mono tabular-nums text-xs mr-2">{r.rtbNo}</span>
                <span>{r.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {detectedScope === "all" && (
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { navigate({ to: "/matter/new" }); close(); }}>Create matter <kbd className="ml-auto text-[10px] text-muted-foreground">⌘N</kbd></CommandItem>
            <CommandItem onSelect={() => { toast("Quick time entry stub"); close(); }}>Log time <kbd className="ml-auto text-[10px] text-muted-foreground">T</kbd></CommandItem>
            <CommandItem onSelect={() => { navigate({ to: "/matter/allocation" }); close(); }}>Go to allocation queue</CommandItem>
            <CommandItem onSelect={() => { navigate({ to: "/approvals" }); close(); }}>Open approvals</CommandItem>
            {reportsVisible && (
              <CommandItem onSelect={() => { navigate({ to: "/reports/new" }); close(); }}>
                <Plus className="h-3.5 w-3.5 mr-2" /> New report
              </CommandItem>
            )}
            {misVisible && (
              <CommandItem onSelect={() => { navigate({ to: "/mis" }); close(); }}>
                <LayoutDashboard className="h-3.5 w-3.5 mr-2" /> New MIS board
              </CommandItem>
            )}
          </CommandGroup>
        )}
        {detectedScope === "all" && (
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { navigate({ to: "/today" }); close(); }}>Go to My Work <kbd className="ml-auto text-[10px] text-muted-foreground">G W</kbd></CommandItem>
            <CommandItem onSelect={() => { navigate({ to: "/mails" }); close(); }}>Go to Inbox <kbd className="ml-auto text-[10px] text-muted-foreground">G I</kbd></CommandItem>
            <CommandItem onSelect={() => { navigate({ to: "/reports" }); close(); }}>Go to Reports <kbd className="ml-auto text-[10px] text-muted-foreground">G R</kbd></CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}