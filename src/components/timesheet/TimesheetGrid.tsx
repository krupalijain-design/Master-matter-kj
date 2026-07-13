import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Copy, Upload, Download, Send, Plus, Info, Sparkles, Check, X, Pencil, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMatters, useTimeEntries, useUsers, useHearings } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import type { TimeEntry, ActivityType, Matter } from "@/types";
import { mondayOf, isoDate, weekKey, toDecimal, activityNarrativeTemplate } from "@/lib/duration";
import { cx } from "@/lib/format";

const ACTIVITIES: ActivityType[] = [
  "Client Correspondence", "Client Meeting", "Draft Writing", "Review", "Research", "Hearing/Appearance",
];
const DAILY_EXPECTED = 8;
const WEEKLY_EXPECTED = 40;

export function TimesheetGrid() {
  const search = useSearch({ strict: false }) as { day?: string; filter?: string };
  const navigate = useNavigate();
  const {
    currentUserId, timeEntriesAdded, timeEntriesEdited, submittedWeeks,
    rejectedSuggestionIds, addTimeEntry, updateTimeEntry, submitWeek, rejectSuggestion,
    openQuickTimeWith, pinnedMatterIds,
  } = useAppStore();

  const { data: seedEntries } = useTimeEntries();
  const { data: matters } = useMatters();
  const { data: users } = useUsers();
  const { data: hearings } = useHearings();
  const me = users.find((u) => u.id === currentUserId);

  // Merge seed + user-added, apply edits
  const entries = useMemo<TimeEntry[]>(() => {
    const merged: TimeEntry[] = [];
    for (const e of [...seedEntries, ...timeEntriesAdded]) {
      const patch = timeEntriesEdited[e.id];
      merged.push(patch ? { ...e, ...patch } : e);
    }
    return merged;
  }, [seedEntries, timeEntriesAdded, timeEntriesEdited]);

  const myEntries = useMemo(() => entries.filter((e) => e.userId === currentUserId), [entries, currentUserId]);

  // Week anchor
  const initialMonday = search.day ? mondayOf(new Date(search.day)) : mondayOf(new Date());
  const [monday, setMonday] = useState<Date>(initialMonday);
  useEffect(() => {
    if (search.day) setMonday(mondayOf(new Date(search.day)));
  }, [search.day]);

  const wk = weekKey(monday);
  const submittedForWeek = (submittedWeeks[wk] ?? []).some((x) => x.userId === currentUserId);
  const draftFilter = search.filter === "draft";

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const dayIsoList = days.map(isoDate);

  const weekEntries = myEntries.filter((e) => dayIsoList.includes(e.date));

  // Rows: distinct matter IDs in the week + pinned matters (regardless), sorted with more-hours first
  const rowMatterIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of weekEntries) set.add(e.matterId);
    for (const id of pinnedMatterIds) if (matters.find((m) => m.id === id)) set.add(id);
    return Array.from(set);
  }, [weekEntries, pinnedMatterIds, matters]);

  const [extraRowIds, setExtraRowIds] = useState<string[]>([]);
  const allRowIds = useMemo(() => [...rowMatterIds, ...extraRowIds.filter((id) => !rowMatterIds.includes(id))], [rowMatterIds, extraRowIds]);

  const rows = allRowIds.map((id) => matters.find((m) => m.id === id)).filter(Boolean) as Matter[];

  // Focused day (from Today's Fill button)
  const focusedIso = search.day ?? "";

  // Totals
  const dayTotals = dayIsoList.map((iso) =>
    weekEntries.filter((e) => e.date === iso).reduce((s, e) => s + toDecimal(e.hours, e.minutes), 0),
  );
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  // Draft rows filter
  const visibleRows = draftFilter
    ? rows.filter((m) => weekEntries.some((e) => e.matterId === m.id && e.status === "Draft"))
    : rows;

  // Suggested cards: outlook + activity sources with Draft status on any day in week, not rejected
  const suggestions = useMemo(() => {
    return weekEntries.filter((e) =>
      (e.source === "outlook" || e.source === "activity") &&
      e.status === "Draft" &&
      !rejectedSuggestionIds.includes(e.id),
    );
  }, [weekEntries, rejectedSuggestionIds]);

  // Handlers
  function handleSubmitWeek() {
    if (weekTotal === 0) {
      toast.error("Nothing to submit", { description: "Add entries before submitting." });
      return;
    }
    // Move all Draft → Submitted for the week
    for (const e of weekEntries.filter((e) => e.status === "Draft")) {
      updateTimeEntry(e.id, { status: "Submitted" });
    }
    submitWeek(wk, currentUserId);
    toast.success("Week submitted", { description: `Sent to ${partnerName(me?.id, users)} for approval` });
  }

  function handleCopyLastWeek() {
    const lastMon = addDays(monday, -7);
    const lastIsos = Array.from({ length: 7 }, (_, i) => isoDate(addDays(lastMon, i)));
    const source = myEntries.filter((e) => lastIsos.includes(e.date));
    if (source.length === 0) {
      toast.info("Last week is empty", { description: "Nothing to copy." });
      return;
    }
    let count = 0;
    for (const e of source) {
      const offset = lastIsos.indexOf(e.date);
      const newDate = dayIsoList[offset];
      addTimeEntry({ ...e, id: `te-copy-${Date.now().toString(36)}-${count}`, date: newDate, status: "Draft", source: "manual" });
      count++;
    }
    toast.success(`Copied ${count} entries`, { description: "Review and Submit when ready." });
  }

  function handleAcceptSuggestion(e: TimeEntry) {
    updateTimeEntry(e.id, { status: "Draft", source: e.source });
    toast.success("Added to timesheet");
  }

  const [addRowOpen, setAddRowOpen] = useState(false);
  const [addRowSearch, setAddRowSearch] = useState("");

  return (
    <TooltipProvider>
      <div className="p-6 space-y-4 max-w-[1400px]">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-[26px] font-normal tracking-tight">TimeSheet</h1>
            <div className="text-[13px] text-muted-foreground">Log it before it fades. Week of {format(monday, "d MMM yyyy")}.</div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMonday(mondayOf(new Date()))}>This week</Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="ml-4 text-[13px] text-muted-foreground tabular-nums font-mono">
            Total <span className="text-foreground">{weekTotal.toFixed(1)}h</span> · expected {WEEKLY_EXPECTED}h
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLastWeek} disabled={submittedForWeek}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy last week
            </Button>
            <BulkUploadMenu />
            <Button size="sm" onClick={handleSubmitWeek} disabled={submittedForWeek}>
              <Send className="h-3.5 w-3.5 mr-1" /> Submit week
            </Button>
          </div>
        </div>

        {submittedForWeek && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-[12px]">
              Week submitted. Entries are locked. Edit window: 15 days (per SRS). Use <span className="italic">Request unlock</span> on any row to reopen.
            </AlertDescription>
          </Alert>
        )}

        {draftFilter && (
          <div className="flex items-center gap-2 text-[12px]">
            <Badge variant="secondary">Filter: Draft entries</Badge>
            <button className="text-accent hover:underline" onClick={() => navigate({ to: "/timesheet" })}>Clear</button>
          </div>
        )}

        {/* Grid */}
        <div className="border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-[13px] border-collapse">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-[260px]">Matter</th>
                {days.map((d, i) => {
                  const iso = dayIsoList[i];
                  const total = dayTotals[i];
                  const under = total < DAILY_EXPECTED && i < 5; // Mon–Fri
                  const isFocused = iso === focusedIso;
                  return (
                    <th key={iso} className={cx("text-left px-3 py-2 border-l", isFocused && "bg-warning/10")}>
                      <div className="flex items-center gap-1">
                        <span>{format(d, "EEE d")}</span>
                        {isFocused && <Badge variant="outline" className="h-4 text-[9px] px-1">Gap</Badge>}
                      </div>
                      <div className={cx("mt-0.5 font-mono tabular-nums text-[11px]", under && i < 5 ? "text-warning" : "text-foreground")}>
                        {total.toFixed(1)}h{under && i < 5 && " ⚠"}
                      </div>
                    </th>
                  );
                })}
                <th className="text-left px-3 py-2 border-l w-[80px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground text-[12px]">
                    No matters this week. Click <span className="font-medium">+ add row</span> below.
                  </td>
                </tr>
              )}
              {visibleRows.map((m) => (
                <MatterRow
                  key={m.id}
                  matter={m}
                  days={days}
                  isos={dayIsoList}
                  entries={weekEntries.filter((e) => e.matterId === m.id)}
                  submitted={submittedForWeek}
                  onCellSave={(iso, values) => {
                    const existing = weekEntries.find((e) => e.matterId === m.id && e.date === iso);
                    if (existing) {
                      updateTimeEntry(existing.id, values);
                    } else {
                      addTimeEntry({
                        id: `te-cell-${Date.now().toString(36)}`,
                        userId: currentUserId,
                        matterId: m.id,
                        date: iso,
                        hours: values.hours ?? 0,
                        minutes: values.minutes ?? 0,
                        activityType: (values.activityType as ActivityType) ?? "Draft Writing",
                        narrative: values.narrative ?? "",
                        billable: values.billable ?? true,
                        source: "manual",
                        status: "Draft",
                      });
                    }
                  }}
                  onDragCopy={(fromIso, toIso) => {
                    const src = weekEntries.find((e) => e.matterId === m.id && e.date === fromIso);
                    if (!src) return;
                    addTimeEntry({ ...src, id: `te-drag-${Date.now().toString(36)}`, date: toIso, status: "Draft", source: "manual" });
                    toast.success("Copied to " + format(new Date(toIso), "EEE d MMM"));
                  }}
                />
              ))}
            </tbody>
          </table>

          <div className="px-3 py-2 border-t bg-muted/20 flex items-center gap-2">
            <Popover open={addRowOpen} onOpenChange={setAddRowOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={submittedForWeek}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> add row / matter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[420px]" align="start">
                <Command>
                  <CommandInput placeholder="Search matter ID or title" value={addRowSearch} onValueChange={setAddRowSearch} />
                  <CommandList>
                    <CommandEmpty>No matter found.</CommandEmpty>
                    <CommandGroup>
                      {matters
                        .filter((m) => !allRowIds.includes(m.id))
                        .filter((m) => {
                          if (!addRowSearch) return true;
                          const q = addRowSearch.toLowerCase();
                          return String(m.matterId).includes(q) || m.title.toLowerCase().includes(q);
                        })
                        .slice(0, 10)
                        .map((m) => (
                          <CommandItem key={m.id} value={m.id} onSelect={() => { setExtraRowIds((x) => [...x, m.id]); setAddRowOpen(false); setAddRowSearch(""); }}>
                            <span className="font-mono text-xs mr-2 text-muted-foreground">#{m.matterId}</span>
                            <span className="truncate">{m.title}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="ml-auto text-[11px] text-muted-foreground">
              Dot = narrative present · Click cell to edit · Drag cell to copy across days
            </div>
          </div>
        </div>

        {/* Suggested strip */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Suggested from Outlook & activity</div>
          </div>
          {suggestions.length === 0 ? (
            <div className="text-[12px] text-muted-foreground italic px-1">No suggestions this week.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map((s) => {
                const m = matters.find((x) => x.id === s.matterId);
                if (!m) return null;
                const dayLabel = format(new Date(s.date), "EEE HH:mm");
                const why = s.source === "outlook"
                  ? "Matched from an Outlook meeting subject + attendees."
                  : "Detected from document activity (Word / PDF edit signals).";
                return (
                  <div key={s.id} className="border rounded-md p-3 bg-background">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[9px] h-4 px-1 uppercase">{s.source}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] truncate">{s.narrative}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{dayLabel}</span>
                          <span>·</span>
                          <span className="font-mono">{toDecimal(s.hours, s.minutes).toFixed(1)}h</span>
                          <span>·</span>
                          <Link to="/matter/$id" params={{ id: m.id }} className="font-mono text-accent hover:underline">#{m.matterId}</Link>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[260px] text-[11px]">Why this matter? {why}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleAcceptSuggestion(s)} disabled={submittedForWeek}>
                          <Check className="h-3 w-3 mr-1" /> Log
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openQuickTimeWith({ matterId: m.id, date: s.date })} disabled={submittedForWeek}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => { rejectSuggestion(s.id); toast("Suggestion dismissed", { description: "Signal recorded to improve matching." }); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function partnerName(_userId: string | undefined, users: ReturnType<typeof useUsers>["data"]): string {
  const partner = users.find((u) => u.roles.includes("Case Partner"));
  return partner?.fullName ?? "your partner";
}

function BulkUploadMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          toast.success("File parsed", { description: `${f.name}: 12 draft rows staged. Review before Submit.` });
          e.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-3.5 w-3.5 mr-1" /> Bulk upload
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => toast("Template downloaded", { description: "timesheet-template.csv" })}>
            <Download className="h-3.5 w-3.5 mr-2" /> Download template
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-2" /> Upload file
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function MatterRow({
  matter, days, isos, entries, submitted, onCellSave, onDragCopy,
}: {
  matter: Matter;
  days: Date[];
  isos: string[];
  entries: TimeEntry[];
  submitted: boolean;
  onCellSave: (iso: string, values: Partial<TimeEntry>) => void;
  onDragCopy: (fromIso: string, toIso: string) => void;
}) {
  const rowTotal = entries.reduce((s, e) => s + toDecimal(e.hours, e.minutes), 0);
  const [dragFrom, setDragFrom] = useState<string | null>(null);

  return (
    <tr className="border-t hover:bg-muted/20">
      <td className="px-3 py-2 align-top">
        <Link to="/matter/$id" params={{ id: matter.id }} className="block">
          <div className="font-mono text-[11px] text-muted-foreground">#{matter.matterId}</div>
          <div className="text-[12px] truncate max-w-[240px] group-hover:text-accent">{matter.title}</div>
        </Link>
      </td>
      {days.map((_d, i) => {
        const iso = isos[i];
        const e = entries.find((x) => x.date === iso);
        return (
          <td
            key={iso}
            className="border-l align-top p-0"
            draggable={!!e && !submitted}
            onDragStart={() => setDragFrom(iso)}
            onDragOver={(ev) => { if (dragFrom && dragFrom !== iso) ev.preventDefault(); }}
            onDrop={() => { if (dragFrom && dragFrom !== iso) onDragCopy(dragFrom, iso); setDragFrom(null); }}
          >
            <CellEditor iso={iso} entry={e} submitted={submitted} onSave={(v) => onCellSave(iso, v)} />
          </td>
        );
      })}
      <td className="px-3 py-2 border-l font-mono tabular-nums text-[12px]">
        {rowTotal.toFixed(1)}h
      </td>
    </tr>
  );
}

function CellEditor({
  iso, entry, submitted, onSave,
}: {
  iso: string;
  entry?: TimeEntry;
  submitted: boolean;
  onSave: (v: Partial<TimeEntry>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(entry?.hours ?? 1);
  const [minutes, setMinutes] = useState(entry?.minutes ?? 0);
  const [activity, setActivity] = useState<ActivityType>(entry?.activityType ?? "Draft Writing");
  const [narrative, setNarrative] = useState(entry?.narrative ?? "");
  const [billable, setBillable] = useState(entry?.billable ?? true);

  useEffect(() => {
    if (open) {
      setHours(entry?.hours ?? 1);
      setMinutes(entry?.minutes ?? 0);
      setActivity(entry?.activityType ?? "Draft Writing");
      setNarrative(entry?.narrative ?? activityNarrativeTemplate("Draft Writing"));
      setBillable(entry?.billable ?? true);
    }
  }, [open, entry]);

  const total = toDecimal(entry?.hours ?? 0, entry?.minutes ?? 0);
  const isRunning = entry?.source === "timer";
  const isDraft = entry?.status === "Draft";
  const isSubmitted = entry?.status === "Submitted";

  return (
    <Popover open={open} onOpenChange={(v) => !submitted && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          className={cx(
            "w-full h-14 px-3 py-1.5 text-left hover:bg-accent/5 transition-colors",
            entry ? "text-foreground" : "text-muted-foreground",
          )}
          disabled={submitted}
        >
          {entry ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="font-mono tabular-nums text-[13px]">{total.toFixed(1)}h</span>
                {isRunning && <Clock className="h-3 w-3 text-accent animate-pulse" />}
                {entry.narrative && <span className="ml-0.5 h-1 w-1 rounded-full bg-accent" />}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground truncate">{entry.activityType}</span>
                {isDraft && <Badge variant="outline" className="h-3 text-[8px] px-1 border-warning/50 text-warning">Draft</Badge>}
                {isSubmitted && <Badge variant="outline" className="h-3 text-[8px] px-1 border-success/50 text-success">Submitted</Badge>}
              </div>
            </div>
          ) : (
            <span className="text-[18px] leading-none">+</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3 pointer-events-auto" align="start">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{format(new Date(iso), "EEE d MMM")}</div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Hours</div>
              <Input type="number" min={0} max={24} value={hours} onChange={(ev) => setHours(Math.max(0, Number(ev.target.value) || 0))} className="h-8 font-mono text-[13px]" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Mins</div>
              <Input type="number" min={0} max={59} step={15} value={minutes} onChange={(ev) => setMinutes(Math.max(0, Math.min(59, Number(ev.target.value) || 0)))} className="h-8 font-mono text-[13px]" />
            </div>
            <div className="flex items-end gap-1 pb-1">
              <Switch checked={billable} onCheckedChange={setBillable} />
              <span className="text-[10px] text-muted-foreground">Bill</span>
            </div>
          </div>
          <Select value={activity} onValueChange={(v) => setActivity(v as ActivityType)}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea rows={2} value={narrative} onChange={(ev) => setNarrative(ev.target.value)} placeholder="Narrative" className="text-[12px]" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={hours === 0 && minutes === 0} onClick={() => { onSave({ hours, minutes, activityType: activity, narrative: narrative.trim(), billable }); setOpen(false); }}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
