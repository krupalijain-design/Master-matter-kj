import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronRight, Copy, Pin, PinOff, RadioTower, AlertCircle, RefreshCw, Lock, Plus,
  Clock, Upload, Mail as MailIcon, MoreHorizontal, Pencil, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMatters, useClients, useUsers, useRtbs, useHearings, useTasks, useMails, useTimeEntries } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { cx } from "@/lib/format";
import type { Matter, RTB, Hearing, Task, TimeEntry, MailItem, ClientContact, Office } from "@/types";
import { Chip, CategoryChip } from "@/components/ui/chip";
import { OverviewTab } from "./tabs/OverviewTab";
import { TasksTab } from "./tabs/TasksTab";
import { DocumentsTab, type MatterDoc } from "./tabs/DocumentsTab";
import { MailsTab } from "./tabs/MailsTab";
import { HearingsTab } from "./tabs/HearingsTab";
import { TimeBillingTab } from "./tabs/TimeBillingTab";
import { PeopleTab } from "./tabs/PeopleTab";
import { HistoryTab, type HistoryItem } from "./tabs/HistoryTab";
import { QuickTimeDialog } from "./QuickTimeDialog";

export type MatterTabKey = "overview" | "tasks" | "documents" | "mails" | "hearings" | "time-billing" | "people" | "history";

const TAB_ORDER: { key: MatterTabKey; label: string; hotkey: string }[] = [
  { key: "overview", label: "Overview", hotkey: "1" },
  { key: "tasks", label: "Tasks", hotkey: "2" },
  { key: "documents", label: "Documents", hotkey: "3" },
  { key: "mails", label: "Mails", hotkey: "4" },
  { key: "hearings", label: "Hearings", hotkey: "5" },
  { key: "time-billing", label: "Time & Billing", hotkey: "6" },
  { key: "people", label: "People", hotkey: "7" },
  { key: "history", label: "History", hotkey: "8" },
];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function MatterDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: MatterTabKey; billFilter?: string };
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const { data: rtbsSeed } = useRtbs();
  const { data: hearingsSeed } = useHearings();
  const { data: tasksSeed } = useTasks();
  const { data: mails } = useMails();
  const { data: timeEntries } = useTimeEntries();
  const { currentRole, pinnedMatterIds, pinMatter, unpinMatter, openQuickTime, quickTimeMatterId } = useAppStore();

  const baseMatter = matters.find((m) => m.id === id);
  const [matter, setMatter] = useState<Matter | null>(baseMatter ?? null);
  useEffect(() => { setMatter(baseMatter ?? null); }, [baseMatter?.id]);

  // Locally scoped mutable state (per-session) for created/updated records
  const [tasks, setTasks] = useState<Task[]>(() => tasksSeed.filter((t) => t.matterId === id));
  const [hearings, setHearings] = useState<Hearing[]>(() => hearingsSeed.filter((h) => h.matterId === id));
  const [rtbs, setRtbs] = useState<RTB[]>(() => rtbsSeed.filter((r) => r.matterId === id));
  const [docs, setDocs] = useState<MatterDoc[]>(() => seedDocs(id));
  const [history, setHistory] = useState<HistoryItem[]>(() => seedHistory(baseMatter));

  const [tab, setTab] = useState<MatterTabKey>(search.tab ?? "overview");
  useEffect(() => { if (search.tab && search.tab !== tab) setTab(search.tab); /* eslint-disable-next-line */ }, [search.tab]);

  const pushHistory = useCallback((who: string, what: string, source: HistoryItem["source"] = "Manual") => {
    setHistory((h) => [{ id: `hi-${Date.now()}`, who, what, at: new Date().toISOString(), source }, ...h]);
  }, []);

  // Keyboard: 1–8 switch tabs (ignore when typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const found = TAB_ORDER.find((x) => x.hotkey === e.key);
      if (found) { setTab(found.key); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!matter) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Matter not found. <span className="font-mono text-[11px] ml-1">LCMS-4F2A</span></AlertDescription>
        </Alert>
      </div>
    );
  }

  const client = clients.find((c) => c.id === matter.clientId);
  const office = client?.offices.find((o) => o.id === matter.officeId) ?? client?.offices[0];
  const casePartner = users.find((u) => u.id === matter.casePartnerId);
  const caseManager = matter.caseManagerId ? users.find((u) => u.id === matter.caseManagerId) : null;
  const associates = matter.caseAssociateIds.map((uid) => users.find((u) => u.id === uid)).filter(Boolean);
  const paralegals = matter.paralegalIds.map((uid) => users.find((u) => u.id === uid)).filter(Boolean);

  const pinned = pinnedMatterIds.includes(id);
  const isPartner = currentRole === "Case Partner";
  const hidesMoney = currentRole === "Paralegal" || currentRole === "Court Staff";

  const draftOrPending = rtbs.find((r) => r.status === "Draft" || r.status === "Pending Approval");
  const canComplete = !draftOrPending;

  const counts = useMemo(() => ({
    tasks: tasks.filter((t) => t.status === "Open").length,
    documents: docs.length,
    mails: mails.filter((m) => m.matterId === id).length,
    hearings: hearings.length,
    "time-billing": rtbs.length,
    people: 1 + (caseManager ? 1 : 0) + associates.length + paralegals.length,
    history: history.length,
    overview: 0,
  } as Record<MatterTabKey, number>), [tasks, docs, mails, hearings, rtbs, caseManager, associates.length, paralegals.length, history, id]);

  const visibleTabs = TAB_ORDER.filter((t) => !(t.key === "time-billing" && hidesMoney));

  const setTitle = (title: string) => {
    setMatter((m) => (m ? { ...m, title } : m));
    pushHistory(currentUserName(users, useAppStore.getState().currentUserId), `Renamed matter to “${title}”`);
    toast.success("Title saved");
  };

  const updateField = (patch: Partial<Matter>) => {
    setMatter((m) => (m ? { ...m, ...patch } : m));
    const key = Object.keys(patch)[0];
    pushHistory(currentUserName(users, useAppStore.getState().currentUserId), `Updated ${key}`);
  };

  const clearPartialTag = () => {
    setMatter((m) => (m ? { ...m, tags: m.tags.filter((x) => x !== "partial-details") } : m));
    toast.success("Matter completed", { description: "partial-details tag removed." });
    pushHistory(currentUserName(users, useAppStore.getState().currentUserId), "Completed missing details");
  };

  const doAction = (action: "complete" | "abandon" | "permissions") => {
    if (action === "complete") {
      if (!canComplete) {
        toast.error("Cannot complete matter", { description: `RTB ${draftOrPending?.rtbNo} is ${draftOrPending?.status}. Resolve billing first.` });
        return;
      }
      setMatter((m) => (m ? { ...m, status: "Completed" } : m));
      pushHistory(currentUserName(users, useAppStore.getState().currentUserId), "Marked matter as Completed");
      toast.success("Matter marked Completed");
    } else if (action === "abandon") {
      setMatter((m) => (m ? { ...m, pipelineState: "Abandoned", status: "Completed" } : m));
      pushHistory(currentUserName(users, useAppStore.getState().currentUserId), "Abandoned matter");
      toast.success("Matter abandoned");
    } else {
      toast("Permissions", { description: "Access control panel is coming soon." });
    }
  };

  const gotoTab = (t: MatterTabKey, extra?: Record<string, string>) => {
    setTab(t);
    navigate({ to: "/matter/$id", params: { id }, search: { tab: t, ...extra } as any, replace: true });
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Sticky two-row header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="max-w-[1600px] mx-auto px-6 pt-3 pb-2">
          {/* Row 1: breadcrumb + actions */}
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Link to="/matter" className="hover:text-foreground">Matter</Link>
            <ChevronRight className="h-3 w-3" />
            <CategoryChip category={matter.category} />
            <ChevronRight className="h-3 w-3" />
            <span className="font-mono tabular-nums text-foreground">#{matter.matterId}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[12px]"
                onClick={() => (pinned ? unpinMatter(id) : pinMatter(id))}
              >
                {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                {pinned ? "Unpin" : "Pin"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]">
                    Action <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    disabled={!canComplete}
                    onClick={() => doAction("complete")}
                  >
                    Complete matter
                  </DropdownMenuItem>
                  {!canComplete && (
                    <div className="px-2 pb-2">
                      <Alert variant="destructive" className="p-2">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-[11px] ml-1">
                          RTB <span className="font-mono">{draftOrPending?.rtbNo}</span> is {draftOrPending?.status}. Resolve billing first.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => doAction("abandon")}>Abandon matter</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => doAction("permissions")}>Permissions…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: client › matter id › sync › tags */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {client && (
              <Link to="/client/$id" params={{ id: client.id }} className="text-[13px] font-medium hover:underline">
                {client.name}
              </Link>
            )}
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono tabular-nums text-[12px]">#{matter.matterId}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(String(matter.matterId));
                toast.success("Matter ID copied");
              }}
              aria-label="Copy Matter ID"
              className="h-6 w-6 grid place-items-center rounded hover:bg-muted text-muted-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            {matter.syncStatus === "Synced" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><Chip tone="success" icon={<RadioTower className="h-3 w-3" />}>Synced</Chip></span>
                </TooltipTrigger>
                <TooltipContent>Court/mail sync — last 22m ago</TooltipContent>
              </Tooltip>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><Chip tone="danger">Not Synced</Chip></span>
                  </TooltipTrigger>
                  <TooltipContent>Court/mail sync unavailable. Retry to reconnect.</TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => {
                    updateField({ syncStatus: "Synced" });
                    toast.success("Sync retried", { description: "Court/mail sync is up to date." });
                  }}
                >
                  <RefreshCw className="h-3 w-3" /> Retry sync
                </Button>
              </span>
            )}
            {matter.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>

          {/* Title (inline-editable for partner) */}
          <div className="mt-2">
            <EditableTitle title={matter.title} editable={isPartner} onSave={setTitle} />
            <div className="mt-1 text-[12px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{matter.category}</span><span>·</span>
              <span>{matter.subCategory}</span><span>·</span>
              <span>{matter.deliverable}</span><span>·</span>
              <span>{matter.branch}</span><span>·</span>
              <span>Opened {fmtDate(matter.createdAt)}</span>
            </div>
          </div>

          {/* Team strip + action row */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {casePartner && (
              <div className="flex items-center gap-2 text-[12px]">
                <div className="h-6 w-6 rounded-full bg-accent/15 text-accent grid place-items-center text-[10px] font-semibold">{casePartner.avatarInitials}</div>
                <div className="leading-tight">
                  <div className="text-[11px] text-muted-foreground">Case Partner</div>
                  <div>{casePartner.fullName}</div>
                </div>
              </div>
            )}
            {(caseManager || associates.length > 0 || paralegals.length > 0) && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[12px] hover:bg-muted">
                    Team +{[caseManager, ...associates, ...paralegals].filter(Boolean).length}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3 text-[13px] space-y-2">
                  {caseManager && <PersonRow label="Case Manager" name={caseManager.fullName} initials={caseManager.avatarInitials} />}
                  {associates.map((u) => u && <PersonRow key={u.id} label="Associate" name={u.fullName} initials={u.avatarInitials} />)}
                  {paralegals.map((u) => u && <PersonRow key={u.id} label="Paralegal" name={u.fullName} initials={u.avatarInitials} />)}
                </PopoverContent>
              </Popover>
            )}
            {matter.tags.includes("SOF-exists") && (
              isPartner ? (
                <a href="#sof" className="inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[12px] text-foreground hover:bg-muted">
                  <Lock className="h-3 w-3" /> SOF (restricted)
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[12px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> SOF exists — contact Dev Anand
                </span>
              )
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => (pinned ? unpinMatter(id) : pinMatter(id))}>
                <Pin className="h-3.5 w-3.5" /> {pinned ? "Pinned" : "Pin"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => gotoTab("tasks")}>
                <Plus className="h-3.5 w-3.5" /> Task
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => openQuickTime(id)}>
                <Clock className="h-3.5 w-3.5" /> Log time
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => gotoTab("documents")}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => gotoTab("mails")}>
                <MailIcon className="h-3.5 w-3.5" /> File mail
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex items-center gap-1 border-b -mb-px overflow-x-auto">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => gotoTab(t.key)}
                className={cx(
                  "h-9 px-3 text-[13px] border-b-2 whitespace-nowrap transition-colors inline-flex items-center gap-1.5",
                  tab === t.key ? "border-accent text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="text-[10px] text-muted-foreground border rounded px-1 h-4 grid place-items-center">{t.hotkey}</span>
                {t.label}
                {counts[t.key] > 0 && (
                  <span className={cx("text-[10px] font-mono tabular-nums px-1 rounded", tab === t.key ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-5">
        {tab === "overview" && (
          <OverviewTab
            matter={matter}
            hearings={hearings}
            tasks={tasks}
            rtbs={rtbs}
            timeEntries={timeEntries.filter((t) => t.matterId === id)}
            mails={mails.filter((m) => m.matterId === id)}
            docs={docs}
            history={history}
            onCompleteTask={(tid) => setTasks((cur) => cur.map((t) => t.id === tid ? { ...t, status: "Completed", completedAt: new Date().toISOString() } : t))}
            onUpdateField={updateField}
            onClearPartial={clearPartialTag}
            onOpenBilling={(f) => gotoTab("time-billing", { billFilter: f })}
          />
        )}
        {tab === "tasks" && (
          <TasksTab
            matterId={id}
            tasks={tasks}
            users={users}
            onAdd={(t) => { setTasks((cur) => [t, ...cur]); pushHistory("You", `Created task “${t.subject}”`); }}
            onToggle={(tid) => setTasks((cur) => cur.map((t) => t.id === tid ? {
              ...t,
              status: t.status === "Open" ? "Completed" : "Open",
              completedAt: t.status === "Open" ? new Date().toISOString() : undefined,
            } : t))}
          />
        )}
        {tab === "documents" && (
          <DocumentsTab
            docs={docs}
            onChange={setDocs}
            onHistory={(msg) => pushHistory("You", msg)}
          />
        )}
        {tab === "mails" && (
          <MailsTab
            matterId={id}
            mails={mails.filter((m) => m.matterId === id)}
            onFileAttachment={(mail, att) => {
              setDocs((cur) => [
                { id: `doc-${Date.now()}`, title: att.name, type: "Client Document", versions: [{ label: "v1", uploadedAt: new Date().toISOString(), isFinal: false }], headNote: att.aiSummary ?? "Auto-filed from mail." },
                ...cur,
              ]);
              pushHistory("You", `Filed “${att.name}” from mail`, "Manual");
              toast.success("Filed to Documents", { description: att.name });
            }}
          />
        )}
        {tab === "hearings" && (
          <HearingsTab
            matterId={id}
            hearings={hearings}
            users={users}
            onRecord={(h, prepTask) => {
              setHearings((cur) => [h, ...cur.filter((x) => x.id !== h.id)]);
              if (prepTask) setTasks((cur) => [prepTask, ...cur]);
              pushHistory("You", `Recorded hearing: ${h.result ?? "—"}`);
              toast.success("Hearing recorded", {
                description: prepTask ? "Prep task and notification created." : "No next date.",
              });
            }}
          />
        )}
        {tab === "time-billing" && !hidesMoney && (
          <TimeBillingTab
            matterId={id}
            timeEntries={timeEntries.filter((t) => t.matterId === id)}
            users={users}
            rtbs={rtbs}
            billFilter={search.billFilter}
            onCreateRTB={(rtb) => {
              setRtbs((cur) => [rtb, ...cur]);
              pushHistory("You", `Submitted RTB ${rtb.rtbNo} for approval`);
              toast.success("RTB submitted for approval", { description: `${rtb.rtbNo} · notification sent to partner.` });
            }}
          />
        )}
        {tab === "people" && (
          <PeopleTab matter={matter} client={client} office={office} users={users} />
        )}
        {tab === "history" && <HistoryTab items={history} />}
      </div>

      <QuickTimeDialog
        matter={matter}
        open={quickTimeMatterId === id}
        onClose={() => openQuickTime(null)}
        onSave={(entry) => {
          pushHistory("You", `Logged ${entry.hours}h ${entry.minutes}m`);
          toast.success("Time logged", { description: `${entry.hours}h ${entry.minutes}m · ${entry.activityType}` });
          openQuickTime(null);
        }}
      />
    </TooltipProvider>
  );
}

function EditableTitle({ title, editable, onSave }: { title: string; editable: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);
  if (!editing) {
    return (
      <div className="flex items-start gap-2 group">
        <h1 className="font-display text-[26px] font-normal tracking-tight leading-snug">{title}</h1>
        {editable && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded hover:bg-muted text-muted-foreground"
            aria-label="Edit title"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        className="font-display text-[26px] font-normal tracking-tight leading-snug bg-transparent border-b border-accent outline-none flex-1 min-w-0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft.trim() || title); setEditing(false); }
          if (e.key === "Escape") { setDraft(title); setEditing(false); }
        }}
        onBlur={() => { if (draft.trim() && draft !== title) onSave(draft.trim()); setEditing(false); }}
      />
    </div>
  );
}

function TagChip({ tag }: { tag: Matter["tags"][number] }) {
  if (tag === "partial-details") return <Chip tone="pending">{tag}</Chip>;
  if (tag === "client-pending") return <Chip tone="pending">{tag}</Chip>;
  if (tag === "conflict-review") return <Chip tone="danger">{tag}</Chip>;
  return <Chip tone="neutral" icon={<Lock className="h-2.5 w-2.5" />}>SOF</Chip>;
}

function PersonRow({ label, name, initials }: { label: string; name: string; initials: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[10px] font-semibold">{initials}</div>
      <div className="flex-1"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div>{name}</div></div>
    </div>
  );
}

function currentUserName(users: { id: string; fullName: string }[], uid: string) {
  return users.find((u) => u.id === uid)?.fullName ?? "You";
}

function seedDocs(matterId: string): MatterDoc[] {
  const suffix = matterId.slice(-4);
  return [
    { id: `d-${suffix}-1`, title: "SCN cover letter", type: "Case Delivery", versions: [{ label: "v1", uploadedAt: new Date(Date.now() - 6 * 864e5).toISOString(), isFinal: false }, { label: "v2", uploadedAt: new Date(Date.now() - 3 * 864e5).toISOString(), isFinal: true }], headNote: "Cover letter for SCN reply; encloses annexures A-D and RUD index." },
    { id: `d-${suffix}-2`, title: "Client engagement note", type: "Client Document", versions: [{ label: "v1", uploadedAt: new Date(Date.now() - 10 * 864e5).toISOString(), isFinal: true }], headNote: "Engagement note recording scope, fee, and points of contact." },
    { id: `d-${suffix}-3`, title: "Draft reply v3", type: "Case Delivery", versions: [{ label: "v1", uploadedAt: new Date(Date.now() - 4 * 864e5).toISOString(), isFinal: false }, { label: "v2", uploadedAt: new Date(Date.now() - 2 * 864e5).toISOString(), isFinal: false }, { label: "v3", uploadedAt: new Date(Date.now() - 1 * 864e5).toISOString(), isFinal: true }], headNote: "Reply on merits; jurisdictional grounds in Part A; valuation defence in Part B." },
  ];
}

function seedHistory(m: Matter | undefined): HistoryItem[] {
  if (!m) return [];
  return [
    { id: "seed-3", who: "System", what: `Matter #${m.matterId} created via ${m.createdVia}`, at: m.createdAt, source: m.createdVia === "mail" ? "Mail rule" : "Manual" },
    { id: "seed-2", who: "System", what: `Assigned to ${m.casePartnerId}`, at: m.createdAt, source: "Manual" },
    { id: "seed-1", who: "System", what: "Sync status set to " + m.syncStatus, at: new Date(new Date(m.createdAt).getTime() + 3600e3).toISOString(), source: "Court sync" },
  ];
}