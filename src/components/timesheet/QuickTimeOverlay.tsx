import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronDown, Info } from "lucide-react";
import { format } from "date-fns";
import { useAppStore } from "@/store/app-store";
import { useMatters, useTimeEntries, useUsers } from "@/hooks/use-data";
import type { ActivityType, TimeEntry, Matter } from "@/types";
import { parseDuration, activityNarrativeTemplate, isoDate } from "@/lib/duration";

const ACTIVITIES: ActivityType[] = [
  "Client Correspondence",
  "Client Meeting",
  "Draft Writing",
  "Review",
  "Research",
  "Hearing/Appearance",
];

function useRecentMatters(userId: string): Matter[] {
  const { data: te } = useTimeEntries();
  const { data: matters } = useMatters();
  return useMemo(() => {
    const ids = Array.from(new Set(
      te.filter((x) => x.userId === userId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((x) => x.matterId),
    ));
    return ids.map((id) => matters.find((m) => m.id === id)).filter(Boolean) as Matter[];
  }, [te, matters, userId]);
}

export function QuickTimeOverlay() {
  const {
    quickTimeOpen,
    quickTimeMatterId,
    quickTimeContextDate,
    currentUserId,
    closeQuickTime,
    addTimeEntry,
  } = useAppStore();

  const { data: matters } = useMatters();
  const { data: users } = useUsers();
  const me = users.find((u) => u.id === currentUserId);
  const isEA = me?.roles.includes("EA") ?? false;
  const recents = useRecentMatters(currentUserId);

  const [matter, setMatter] = useState<Matter | null>(null);
  const [matterOpen, setMatterOpen] = useState(false);
  const [matterSearch, setMatterSearch] = useState("");
  const [duration, setDuration] = useState("1:00");
  const [activity, setActivity] = useState<ActivityType>("Draft Writing");
  const [narrative, setNarrative] = useState(activityNarrativeTemplate("Draft Writing"));
  const [narrativeEdited, setNarrativeEdited] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [billable, setBillable] = useState(true);
  const [onBehalfId, setOnBehalfId] = useState<string>("");
  const matterInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (!quickTimeOpen) return;
    const pre = quickTimeMatterId ? matters.find((m) => m.id === quickTimeMatterId) ?? null : null;
    setMatter(pre);
    setMatterSearch("");
    setDuration("1:00");
    setActivity("Draft Writing");
    setNarrative(activityNarrativeTemplate("Draft Writing"));
    setNarrativeEdited(false);
    setDate(quickTimeContextDate ? new Date(quickTimeContextDate) : new Date());
    setBillable(true);
    setOnBehalfId("");
    setTimeout(() => matterInputRef.current?.focus(), 60);
  }, [quickTimeOpen, quickTimeMatterId, quickTimeContextDate, matters]);

  // Smart parse in matter input: "1096251 1.5 drafting rejoinder"
  useEffect(() => {
    const s = matterSearch.trim();
    if (!s) return;
    const parts = s.split(/\s+/);
    if (parts.length < 2) return;
    const numMatch = parts[0].match(/^#?(\d{6,})$/);
    if (!numMatch) return;
    const mid = Number(numMatch[1]);
    const found = matters.find((m) => m.matterId === mid);
    if (!found) return;
    const dur = parseDuration(parts[1]);
    if (!dur) return;
    const rest = parts.slice(2).join(" ").trim();
    setMatter(found);
    setDuration(parts[1]);
    if (rest) {
      // guess activity from keywords
      const lower = rest.toLowerCase();
      let act: ActivityType = "Draft Writing";
      if (/(draft|reply|rejoinder|submission)/.test(lower)) act = "Draft Writing";
      else if (/(review|check)/.test(lower)) act = "Review";
      else if (/(research|precedent)/.test(lower)) act = "Research";
      else if (/(call|meeting|meet)/.test(lower)) act = "Client Meeting";
      else if (/(email|mail|correspond)/.test(lower)) act = "Client Correspondence";
      else if (/(hearing|appearance|appear|court)/.test(lower)) act = "Hearing/Appearance";
      setActivity(act);
      setNarrative(rest.charAt(0).toUpperCase() + rest.slice(1));
      setNarrativeEdited(true);
    }
    setMatterOpen(false);
    setMatterSearch(found ? `#${found.matterId} · ${found.title.slice(0, 40)}` : "");
  }, [matterSearch, matters]);

  const dur = parseDuration(duration);
  const dayTotal = useMemo(() => {
    // compute today's total for the user from added + seed (rough soft warning)
    return 0; // we surface only if new entry pushes day > 12h; keep simple
  }, []);

  const clientPending = matter?.tags.includes("client-pending");

  function save(logAnother: boolean) {
    if (!matter || !dur || !narrative.trim()) return;
    const totalMin = dur.hours * 60 + dur.minutes;
    if (totalMin <= 0) return;

    const te: TimeEntry = {
      id: `te-user-${Date.now().toString(36)}`,
      userId: currentUserId,
      matterId: matter.id,
      date: isoDate(date),
      hours: dur.hours,
      minutes: dur.minutes,
      activityType: activity,
      narrative: narrative.trim(),
      billable,
      source: "manual",
      status: "Draft",
      onBehalfOfId: isEA && onBehalfId ? onBehalfId : undefined,
    };
    addTimeEntry(te);
    if (dayTotal + totalMin / 60 > 12) {
      toast.warning("Long day", { description: "Total exceeds 12h. Check for duplicates." });
    } else if (clientPending) {
      toast.info("Logged as Draft", { description: "Billing unlocks when the client is approved in CCM." });
    } else {
      toast.success("Time logged", { description: `${matter.matterId} · ${dur.hours}h ${dur.minutes}m` });
    }
    if (logAnother) {
      // keep matter + date, reset duration + narrative
      setDuration("");
      setNarrative(activityNarrativeTemplate(activity));
      setNarrativeEdited(false);
      setTimeout(() => matterInputRef.current?.focus(), 30);
    } else {
      closeQuickTime();
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      save(true);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save(false);
    } else if (e.key === "Enter" && !matterOpen && !(e.target as HTMLElement).closest("textarea")) {
      e.preventDefault();
      save(false);
    }
  }

  const canSave = !!matter && !!dur && (dur.hours > 0 || dur.minutes > 0) && !!narrative.trim();

  const matterFilter = matterSearch.toLowerCase().split(/\s+/)[0] ?? "";
  const filteredMatters = matterFilter
    ? matters.filter((m) =>
        String(m.matterId).includes(matterFilter) ||
        m.title.toLowerCase().includes(matterFilter),
      ).slice(0, 8)
    : recents.slice(0, 6);

  return (
    <Dialog open={quickTimeOpen} onOpenChange={(v) => !v && closeQuickTime()}>
      <DialogContent className="sm:max-w-[720px] p-0 gap-0" onKeyDown={onKey}>
        <div className="border-b px-4 py-2 flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Log time</div>
          <Badge variant="outline" className="text-[10px] h-4 px-1">Draft</Badge>
          <div className="ml-auto text-[11px] text-muted-foreground flex items-center gap-2">
            <kbd className="px-1 py-0.5 border rounded bg-muted text-[10px]">↵ Log</kbd>
            <kbd className="px-1 py-0.5 border rounded bg-muted text-[10px]">⇧↵ Log & another</kbd>
            <kbd className="px-1 py-0.5 border rounded bg-muted text-[10px]">Esc</kbd>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Row 1: matter combobox + smart parse hint */}
          <div>
            <Popover open={matterOpen} onOpenChange={setMatterOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Input
                    ref={matterInputRef}
                    value={matter && !matterOpen ? `#${matter.matterId} · ${matter.title.slice(0, 60)}` : matterSearch}
                    onChange={(e) => { setMatterSearch(e.target.value); setMatter(null); setMatterOpen(true); }}
                    onFocus={() => setMatterOpen(true)}
                    placeholder='Matter — try "1096251 1.5 drafting rejoinder"'
                    className="h-10 font-mono text-[13px]"
                  />
                  <ChevronDown className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[672px] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Type ID, title, or ID + duration + narrative" value={matterSearch} onValueChange={setMatterSearch} />
                  <CommandList>
                    <CommandEmpty>No matter found.</CommandEmpty>
                    {!matterFilter && (
                      <CommandGroup heading="Recent">
                        {recents.slice(0, 6).map((m) => (
                          <CommandItem key={m.id} value={m.id} onSelect={() => { setMatter(m); setMatterOpen(false); setMatterSearch(`#${m.matterId}`); }}>
                            <span className="font-mono text-xs mr-2 text-muted-foreground">#{m.matterId}</span>
                            <span className="truncate">{m.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {matterFilter && (
                      <CommandGroup heading="Results">
                        {filteredMatters.map((m) => (
                          <CommandItem key={m.id} value={m.id} onSelect={() => { setMatter(m); setMatterOpen(false); setMatterSearch(`#${m.matterId}`); }}>
                            <span className="font-mono text-xs mr-2 text-muted-foreground">#{m.matterId}</span>
                            <span className="truncate">{m.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {matter && clientPending && (
              <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Logged; billing unlocks when the client is approved in CCM.
              </div>
            )}
          </div>

          {/* Row 2: duration, activity, date, billable */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Duration</div>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="1:30, 1.5, 90m"
                className="h-9 font-mono"
              />
            </div>
            <div className="col-span-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Activity</div>
              <Select
                value={activity}
                onValueChange={(v) => {
                  const next = v as ActivityType;
                  setActivity(next);
                  if (!narrativeEdited) setNarrative(activityNarrativeTemplate(next));
                }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Date</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-start gap-2 font-normal">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="text-xs">{isSameDay(date, new Date()) ? "Today" : format(date, "EEE d MMM")}</span>
                    <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-2 w-auto pointer-events-auto">
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {[-3, -2, -1, 0].map((off) => {
                      const d = new Date(); d.setDate(d.getDate() + off);
                      return (
                        <button key={off} className="h-8 px-2 rounded hover:bg-muted text-left" onClick={() => setDate(d)}>
                          {off === 0 ? "Today" : format(d, "EEE d MMM")}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-2 flex items-center gap-2 pb-2">
              <Switch checked={billable} onCheckedChange={setBillable} id="billable" />
              <label htmlFor="billable" className="text-xs text-muted-foreground">Billable</label>
            </div>
          </div>

          {/* Row 3: narrative */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Narrative</div>
            <Input
              value={narrative}
              onChange={(e) => { setNarrative(e.target.value); setNarrativeEdited(true); }}
              placeholder="One-line description of the work"
              className="h-9"
            />
          </div>

          {isEA && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">On behalf of</div>
              <Select value={onBehalfId} onValueChange={setOnBehalfId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select fee earner" /></SelectTrigger>
                <SelectContent>
                  {users.filter((u) => u.roles.some((r) => r === "Case Partner" || r === "Case Manager")).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 flex items-center gap-2 bg-muted/30">
          <div className="text-[11px] text-muted-foreground">
            {dur ? `${dur.hours}h ${dur.minutes}m` : "Enter a duration"}
            {matter && (
              <>
                <span className="mx-2">·</span>
                <span className="font-mono">#{matter.matterId}</span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={closeQuickTime}>Cancel</Button>
            <Button size="sm" variant="outline" disabled={!canSave} onClick={() => save(true)}>Log & another</Button>
            <Button size="sm" disabled={!canSave} onClick={() => save(false)}>Log</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
