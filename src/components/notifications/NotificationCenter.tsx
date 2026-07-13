import { useMemo, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, Bell, Check, Clock, Mail, MessageSquare, ShieldAlert, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications, useHearings, useRtbs, useMatters } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { cx, formatINR, timeAgo } from "@/lib/format";
import type { AppNotification, RTB } from "@/types";
import { Chip } from "@/components/ui/chip";

type PriorityFilter = "All" | "Critical" | "Action needed" | "FYI";
type GroupBy = "Time" | "Matter" | "Category";

const priorityChips: PriorityFilter[] = ["All", "Critical", "Action needed", "FYI"];

function useResolvedNotifications(): AppNotification[] {
  const { data } = useNotifications();
  const overrides = useAppStore((s) => s.notificationOverrides);
  const currentUserId = useAppStore((s) => s.currentUserId);
  return useMemo(
    () =>
      data
        .filter((n) => n.userId === currentUserId)
        .map((n) => {
          const o = overrides[n.id];
          return o?.state ? { ...n, state: o.state } : n;
        }),
    [data, overrides, currentUserId],
  );
}

function ChannelIcon({ ch }: { ch: "in-app" | "email" | "Teams" }) {
  if (ch === "in-app") return <Bell className="h-3 w-3" />;
  if (ch === "email") return <Mail className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
}

function DeliveryTrace({ n }: { n: AppNotification }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
      {n.deliveryTrace.map((t, i) => (
        <Chip
          key={i}
          tone={t.status === "failed" ? "danger" : t.status === "retrying" ? "pending" : "success"}
          icon={<ChannelIcon ch={t.channel} />}
        >
          {t.channel} · {t.status === "delivered" ? format(new Date(t.at), "HH:mm") : t.status}
        </Chip>
      ))}
    </div>
  );
}

function dayBand(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return format(d, "EEE d MMM");
}

export function NotificationCenter() {
  const notifs = useResolvedNotifications();
  const { data: hearings } = useHearings();
  const { data: rtbs } = useRtbs();
  const { data: matters } = useMatters();
  const { setNotificationState, markAllNotificationsRead } = useAppStore();
  const navigate = useNavigate();
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const [groupBy, setGroupBy] = useState<GroupBy>("Time");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [approveRtb, setApproveRtb] = useState<{ notifId: string; rtb: RTB } | null>(null);
  const [fyiOpen, setFyiOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = notifs.filter((n) => n.state !== "Done");
    if (priority !== "All") list = list.filter((n) => n.priority === priority);
    // Critical pinned to top, then newest first
    return list.sort((a, b) => {
      if (a.priority === "Critical" && b.priority !== "Critical") return -1;
      if (b.priority === "Critical" && a.priority !== "Critical") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notifs, priority]);

  const doneLog = useMemo(() => notifs.filter((n) => n.state === "Done"), [notifs]);

  const grouped = useMemo(() => {
    const groups: { key: string; items: AppNotification[] }[] = [];
    const pick = (n: AppNotification): string => {
      if (groupBy === "Time") return dayBand(n.createdAt);
      if (groupBy === "Matter") return n.matterId ? `Matter #${n.matterId.replace("m-", "")}` : "No matter";
      return n.category;
    };
    for (const n of filtered) {
      const k = pick(n);
      let g = groups.find((x) => x.key === k);
      if (!g) {
        g = { key: k, items: [] };
        groups.push(g);
      }
      g.items.push(n);
    }
    return groups;
  }, [filtered, groupBy]);

  const nextHearingFor = useCallback(
    (matterId?: string) => {
      if (!matterId) return null;
      return hearings
        .filter((h) => h.matterId === matterId && new Date(h.date).getTime() > Date.now())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
    },
    [hearings],
  );

  const doneAction = useCallback(
    (n: AppNotification) => {
      setNotificationState(n.id, { state: "Done" });
      toast.success("Marked done", {
        description: n.title,
        action: { label: "Undo", onClick: () => setNotificationState(n.id, { state: "Unread" }) },
        duration: 6000,
      });
    },
    [setNotificationState],
  );

  const snoozeAction = useCallback(
    (n: AppNotification, until: Date, label: string) => {
      setNotificationState(n.id, { state: "Snoozed", snoozeUntil: until.toISOString() });
      toast.success(`Snoozed ${label}`, {
        description: n.title,
        action: { label: "Undo", onClick: () => setNotificationState(n.id, { state: "Unread" }) },
        duration: 6000,
      });
    },
    [setNotificationState],
  );

  const openAction = useCallback(
    (n: AppNotification) => {
      setNotificationState(n.id, { state: "Read" });
      if (n.category === "RTB approvals" || n.category === "CRTB approvals") {
        const rtb = rtbs.find((r) => r.id === n.rtbId || (n.matterId && r.matterId === n.matterId));
        if (rtb) {
          setApproveRtb({ notifId: n.id, rtb });
          return;
        }
      }
      if (n.category === "Allocation") {
        navigate({ to: "/matter/allocation" });
        return;
      }
      if (n.category === "Timesheet") {
        navigate({ to: "/timesheet" });
        return;
      }
      if (n.category === "Checker queue") {
        navigate({ to: "/mails" });
        return;
      }
      if (n.category === "Docketing exceptions") {
        navigate({ to: "/mails" });
        return;
      }
      if (n.matterId) {
        navigate({ to: "/matter/$id", params: { id: n.matterId } });
      }
    },
    [navigate, rtbs, setNotificationState],
  );

  // Keyboard j/k/E/S/↵/A
  useEffect(() => {
    const flat = filtered;
    const handler = (e: KeyboardEvent) => {
      if (approveRtb) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const cur = flat[selectedIdx];
      if (e.key === "j") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (cur && e.key === "Enter") {
        e.preventDefault();
        openAction(cur);
      } else if (cur && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        doneAction(cur);
      } else if (cur && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        const t = new Date();
        t.setHours(t.getHours() + 1);
        snoozeAction(cur, t, "1h");
      } else if (cur && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        const prim = cur.actions[0];
        if (prim) openAction(cur);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIdx, openAction, doneAction, snoozeAction, approveRtb]);

  const snoozePresets = (n: AppNotification) => {
    const now = new Date();
    const evening = new Date();
    evening.setHours(18, 0, 0, 0);
    if (evening < now) evening.setDate(evening.getDate() + 1);
    const tomorrow9 = new Date();
    tomorrow9.setDate(now.getDate() + 1);
    tomorrow9.setHours(9, 0, 0, 0);
    const hearing = nextHearingFor(n.matterId);
    const list: { label: string; at: Date }[] = [
      { label: "1 hour", at: new Date(now.getTime() + 60 * 60 * 1000) },
      { label: "This evening", at: evening },
      { label: "Tomorrow 9:00", at: tomorrow9 },
    ];
    if (hearing) list.push({ label: `After hearing (${format(new Date(hearing.date), "d MMM")})`, at: new Date(new Date(hearing.date).getTime() + 3 * 60 * 60 * 1000) });
    return list;
  };

  const renderRow = (n: AppNotification, idx: number) => {
    const isCritical = n.priority === "Critical";
    const isSelected = filtered[selectedIdx]?.id === n.id;
    const hearing = nextHearingFor(n.matterId);
    const matter = matters.find((m) => m.id === n.matterId);
    return (
      <div
        key={n.id}
        onClick={() => setSelectedIdx(idx)}
        className={cx(
          "group border rounded-md p-3 cursor-pointer transition-colors bg-card",
          isCritical && "border-l-4 border-l-danger",
          isSelected && "ring-1 ring-accent",
          n.state === "Unread" && !isCritical && "bg-background",
          n.state === "Read" && "bg-muted/30",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isCritical && <ShieldAlert className="h-3.5 w-3.5 text-danger shrink-0" />}
              <div className="text-[13px] leading-snug text-foreground">{n.title}</div>
              {n.escalatedFromName && (
                <Chip tone="pending">escalated from {n.escalatedFromName} after 24h</Chip>
              )}
            </div>
            {isCritical && matter && (
              <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                #{matter.matterId} · {hearing ? `listed ${hearing.forum}${hearing.causeListItemNo ? ` item ${hearing.causeListItemNo}` : ""}` : "no upcoming hearing"} · synced {timeAgo(n.createdAt)}
              </div>
            )}
            {!isCritical && (
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                {n.matterId && <span className="font-mono tabular-nums">#{n.matterId.replace("m-", "")}</span>}
                <span>{n.category}</span>
                <span>·</span>
                <span>{timeAgo(n.createdAt)}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {n.matterId && (
                <Link to="/matter/$id" params={{ id: n.matterId }}>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Open matter</Button>
                </Link>
              )}
              {n.actions.map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant={a.intent === "primary" ? "default" : a.intent === "danger" ? "destructive" : "outline"}
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    openAction(n);
                  }}
                >
                  {a.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  doneAction(n);
                }}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Done
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                    <Clock className="h-3.5 w-3.5 mr-1" /> Snooze
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {snoozePresets(n).map((p) => (
                    <DropdownMenuItem key={p.label} onClick={() => snoozeAction(n, p.at, p.label)}>
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <DeliveryTrace n={n} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-[26px] font-normal">Notifications</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            What needs you, ranked. j/k to move, Enter to open, E done, S snooze.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications/preferences">
            <Button variant="outline" size="sm">Preferences</Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              markAllNotificationsRead(filtered.map((n) => n.id));
              toast.success("Marked all as read");
            }}
          >
            Mark all read
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          {priorityChips.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cx(
                "h-7 px-3 rounded-full text-xs border",
                priority === p ? "bg-accent text-accent-foreground border-accent" : "bg-background border-border hover:bg-muted",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Group by</span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Time">Time</SelectItem>
              <SelectItem value="Matter">Matter</SelectItem>
              <SelectItem value="Category">Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="border rounded-md p-8 text-center text-sm text-muted-foreground">
          You're all caught up.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => {
            const fyiItems = g.items.filter((n) => n.priority === "FYI");
            const nonFyi = g.items.filter((n) => n.priority !== "FYI");
            let flatIdx = 0;
            const idxMap = new Map(filtered.map((n, i) => [n.id, i]));
            return (
              <div key={g.key}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">{g.key}</div>
                <div className="space-y-2">
                  {nonFyi.map((n) => renderRow(n, idxMap.get(n.id) ?? flatIdx++))}
                  {fyiItems.length > 0 && (
                    <div>
                      <button
                        onClick={() => setFyiOpen((v) => !v)}
                        className="text-xs text-muted-foreground hover:text-foreground py-1"
                      >
                        FYI ({fyiItems.length}) {fyiOpen ? "▾" : "▸"}
                      </button>
                      {fyiOpen && (
                        <div className="space-y-2 mt-2">
                          {fyiItems.map((n) => renderRow(n, idxMap.get(n.id) ?? flatIdx++))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {doneLog.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Done log ({doneLog.length})
          </div>
          <div className="space-y-1">
            {doneLog.slice(0, 10).map((n) => (
              <div key={n.id} className="text-xs text-muted-foreground border rounded px-3 py-1.5 flex items-center gap-2">
                <Check className="h-3 w-3 text-success" />
                <span className="line-through">{n.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!approveRtb} onOpenChange={(o) => !o && setApproveRtb(null)}>
        <SheetContent side="right" className="w-[520px] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm">
              Approve RTB {approveRtb?.rtb.rtbNo}
            </SheetTitle>
          </SheetHeader>
          {approveRtb && (
            <div className="p-4 space-y-4">
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Billing amount</span>
                  <span className="font-mono tabular-nums">{formatINR(approveRtb.rtb.billingAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-mono tabular-nums">{formatINR(approveRtb.rtb.outstandingAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline">{approveRtb.rtb.status}</Badge>
                </div>
              </div>
              <div className="rounded-md border">
                <div className="px-3 py-2 border-b text-xs font-semibold">Items</div>
                {approveRtb.rtb.items.map((it, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center justify-between border-b last:border-b-0">
                    <div><span className="text-muted-foreground">{it.kind}</span> · {it.description}</div>
                    <span className="font-mono tabular-nums">{formatINR(it.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setNotificationState(approveRtb.notifId, { state: "Done" });
                    toast.success(`RTB ${approveRtb.rtb.rtbNo} approved`, {
                      description: "Sent to Accounts for invoicing",
                      duration: 6000,
                    });
                    setApproveRtb(null);
                  }}
                >
                  Approve
                </Button>
                <Button variant="outline" onClick={() => setApproveRtb(null)}>Send back</Button>
                <Button variant="destructive" onClick={() => { setApproveRtb(null); toast("Rejected"); }}>
                  Reject
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Approvals update /approvals and Cockpit counts.
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
