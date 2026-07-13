import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { format, addDays, isSameDay, startOfWeek } from "date-fns";
import {
  AlertTriangle,
  Calendar as CalIcon,
  Check,
  Clock,
  FileText,
  Gavel,
  Mail,
  MoreHorizontal,
  Plus,
  Timer,
  User as UserIcon,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/app-store";
import { useTasks, useHearings, useMails, useMatters, useUsers, useNonBillableResolved } from "@/hooks/use-data";
import { QuickTimeDialog } from "@/components/matter-detail/QuickTimeDialog";
import { cx } from "@/lib/format";
import { can } from "@/rbac/matrix";

type Source = "hearing" | "mail" | "assigned" | "system" | "mine";
type Row = {
  id: string;
  subject: string;
  matterId?: string;
  source: Source;
  priority: "High" | "Normal";
  dueDate: string;
  autoOrigin?: string; // human tag for telemetry
};

const sourceGlyph: Record<Source, ReactNode> = {
  hearing: <Gavel className="h-3.5 w-3.5 text-warning" />,
  mail: <Mail className="h-3.5 w-3.5 text-accent" />,
  assigned: <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />,
  system: <AlertTriangle className="h-3.5 w-3.5 text-warning" />,
  mine: <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
};

function parseQuickAdd(input: string, users: { id: string; fullName: string }[]) {
  // Returns chips: subject, matterId?, assigneeId?, dueDate
  const original = input.trim();
  let text = original;
  const chips: { kind: "subject" | "matter" | "assignee" | "due"; label: string; value: string }[] = [];

  const matterMatch = text.match(/\b(\d{7})\b/);
  if (matterMatch) {
    chips.push({ kind: "matter", label: matterMatch[1], value: `m-${matterMatch[1]}` });
    text = text.replace(matterMatch[0], "").trim();
  }

  const assigneeMatch = text.match(/@(\w+)/);
  if (assigneeMatch) {
    const needle = assigneeMatch[1].toLowerCase();
    const u = users.find((x) => x.fullName.toLowerCase().split(" ").some((p) => p.startsWith(needle)));
    if (u) chips.push({ kind: "assignee", label: u.fullName, value: u.id });
    else chips.push({ kind: "assignee", label: assigneeMatch[1], value: assigneeMatch[0] });
    text = text.replace(assigneeMatch[0], "").trim();
  }

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayMatch = text.match(/\b(mon|tue|tues|wed|thu|thurs|fri|sat|sun|today|tomorrow)\b/i);
  if (dayMatch) {
    const raw = dayMatch[1].toLowerCase().slice(0, 3);
    const now = new Date();
    let target = new Date(now);
    if (raw === "tod") target = now;
    else if (raw === "tom") target = addDays(now, 1);
    else {
      const idx = dayNames.indexOf(raw);
      if (idx >= 0) {
        const diff = (idx - now.getDay() + 7) % 7 || 7;
        target = addDays(now, diff);
      }
    }
    chips.push({ kind: "due", label: format(target, "EEE d MMM"), value: target.toISOString() });
    text = text.replace(dayMatch[0], "").trim();
  } else {
    chips.unshift({ kind: "due", label: "Today", value: new Date().toISOString() });
  }

  const subject = text.replace(/\s+/g, " ").trim() || original;
  chips.unshift({ kind: "subject", label: subject, value: subject });
  return chips;
}

export function MyWork() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const {
    todayManualTasks,
    todayCompletedIds,
    todayDismissedIds,
    todayReschedules,
    addTodayTask,
    completeTodayRow,
    uncompleteTodayRow,
    dismissTodayRow,
    undoDismissTodayRow,
    rescheduleTodayRow,
    delegateTodayRow,
    openQuickTimeWith,
  } = useAppStore();
  const [quickTimeMatterId, setQuickTimeMatterId] = useState<string | null>(null);
  const tuesdayIso = () => {
    const d = new Date();
    const day = d.getDay(); // 0..6 Sun..Sat
    const diff = 2 - day; // 2 = Tue
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };
  const { data: tasks } = useTasks();
  const { data: hearings } = useHearings();
  const { data: mails } = useMails();
  const { data: matters } = useMatters();
  const { data: users } = useUsers();

  const me = users.find((u) => u.id === currentUserId);
  const isPartner = me?.roles.includes("Case Partner") ?? false;
  const showTeam = !!me && can(me, "view", "cockpit", undefined);

  const [tab, setTab] = useState<"today" | "week" | "matter">("today");
  const [quickAdd, setQuickAdd] = useState("");
  const [showAll, setShowAll] = useState(false);

  const teamMatterIds = useMemo(() => {
    return new Set(
      matters
        .filter(
          (m) =>
            m.casePartnerId === currentUserId ||
            m.caseManagerId === currentUserId ||
            m.caseAssociateIds.includes(currentUserId) ||
            m.paralegalIds.includes(currentUserId),
        )
        .map((m) => m.id),
    );
  }, [matters, currentUserId]);

  // Compose auto rows for the current user
  const autoRows = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    // Hearing-prep tasks: hearings in next 5 days on user's matters
    const now = Date.now();
    for (const h of hearings) {
      const t = new Date(h.date).getTime();
      if (t < now - 3 * 60 * 60 * 1000) continue;
      if (t > now + 5 * 24 * 60 * 60 * 1000) continue;
      if (!teamMatterIds.has(h.matterId)) continue;
      rows.push({
        id: `auto-h-${h.id}`,
        subject: `Prep for hearing at ${h.forum}${h.causeListItemNo ? ` · item ${h.causeListItemNo}` : ""}`,
        matterId: h.matterId,
        source: "hearing",
        priority: h.readiness === "Prep pending" ? "High" : "Normal",
        dueDate: h.date,
        autoOrigin: "hearing",
      });
    }
    // Assigned tasks: tasks where assigneeId=me and open
    for (const t of tasks) {
      if (t.assigneeId !== currentUserId) continue;
      if (t.status === "Completed") continue;
      rows.push({
        id: `auto-t-${t.id}`,
        subject: t.subject,
        matterId: t.matterId ?? undefined,
        source: t.source === "partial-details" ? "system" : "assigned",
        priority: t.priority,
        dueDate: t.dueDate,
        autoOrigin: t.source,
      });
    }
    // Mail-derived: filed inbox mails on user's matters (last 24h)
    for (const m of mails.slice(0, 30)) {
      if (m.state !== "Tagged" || !m.matterId) continue;
      if (!teamMatterIds.has(m.matterId)) continue;
      rows.push({
        id: `auto-m-${m.id}`,
        subject: `Reply to filed client mail — ${m.subject.slice(0, 60)}`,
        matterId: m.matterId,
        source: "mail",
        priority: "Normal",
        dueDate: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        autoOrigin: "mail",
      });
    }
    // Partial-details chases: matters with partial-details tag where user on team
    for (const m of matters) {
      if (!teamMatterIds.has(m.id)) continue;
      if (!m.tags.includes("partial-details")) continue;
      rows.push({
        id: `auto-pd-${m.id}`,
        subject: `Complete matter details — 3 fields missing`,
        matterId: m.id,
        source: "system",
        priority: "Normal",
        dueDate: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
        autoOrigin: "partial-details",
      });
    }
    // Timesheet gap (always one)
    rows.push({
      id: "auto-ts-gap",
      subject: "Fill Tuesday timesheet — 2.1h missing",
      source: "system",
      priority: "High",
      dueDate: new Date().toISOString(),
      autoOrigin: "timesheet-gap",
    });
    return rows;
  }, [tasks, hearings, mails, matters, teamMatterIds, currentUserId]);

  const manualRows = useMemo<Row[]>(
    () =>
      todayManualTasks
        .filter((t) => t.assigneeId === currentUserId)
        .map((t) => ({
          id: t.id,
          subject: t.subject,
          matterId: t.matterId,
          source: "mine" as const,
          priority: t.priority,
          dueDate: t.dueDate,
        })),
    [todayManualTasks, currentUserId],
  );

  const allRows = useMemo(() => {
    return [...autoRows, ...manualRows]
      .filter((r) => !todayDismissedIds.includes(r.id))
      .map((r) => ({ ...r, dueDate: todayReschedules[r.id] ?? r.dueDate }));
  }, [autoRows, manualRows, todayDismissedIds, todayReschedules]);

  const isDueToday = (r: Row) => isSameDay(new Date(r.dueDate), new Date());
  const todayRows = allRows.filter(isDueToday);
  const completedToday = todayCompletedIds.length;
  const openToday = todayRows.filter((r) => !todayCompletedIds.includes(r.id));

  const sortedOpen = useMemo(
    () =>
      [...openToday].sort((a, b) => {
        const p = (r: Row) => (r.priority === "High" ? 0 : 1);
        if (p(a) !== p(b)) return p(a) - p(b);
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }),
    [openToday],
  );

  const overload = sortedOpen.length > 15;
  const visibleOpen = overload && !showAll ? sortedOpen.slice(0, 7) : sortedOpen;
  const doneRows = allRows.filter((r) => todayCompletedIds.includes(r.id));

  // Waiting-on: tasks I delegated (from store) or tasks I assignedBy
  const waitingOn = useMemo(() => {
    const delegated = todayManualTasks.filter((t) => t.delegatedFromId === currentUserId);
    const assignedByMe = tasks.filter((t) => t.assignedById === currentUserId && t.assigneeId !== currentUserId && t.status === "Open").slice(0, 5);
    return { delegated, assignedByMe };
  }, [todayManualTasks, tasks, currentUserId]);

  const { data: nbAll } = useNonBillableResolved();
  const nbWaiting = useMemo(
    () => nbAll.filter((n) => n.userId === currentUserId && n.status === "Submitted"),
    [nbAll, currentUserId],
  );

  // Schedule strip: merged hearings + mock Outlook
  const scheduleItems = useMemo(() => {
    const items: { time: string; label: string; matterId?: string; source: "hearing" | "outlook"; sub?: string }[] = [];
    hearings.forEach((h) => {
      if (!isSameDay(new Date(h.date), new Date())) return;
      if (!teamMatterIds.has(h.matterId)) return;
      items.push({
        time: format(new Date(h.date), "HH:mm"),
        label: `Hearing ${h.forum}${h.causeListItemNo ? ` · item ${h.causeListItemNo}` : ""}`,
        matterId: h.matterId,
        source: "hearing",
        sub: h.readiness === "Prep pending" ? "prep pending" : "ready",
      });
    });
    // Mock Outlook rows
    items.push({ time: "15:00", label: "Client call — TrueNorth", matterId: "m-1096260", source: "outlook", sub: "45 min" });
    items.push({ time: "17:00", label: "Internal: weekly practice review", source: "outlook", sub: "30 min" });
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [hearings, teamMatterIds]);

  const onCheck = (r: Row) => {
    completeTodayRow(r.id);
    toast.success("Done", {
      description: r.subject,
      action: { label: "Undo", onClick: () => uncompleteTodayRow(r.id) },
      duration: 6000,
    });
  };

  const onDismiss = (r: Row) => {
    dismissTodayRow(r.id);
    if (typeof window !== "undefined") {
      (window as unknown as { lcmsFeedQuality?: unknown[] }).lcmsFeedQuality ??= [];
      ((window as unknown as { lcmsFeedQuality: { id: string; origin: string; at: string }[] }).lcmsFeedQuality).push({
        id: r.id,
        origin: r.autoOrigin ?? "unknown",
        at: new Date().toISOString(),
      });
    }
    toast("Not my action", {
      description: "Logged to feed-quality telemetry",
      action: { label: "Undo", onClick: () => undoDismissTodayRow(r.id) },
      duration: 6000,
    });
  };

  const onDelegate = (r: Row, toId: string) => {
    const u = users.find((x) => x.id === toId);
    delegateTodayRow(r.id, r.subject, r.matterId, toId, currentUserId, r.dueDate, r.priority);
    toast.success(`Delegated to ${u?.fullName ?? toId}`, {
      description: r.subject,
      action: { label: "Undo", onClick: () => undoDismissTodayRow(r.id) },
      duration: 6000,
    });
  };

  const parsedChips = useMemo(() => (quickAdd.trim() ? parseQuickAdd(quickAdd, users) : []), [quickAdd, users]);
  const commitQuickAdd = () => {
    if (!quickAdd.trim()) return;
    const chips = parsedChips;
    const subject = chips.find((c) => c.kind === "subject")?.value ?? quickAdd.trim();
    const matterId = chips.find((c) => c.kind === "matter")?.value;
    const assigneeId = chips.find((c) => c.kind === "assignee")?.value ?? currentUserId;
    const due = chips.find((c) => c.kind === "due")?.value ?? new Date().toISOString();
    addTodayTask({
      id: `qa-${Date.now().toString(36)}`,
      subject,
      matterId,
      assigneeId: assigneeId.startsWith("u-") ? assigneeId : currentUserId,
      dueDate: due,
      priority: "Normal",
    });
    setQuickAdd("");
    toast.success("Added");
  };

  const renderRow = (r: Row) => {
    const matter = r.matterId ? matters.find((m) => m.id === r.matterId) : undefined;
    const done = todayCompletedIds.includes(r.id);
    return (
      <div
        key={r.id}
        className={cx(
          "group border rounded-md px-3 py-2 flex items-center gap-3 bg-card transition-all duration-150",
          done && "opacity-40 scale-[0.99]",
          r.priority === "High" && !done && "border-l-4 border-l-warning",
        )}
      >
        <button
          onClick={() => onCheck(r)}
          className={cx(
            "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-transform",
            done ? "bg-success border-success text-white scale-110" : "border-border hover:border-accent",
          )}
          aria-label="Complete"
        >
          {done && <Check className="h-3 w-3" />}
        </button>
        {sourceGlyph[r.source]}
        <div className="min-w-0 flex-1">
          <div className={cx("text-[13px] leading-tight", done && "line-through")}>{r.subject}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {matter && (
              <Link
                to="/matter/$id"
                params={{ id: matter.id }}
                className="font-mono tabular-nums hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                #{matter.matterId}
              </Link>
            )}
            <span>due {format(new Date(r.dueDate), "d MMM HH:mm")}</span>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
          {r.matterId && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Start timer"
              onClick={() => setQuickTimeMatterId(r.matterId ?? null)}
            >
              <Timer className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Delegate to</DropdownMenuLabel>
              {users.filter((u) => u.id !== currentUserId).slice(0, 6).map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => onDelegate(r, u.id)}>
                  {u.fullName} <span className="ml-auto text-[10px] text-muted-foreground">{u.branch}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => rescheduleTodayRow(r.id, addDays(new Date(r.dueDate), 1).toISOString())}
              >
                Reschedule +1 day
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => rescheduleTodayRow(r.id, addDays(new Date(r.dueDate), 7).toISOString())}
              >
                Reschedule +1 week
              </DropdownMenuItem>
              {r.source !== "mine" && (
                <DropdownMenuItem onClick={() => onDismiss(r)}>Not my action</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const openRowsRaw = allRows.filter((r) => !todayCompletedIds.includes(r.id));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] font-normal">Today — {format(new Date(), "EEE d LLL")}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            The day, building itself. Add anything else with ⌘/.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuickTimeMatterId(null)}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs hover:bg-muted"
            title="Time meter — click for quick entry"
          >
            <div className="relative h-6 w-6">
              <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
                <circle cx="12" cy="12" r="9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle cx="12" cy="12" r="9" fill="none" stroke="hsl(var(--accent))" strokeWidth="3" strokeDasharray={`${(2.5 / 8) * 56.5} 56.5`} strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-mono tabular-nums">2.5 / 8h</span>
          </button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="matter">By matter</TabsTrigger>
          {showTeam && (
            <TabsTrigger value="team" onClick={() => setTab("today")}>
              <Users className="h-3.5 w-3.5 mr-1" /> Team
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-4">
          {/* Schedule strip */}
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Schedule</div>
            {scheduleItems.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nothing on the calendar today.</div>
            ) : (
              <div className="space-y-1.5">
                {scheduleItems.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px]">
                    <span className="font-mono tabular-nums text-muted-foreground w-12">{it.time}</span>
                    {it.source === "hearing" ? <Gavel className="h-3.5 w-3.5 text-warning" /> : <CalIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span>{it.label}</span>
                    {it.matterId && (
                      <Link to="/matter/$id" params={{ id: it.matterId }} className="font-mono tabular-nums text-muted-foreground hover:text-foreground">
                        #{it.matterId.replace("m-", "")}
                      </Link>
                    )}
                    {it.source === "outlook" && (
                      <Badge variant="outline" className="h-4 text-[10px]">Outlook</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">{it.sub}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick add */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <Input
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitQuickAdd(); }}
                placeholder='Add a task — e.g. "reply to SCN draft 1096251 @Neha fri"'
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={commitQuickAdd} disabled={!quickAdd.trim()}>Add</Button>
            </div>
            {parsedChips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pl-6">
                <Wand2 className="h-3 w-3 text-accent" />
                {parsedChips.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-[11px]">
                    {c.kind === "matter" ? "#" : c.kind === "assignee" ? "@" : ""}{c.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Time strip */}
          <div className="rounded-lg border p-3 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <span>Tue</span>
              <span className="font-mono tabular-nums">2.1h</span>
              <Badge variant="outline" className="h-5 text-[10px] border-warning/40 text-warning">gap</Badge>
              <Link to="/timesheet" search={{ day: tuesdayIso() }}><Button size="sm" variant="ghost" className="h-6 text-xs">Fill Tuesday</Button></Link>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span>Today</span>
              <span className="font-mono tabular-nums">2.5h</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => openQuickTimeWith({})}>
                <Plus className="h-3 w-3 mr-1" /> entry
              </Button>
            </div>
          </div>

          {/* Do list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Do ({openToday.length})
              </div>
              {overload && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show top 7" : `Show all (${sortedOpen.length})`}
                </Button>
              )}
            </div>
            {sortedOpen.length === 0 ? (
              <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                Nothing due today. Add with ⌘/ or wait for hearings and mails to land.
              </div>
            ) : (
              <div className="space-y-1.5">{visibleOpen.map(renderRow)}</div>
            )}
          </div>

          {/* Waiting-on */}
          <div className="rounded-lg border">
            <div className="px-3 py-2 border-b text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Waiting on ({waitingOn.delegated.length + waitingOn.assignedByMe.length + nbWaiting.length})
            </div>
            {waitingOn.delegated.length + waitingOn.assignedByMe.length + nbWaiting.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">Nothing delegated.</div>
            ) : (
              <div className="divide-y">
                {waitingOn.delegated.map((t) => {
                  const u = users.find((x) => x.id === t.assigneeId);
                  return (
                    <div key={t.id} className="px-3 py-2 text-sm flex items-center gap-3">
                      <div className="min-w-0 flex-1 truncate">{t.subject}</div>
                      <span className="text-xs text-muted-foreground">{u?.fullName ?? t.assigneeId}</span>
                      <Badge variant="outline" className="h-5 text-[10px]">Open</Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast(`Nudged ${u?.fullName ?? "assignee"}`)}>Nudge</Button>
                    </div>
                  );
                })}
                {waitingOn.assignedByMe.map((t) => {
                  const u = users.find((x) => x.id === t.assigneeId);
                  return (
                    <div key={t.id} className="px-3 py-2 text-sm flex items-center gap-3">
                      <div className="min-w-0 flex-1 truncate">{t.subject}</div>
                      <span className="text-xs text-muted-foreground">{u?.fullName ?? t.assigneeId}</span>
                      <Badge variant="outline" className="h-5 text-[10px]">Open</Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast(`Nudged ${u?.fullName ?? "assignee"}`)}>Nudge</Button>
                    </div>
                  );
                })}
                {nbWaiting.map((n) => {
                  const approver = users.find((x) => x.id === n.approverId);
                  return (
                    <div key={n.id} className="px-3 py-2 text-sm flex items-center gap-3">
                      <div className="min-w-0 flex-1 truncate">
                        <span className="text-muted-foreground text-[11px] mr-1">{n.kind}:</span>{n.title}
                      </div>
                      <span className="text-xs text-muted-foreground">{approver?.fullName ?? "approver"}</span>
                      <Badge variant="outline" className="h-5 text-[10px]">Non-billable</Badge>
                      <Link to="/nonbillable" className="text-xs text-accent hover:underline">Open</Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Done today log */}
          {doneRows.length > 0 && (
            <details className="rounded-lg border">
              <summary className="cursor-pointer px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground list-none">
                ✓ Done today ({completedToday})
              </summary>
              <div className="px-3 py-2 space-y-1">
                {doneRows.map((r) => (
                  <div key={r.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                    <Check className="h-3 w-3 text-success" />
                    <span className="line-through">{r.subject}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] ml-auto" onClick={() => uncompleteTodayRow(r.id)}>Undo</Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <div className="grid grid-cols-5 gap-3">
            {weekDays.map((d) => {
              const dayRows = openRowsRaw.filter((r) => isSameDay(new Date(r.dueDate), d));
              return (
                <div key={d.toISOString()} className="rounded-lg border min-h-40">
                  <div className="px-3 py-2 border-b text-xs font-semibold">{format(d, "EEE d")}</div>
                  <div className="p-2 space-y-1.5">
                    {dayRows.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground">—</div>
                    ) : (
                      dayRows.map((r) => (
                        <div key={r.id} className="text-[12px] rounded border px-2 py-1 bg-card flex items-center gap-1.5">
                          {sourceGlyph[r.source]}
                          <span className="truncate flex-1">{r.subject}</span>
                          <button
                            title="Move +1 day"
                            onClick={() => rescheduleTodayRow(r.id, addDays(new Date(r.dueDate), 1).toISOString())}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            →
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Use → to push a row to the next day.</p>
        </TabsContent>

        <TabsContent value="matter" className="mt-4 space-y-3">
          {Object.entries(
            openRowsRaw.reduce<Record<string, Row[]>>((acc, r) => {
              const k = r.matterId ?? "no-matter";
              (acc[k] ??= []).push(r);
              return acc;
            }, {}),
          ).map(([k, rows]) => {
            const matter = matters.find((m) => m.id === k);
            return (
              <div key={k} className="rounded-lg border">
                <div className="px-3 py-2 border-b text-sm flex items-center gap-2">
                  {matter ? (
                    <>
                      <Link to="/matter/$id" params={{ id: matter.id }} className="font-mono tabular-nums text-accent">#{matter.matterId}</Link>
                      <span className="text-muted-foreground truncate">{matter.title}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No matter</span>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">{rows.length}</span>
                </div>
                <div className="p-2 space-y-1.5">{rows.map(renderRow)}</div>
              </div>
            );
          })}
        </TabsContent>

        {showTeam && (
          <TabsContent value="team" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Aggregated per person across your team. Read-only.</p>
            {users
              .filter((u) => u.roles.includes("Associate") || u.roles.includes("Case Manager") || u.roles.includes("Paralegal"))
              .slice(0, 6)
              .map((u) => {
                const rows = tasks.filter((t) => t.assigneeId === u.id && t.status === "Open").slice(0, 4);
                return (
                  <div key={u.id} className="rounded-lg border">
                    <div className="px-3 py-2 border-b text-sm flex items-center gap-2">
                      <span className="font-medium">{u.fullName}</span>
                      <span className="text-[11px] text-muted-foreground">{u.branch}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} open</span>
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => toast("Reassign modal (mock)")}>Reassign</Button>
                    </div>
                    <div className="p-2 space-y-1">
                      {rows.map((t) => (
                        <div key={t.id} className="text-xs flex items-center gap-2 px-1 py-0.5">
                          {t.priority === "High" && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
                          <span className="flex-1 truncate">{t.subject}</span>
                          {t.matterId && <span className="font-mono tabular-nums text-muted-foreground">#{t.matterId.replace("m-", "")}</span>}
                        </div>
                      ))}
                      {rows.length === 0 && <div className="text-[11px] text-muted-foreground px-1">Clear.</div>}
                    </div>
                  </div>
                );
              })}
          </TabsContent>
        )}
      </Tabs>

      {quickTimeMatterId && (() => {
        const m = matters.find((x) => x.id === quickTimeMatterId);
        if (!m) return null;
        return (
          <QuickTimeDialog
            matter={m}
            open={true}
            onClose={() => setQuickTimeMatterId(null)}
            onSave={() => { setQuickTimeMatterId(null); toast.success("Time logged"); }}
          />
        );
      })()}

      {/* Suppress unused warning for currentRole/isPartner symmetry */}
      <span className="hidden">{currentRole}{isPartner ? "" : ""}</span>
    </div>
  );
}
