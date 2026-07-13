import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Mail, User as UserIcon, Sparkles, ChevronDown, CheckSquare, Square, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MatterPeekDrawer } from "@/components/shell/MatterPeekDrawer";
import { useMatters, useClients, useUsers, useTasks, useHearings } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { cx, timeAgo } from "@/lib/format";
import type { Matter, MatterCategory, Branch, User } from "@/types";

const CATEGORIES: (MatterCategory | "All")[] = ["All", "Tax - Indirect", "Tax - Direct", "International Trade", "Corporate"];
const BRANCHES: (Branch | "All")[] = ["All", "New Delhi", "Mumbai", "Nagpur", "Bengaluru"];

function daysAgoNum(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function AllocationQueue() {
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const { data: hearings } = useHearings();
  const { allocations, allocateMatter, unallocateMatter, currentUserId } = useAppStore();

  const [category, setCategory] = useState<MatterCategory | "All">("All");
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const [peekId, setPeekId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState<string>("");

  const unallocated = useMemo(() => {
    return matters
      .filter((m) => m.allocationState === "Unallocated" && !allocations[m.id])
      .filter((m) => (category === "All" || m.category === category) && (branch === "All" || m.branch === branch))
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return sort === "oldest" ? ta - tb : tb - ta;
      });
  }, [matters, allocations, category, branch, sort]);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";

  const assignableUsers = useMemo(
    () => users.filter((u) => u.roles.some((r) => r === "Case Manager" || r === "Associate" || r === "Case Partner") && u.id !== currentUserId),
    [users, currentUserId],
  );

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const doAssign = (matterIds: string[], assigneeId: string, note?: string) => {
    const assignee = users.find((u) => u.id === assigneeId);
    if (!assignee) return;
    matterIds.forEach((id) => allocateMatter(id, assigneeId, note));
    setSelected((s) => s.filter((id) => !matterIds.includes(id)));
    toast.success(`${matterIds.length} matter${matterIds.length === 1 ? "" : "s"} assigned to ${assignee.fullName}`, {
      description: 'Notification sent, task "Review new matter" created.',
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => matterIds.forEach((id) => unallocateMatter(id)),
      },
    });
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Awaiting allocation</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{unallocated.length} matter{unallocated.length === 1 ? "" : "s"} in the queue. Cards age from amber (&gt;3d) to red (&gt;7d).</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as MatterCategory | "All")}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "All" ? "All practices" : c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={branch} onValueChange={(v) => setBranch(v as Branch | "All")}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b === "All" ? "All branches" : b}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as "oldest" | "newest")}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="newest">Newest first</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="sticky top-14 z-10 flex items-center justify-between border rounded-md bg-accent/10 border-accent/40 px-3 py-2 text-sm">
          <div>{selected.length} selected</div>
          <div className="flex items-center gap-2">
            <Popover open={bulkOpen} onOpenChange={setBulkOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" className="h-7 text-xs">Bulk assign <ChevronDown className="h-3 w-3 ml-1" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-2">
                <div className="text-xs font-medium">Assign {selected.length} matters to</div>
                <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose person" /></SelectTrigger>
                  <SelectContent>{assignableUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" className="w-full h-7 text-xs" disabled={!bulkAssignee} onClick={() => { doAssign(selected, bulkAssignee); setBulkOpen(false); setBulkAssignee(""); }}>Assign</Button>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected([])}>Clear</Button>
          </div>
        </div>
      )}

      {unallocated.length === 0 ? (
        <div className="border rounded-lg bg-background py-16 text-center">
          <div className="text-sm text-muted-foreground">No matters waiting. New intakes appear here automatically.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {unallocated.map((m) => (
            <AllocationCard
              key={m.id}
              matter={m}
              clientName={clientName(m.clientId)}
              allMatters={matters}
              users={assignableUsers}
              allUsers={users}
              hearings={hearings}
              tasks={[]}
              selected={selected.includes(m.id)}
              onToggleSelect={() => toggleSelect(m.id)}
              onPeek={() => setPeekId(m.id)}
              onAssign={(assigneeId, note) => doAssign([m.id], assigneeId, note)}
            />
          ))}
        </div>
      )}

      <MatterPeekDrawer matterId={peekId} onClose={() => setPeekId(null)} />
    </div>
  );
}

function AllocationCard({
  matter, clientName, allMatters, users, allUsers, hearings, selected, onToggleSelect, onPeek, onAssign,
}: {
  matter: Matter;
  clientName: string;
  allMatters: Matter[];
  users: User[];
  allUsers: User[];
  hearings: { matterId: string; date: string }[];
  tasks: unknown[];
  selected: boolean;
  onToggleSelect: () => void;
  onPeek: () => void;
  onAssign: (assigneeId: string, note?: string) => void;
}) {
  const age = daysAgoNum(matter.createdAt);
  const borderTone = age > 7 ? "border-l-danger" : age > 3 ? "border-l-warning" : "border-l-border";
  const [popOpen, setPopOpen] = useState(false);

  // Similarity hint: same client + same deliverable, older matter.
  const similar = allMatters.find((x) => x.id !== matter.id && x.clientId === matter.clientId && x.deliverable === matter.deliverable);

  return (
    <article className={cx("border border-l-4 rounded-lg bg-background p-4 flex items-start gap-3 transition-colors", borderTone, selected && "ring-1 ring-accent/40 bg-accent/[0.03]")}> 
      <button aria-label="Select" onClick={onToggleSelect} className="mt-0.5 text-muted-foreground hover:text-foreground">
        {selected ? <CheckSquare className="h-4 w-4 text-accent" /> : <Square className="h-4 w-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/matter/$id" params={{ id: matter.id }} className="text-accent hover:underline font-mono text-sm">#{matter.matterId}</Link>
              <span className="text-sm font-medium truncate">{matter.title}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{clientName}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onPeek}>
              Open <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            <Popover open={popOpen} onOpenChange={setPopOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" className="h-7 text-xs">Allocate <ChevronDown className="h-3 w-3 ml-1" /></Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-2" align="end">
                <AllocatePopover matter={matter} users={users} allUsers={allUsers} hearings={hearings} similar={similar} onAssign={(id, note) => { setPopOpen(false); onAssign(id, note); }} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] h-5">{matter.category}</Badge>
          <Badge variant="outline" className="text-[10px] h-5">{matter.subCategory}</Badge>
          <Badge variant="outline" className="text-[10px] h-5 bg-accent/10 border-accent/30 text-accent">{matter.deliverable}</Badge>
          <span className="text-[10px] text-muted-foreground">· {matter.branch}</span>
        </div>

        <div className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Mail className="h-3 w-3" /> created {timeAgo(matter.createdAt)} via {matter.createdVia === "mail" ? "mail by Docketing" : "manual entry"}
          <span className="mx-1">·</span>
          <Clock className={cx("h-3 w-3", age > 7 ? "text-danger" : age > 3 ? "text-warning" : "")} /> aging {age}d
        </div>

        <p className="mt-2 text-[13px] text-foreground/80 line-clamp-2">{matter.issueInBrief}</p>
      </div>
    </article>
  );
}

function AllocatePopover({
  matter, users, allUsers, hearings, similar, onAssign,
}: {
  matter: Matter;
  users: User[];
  allUsers: User[];
  hearings: { matterId: string; date: string }[];
  similar?: Matter;
  onAssign: (assigneeId: string, note?: string) => void;
}) {
  const [chosen, setChosen] = useState<string>("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => u.fullName.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="px-1 pt-1">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a team member" className="h-7 text-xs" />
      </div>
      <div className="max-h-64 overflow-y-auto divide-y">
        {filtered.map((u) => {
          const weekHearings = hearings.filter((h) => {
            const dd = (new Date(h.date).getTime() - Date.now()) / 86400000;
            return dd >= 0 && dd <= 7;
          }).length; // per-user hearings would need matter join; keep coarse for prototype
          const isChosen = chosen === u.id;
          return (
            <button
              key={u.id}
              onClick={() => setChosen(u.id)}
              className={cx("w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50", isChosen && "bg-accent/10")}
            >
              <div className="relative h-8 w-8 shrink-0 grid place-items-center">
                <svg viewBox="0 0 32 32" className="absolute inset-0">
                  <circle cx="16" cy="16" r="14" fill="none" stroke="hsl(var(--muted))" strokeWidth="2" />
                  <circle cx="16" cy="16" r="14" fill="none" stroke={u.capacityPct >= 95 ? "hsl(var(--danger))" : u.capacityPct >= 85 ? "hsl(var(--warning))" : "hsl(var(--accent))"} strokeWidth="2" strokeDasharray={`${(u.capacityPct / 100) * 88} 88`} strokeDashoffset="0" transform="rotate(-90 16 16)" />
                </svg>
                <span className="text-[10px] font-medium">{u.avatarInitials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{u.fullName}</div>
                <div className="text-[10px] text-muted-foreground">{u.capacityPct}% · {weekHearings} hearings this wk · {u.branch}</div>
                {similar && u.id === similar.caseAssociateIds[0] && (
                  <div className="text-[10px] text-accent inline-flex items-center gap-1 mt-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> handled #{similar.matterId} (same client, {similar.deliverable})
                  </div>
                )}
              </div>
              {isChosen && <UserIcon className="h-3 w-3 text-accent shrink-0" />}
            </button>
          );
        })}
        {filtered.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">No matches</div>}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note to assignee (optional)" className="text-xs" />
      <Button size="sm" className="w-full h-7 text-xs" disabled={!chosen} onClick={() => onAssign(chosen, note.trim() || undefined)}>Assign</Button>
    </div>
  );
}