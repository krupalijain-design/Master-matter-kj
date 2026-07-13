import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Clock,
  FileText,
  Flag,
  Info,
  Inbox,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useMails, useMatters, useUsers, useClients } from "@/hooks/use-data";
import type { MailItem, MailTag } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Chip, type ChipTone } from "@/components/ui/chip";

type QueueKey = "inbox" | "outbox" | "flagged" | "request" | "discarded";

const QUEUES: { key: QueueKey; label: string; priority?: "P1" | "P2" }[] = [
  { key: "inbox", label: "Inbox", priority: "P1" },
  { key: "outbox", label: "Outbox", priority: "P2" },
  { key: "flagged", label: "Flagged" },
  { key: "request", label: "Mail Request" },
  { key: "discarded", label: "Discarded" },
];

const TAGS: MailTag[] = [
  "New Matter",
  "Existing Matter",
  "Query",
  "Reminder",
  "Payment",
  "Expense Voucher",
  "Feedback",
  "Appreciation",
  "Complaint",
];

// Semantic tone per MailTag (matches soft-chip system).
const TAG_TONE: Record<MailTag, ChipTone> = {
  "New Matter": "accent",
  "Existing Matter": "info",
  "Query": "pending",
  "Reminder": "pending",
  "Payment": "success",
  "Expense Voucher": "info",
  "Feedback": "neutral",
  "Appreciation": "success",
  "Complaint": "danger",
};

// Warm-palette Outlook-style sender avatars (6 tints, deterministic hash).
const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "hsl(232 50% 90%)", fg: "hsl(232 45% 32%)" },
  { bg: "hsl(174 42% 88%)", fg: "hsl(174 48% 22%)" },
  { bg: "hsl(345 62% 91%)", fg: "hsl(345 50% 32%)" },
  { bg: "hsl(140 44% 88%)", fg: "hsl(140 44% 22%)" },
  { bg: "hsl(38 62% 88%)",  fg: "hsl(30 55% 28%)"  },
  { bg: "hsl(265 48% 91%)", fg: "hsl(265 42% 34%)" },
];
function senderColor(name: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function senderInitials(name: string): string {
  const clean = name.split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function SenderAvatar({ from }: { from: string }) {
  const c = senderColor(from);
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
      style={{ backgroundColor: c.bg, color: c.fg }}
      aria-hidden
    >
      {senderInitials(from)}
    </div>
  );
}

interface OverlayState {
  tag: Record<string, MailTag | undefined>;
  state: Record<string, MailItem["state"]>;
  matterId: Record<string, string | undefined>;
  flagReason: Record<string, string | undefined>;
  reassignedTo: Record<string, string | undefined>;
  discardedAt: Record<string, number>;
}

interface TelemetryEntry {
  mailId: string;
  suggested?: MailTag;
  chosen: MailTag;
  confidence?: number;
  changed: boolean;
  at: string;
}

declare global {
  interface Window {
    __lcmsTagTelemetry?: TelemetryEntry[];
    lcmsShowTelemetry?: () => void;
  }
}

export function MailInbox() {
  const { data: mails } = useMails();
  const { data: matters } = useMatters();
  const { data: users } = useUsers();
  const { data: clients } = useClients();

  const [queue, setQueue] = useState<QueueKey>("inbox");
  const [overlay, setOverlay] = useState<OverlayState>({
    tag: {},
    state: {},
    matterId: {},
    flagReason: {},
    reassignedTo: {},
    discardedAt: {},
  });
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"latest" | "oldest">("latest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multi, setMulti] = useState<Set<string>>(new Set());
  const [findOpen, setFindOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  // Merge overlay
  const merged = useMemo<MailItem[]>(
    () =>
      mails.map((m) => ({
        ...m,
        state: overlay.state[m.id] ?? m.state,
        tag: overlay.tag[m.id] ?? m.tag,
        matterId: overlay.matterId[m.id] ?? m.matterId,
        flagReason: overlay.flagReason[m.id] ?? m.flagReason,
      })),
    [mails, overlay],
  );

  // Queue counts (based on merged state)
  const counts = useMemo(() => {
    const c: Record<QueueKey, number> = { inbox: 0, outbox: 0, flagged: 0, request: 0, discarded: 0 };
    for (const m of merged) {
      if (m.state === "Discarded") c.discarded++;
      else if (m.state === "Flagged") c.flagged++;
      else if (m.queue === "Outbox") c.outbox++;
      else if (m.state === "Pending") c.inbox++;
      if (overlay.reassignedTo[m.id]) c.request++;
    }
    return c;
  }, [merged, overlay.reassignedTo]);

  // Filter by queue
  const list = useMemo(() => {
    const filtered = merged.filter((m) => {
      if (overlay.reassignedTo[m.id] && queue === "request") return true;
      if (queue === "discarded") return m.state === "Discarded";
      if (queue === "flagged") return m.state === "Flagged";
      if (queue === "outbox") return m.queue === "Outbox" && m.state !== "Discarded";
      if (queue === "inbox") return m.queue === "Inbox" && m.state === "Pending" && !overlay.reassignedTo[m.id];
      if (queue === "request") return !!overlay.reassignedTo[m.id];
      return true;
    });
    const searched = search
      ? filtered.filter(
          (m) =>
            m.subject.toLowerCase().includes(search.toLowerCase()) ||
            m.from.toLowerCase().includes(search.toLowerCase()),
        )
      : filtered;
    return [...searched].sort((a, b) => {
      const da = new Date(a.receivedAt).getTime();
      const db = new Date(b.receivedAt).getTime();
      return order === "latest" ? db - da : da - db;
    });
  }, [merged, queue, search, order, overlay.reassignedTo]);

  // Auto-select newest of current list
  useEffect(() => {
    if (!selectedId || !list.find((m) => m.id === selectedId)) {
      if (list.length) setSelectedId(list[0].id);
      else setSelectedId(null);
    }
  }, [list, selectedId]);

  const selected = list.find((m) => m.id === selectedId) ?? null;

  // Telemetry access
  useEffect(() => {
    window.__lcmsTagTelemetry = window.__lcmsTagTelemetry ?? [];
    window.lcmsShowTelemetry = () => {
       
      console.table(window.__lcmsTagTelemetry);
    };
  }, []);

  // Actions
  const discardMail = useCallback(
    (id: string) => {
      const prev = overlay.state[id];
      setOverlay((s) => ({
        ...s,
        state: { ...s.state, [id]: "Discarded" },
        discardedAt: { ...s.discardedAt, [id]: Date.now() },
      }));
      toast("Mail discarded", {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () =>
            setOverlay((s) => {
              const next = { ...s.state };
              if (prev) next[id] = prev;
              else delete next[id];
              return { ...s, state: next };
            }),
        },
      });
    },
    [overlay.state],
  );

  const flagMail = useCallback((id: string, reason: string) => {
    setOverlay((s) => ({
      ...s,
      state: { ...s.state, [id]: "Flagged" },
      flagReason: { ...s.flagReason, [id]: reason },
    }));
    toast.success("Flagged for partner attention");
  }, []);

  const applyTag = useCallback(
    (id: string, tag: MailTag) => {
      const mail = mails.find((m) => m.id === id);
      setOverlay((s) => ({
        ...s,
        tag: { ...s.tag, [id]: tag },
        state: { ...s.state, [id]: "Tagged" },
      }));
      const entry: TelemetryEntry = {
        mailId: id,
        suggested: mail?.aiSuggestedTag,
        chosen: tag,
        confidence: mail?.aiConfidence,
        changed: !!mail?.aiSuggestedTag && mail.aiSuggestedTag !== tag,
        at: new Date().toISOString(),
      };
      window.__lcmsTagTelemetry?.push(entry);
      toast.success(`Tagged: ${tag}`, {
        description: entry.changed ? "AI suggestion changed" : "Matches AI suggestion",
      });
    },
    [mails],
  );

  const attachToMatter = useCallback(
    (mailId: string, matterId: string) => {
      setOverlay((s) => ({
        ...s,
        matterId: { ...s.matterId, [mailId]: matterId },
        state: { ...s.state, [mailId]: "Tagged" },
        tag: { ...s.tag, [mailId]: "Existing Matter" },
      }));
      const m = matters.find((x) => x.id === matterId);
      toast.success(`Filed to matter ${m?.matterId}`, {
        description: "Source: Docketer + AI",
      });
    },
    [matters],
  );

  const requestReassign = useCallback((mailId: string, userId: string, note: string) => {
    setOverlay((s) => ({
      ...s,
      reassignedTo: { ...s.reassignedTo, [mailId]: userId },
    }));
    toast.success("Reassignment requested", { description: note });
  }, []);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      if (!list.length) return;
      const idx = selectedId ? list.findIndex((m) => m.id === selectedId) : -1;
      if (e.key === "j") {
        e.preventDefault();
        const next = Math.min(list.length - 1, idx + 1);
        setSelectedId(list[next].id);
      } else if (e.key === "k") {
        e.preventDefault();
        const next = Math.max(0, idx - 1);
        setSelectedId(list[next].id);
      } else if (e.key === "Enter" && selected) {
        e.preventDefault();
        // No-op: reading pane is always visible; treat as confirm tag
        const sug = selected.aiSuggestedTag;
        if (sug && selected.state === "Pending") applyTag(selected.id, sug);
      } else if (e.key.toLowerCase() === "e" && selected) {
        e.preventDefault();
        discardMail(selected.id);
      } else if (e.key.toLowerCase() === "f" && selected) {
        e.preventDefault();
        flagMail(selected.id, "Flagged via keyboard");
      } else if (/^[1-9]$/.test(e.key) && selected) {
        e.preventDefault();
        const t = TAGS[Number(e.key) - 1];
        if (t) applyTag(selected.id, t);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, selected, selectedId, applyTag, discardMail, flagMail]);

  const currentUserId = "u-ravi";
  const processedToday = Object.keys(overlay.state).filter(
    (id) => overlay.state[id] !== "Pending",
  ).length;

  return (
    <div className="grid grid-cols-[200px_400px_1fr] h-[calc(100vh-3.5rem)] bg-background">
      {/* LEFT RAIL */}
      <aside className="border-r border-border p-3 flex flex-col gap-1 overflow-y-auto">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-2 mb-1">
          Queues
        </div>
        {QUEUES.map((q) => {
          const active = q.key === queue;
          const n = counts[q.key];
          return (
            <button
              key={q.key}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left",
                active ? "bg-[hsl(var(--accent))]/10 text-foreground" : "hover:bg-muted",
              )}
              onClick={() => setQueue(q.key)}
            >
              <span>{q.label}</span>
              {n > 0 ? (
                <Chip
                  tone={
                    q.key === "flagged"
                      ? "pending"
                      : q.priority === "P1"
                      ? "accent"
                      : "neutral"
                  }
                  hideIcon
                  className="font-mono"
                >
                  {n}
                </Chip>
              ) : (
                <Chip tone="neutral" hideIcon className="font-mono opacity-60">{n}</Chip>
              )}
            </button>
          );
        })}
        <Separator className="my-3" />
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-2 mb-1">
          My assignment
        </div>
        <div className="px-2 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Processed today</span>
            <span className="font-mono">{processedToday}/24</span>
          </div>
          <div className="flex justify-between">
            <span>Avg s/mail</span>
            <span className="font-mono">11s <span className="text-muted-foreground/70">/ 13s</span></span>
          </div>
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-[hsl(var(--success))]" style={{ width: `${Math.min(100, (processedToday / 24) * 100)}%` }} />
          </div>
        </div>
      </aside>

      {/* LIST PANE */}
      <section className="border-r border-border flex flex-col overflow-hidden">
        <div className="border-b border-border p-2 flex items-center gap-2">
          <Input
            placeholder="Search mails…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <Select value={order} onValueChange={(v) => setOrder(v as "latest" | "oldest")}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {multi.size > 0 && (
          <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1.5 text-xs">
            <span>{multi.size} selected</span>
            <div className="flex gap-1">
              <BulkTagMenu
                onPick={(t) => {
                  multi.forEach((id) => applyTag(id, t));
                  setMulti(new Set());
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Discard ${multi.size} mails?`)) {
                    multi.forEach((id) => discardMail(id));
                    setMulti(new Set());
                  }
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              This queue is empty.
            </div>
          ) : (
            list.map((m) => (
              <MailRow
                key={m.id}
                mail={m}
                selected={m.id === selectedId}
                checked={multi.has(m.id)}
                onClick={() => setSelectedId(m.id)}
                onCheck={(v) =>
                  setMulti((s) => {
                    const n = new Set(s);
                    if (v) n.add(m.id);
                    else n.delete(m.id);
                    return n;
                  })
                }
              />
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground flex gap-3 flex-wrap">
          <Kbd label="j/k">move</Kbd>
          <Kbd label="↵">confirm tag</Kbd>
          <Kbd label="E">discard</Kbd>
          <Kbd label="F">flag</Kbd>
          <Kbd label="1-9">apply tag</Kbd>
        </div>
      </section>

      {/* READING PANE */}
      <section className="overflow-y-auto">
        {selected ? (
          <ReadingPane
            mail={selected}
            matters={matters}
            users={users}
            clients={clients}
            currentUserId={currentUserId}
            onDiscard={() => discardMail(selected.id)}
            onFlag={(reason) => flagMail(selected.id, reason)}
            onTag={(t) => applyTag(selected.id, t)}
            onAttachToMatter={(mid) => attachToMatter(selected.id, mid)}
            onOpenFind={() => setFindOpen(true)}
            onOpenReassign={() => setReassignOpen(true)}
            onPreviewAttachment={setPreviewAttachment}
          />
        ) : (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No mail selected.
          </div>
        )}
      </section>

      {/* Find-a-Matter Drawer */}
      <Sheet open={findOpen} onOpenChange={setFindOpen}>
        <SheetContent side="right" className="w-[520px]">
          <SheetHeader>
            <SheetTitle>Find a matter</SheetTitle>
            <SheetDescription>
              Search by Matter ID, Invoice/RTB No., Matter Title, Client, or Doc Ref.
            </SheetDescription>
          </SheetHeader>
          <FindAMatter
            matters={matters}
            clients={clients}
            onPick={(mid) => {
              if (selected) attachToMatter(selected.id, mid);
              setFindOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Reassign Drawer */}
      <Sheet open={reassignOpen} onOpenChange={setReassignOpen}>
        <SheetContent side="right" className="w-[460px]">
          <SheetHeader>
            <SheetTitle>Request reassignment</SheetTitle>
            <SheetDescription>
              Move this mail to another Docketer with a note.
            </SheetDescription>
          </SheetHeader>
          <ReassignForm
            users={users.filter((u) => u.roles.some((r) => r === "Docketer" || r === "Maker"))}
            onSubmit={(uid, note) => {
              if (selected) requestReassign(selected.id, uid, note);
              setReassignOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Attachment preview Drawer */}
      <Sheet open={!!previewAttachment} onOpenChange={(o) => !o && setPreviewAttachment(null)}>
        <SheetContent side="right" className="w-[560px]">
          <SheetHeader>
            <SheetTitle>{previewAttachment}</SheetTitle>
            <SheetDescription>Preview (mock)</SheetDescription>
          </SheetHeader>
          <div className="mt-4 h-[70vh] rounded border border-border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            Document preview placeholder
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kbd({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">{label}</kbd>
      <span>{children}</span>
    </span>
  );
}

function MailRow({
  mail, selected, checked, onClick, onCheck,
}: {
  mail: MailItem;
  selected: boolean;
  checked: boolean;
  onClick: () => void;
  onCheck: (v: boolean) => void;
}) {
  const toShort = mail.to[0]?.split("@")[0] ?? "";
  const extra = mail.to.length > 1 ? ` +${mail.to.length - 1}` : "";
  const isUnread = mail.state === "Pending";
  return (
    <div
      className={cn(
        "relative border-b border-border px-3 py-2 cursor-pointer hover:bg-muted/50 flex gap-2",
        isUnread && "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[hsl(var(--accent))]",
        selected && "bg-[hsl(var(--accent))]/5",
      )}
      onClick={onClick}
    >
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={checked} onCheckedChange={(v) => onCheck(!!v)} />
      </div>
      <SenderAvatar from={mail.from} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground truncate flex-1">
            <span className={cn("text-foreground", isUnread ? "font-semibold" : "font-normal text-muted-foreground")}>
              {mail.from.split("@")[0]}
            </span>
            <span className="mx-1">→</span>
            <span>{toShort}{extra}</span>
          </div>
          {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))] shrink-0" aria-label="Unread" />}
          <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
            {formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: false })}
          </span>
        </div>
        <div className={cn("text-sm line-clamp-2 mt-0.5", isUnread ? "font-medium text-foreground" : "text-muted-foreground")}>
          {mail.subject}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {mail.attachments.length > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <Paperclip className="h-2.5 w-2.5" /> {mail.attachments.length}
            </Badge>
          )}
          <StateChip state={mail.state} />
          {mail.tag && <Chip tone={TAG_TONE[mail.tag]} hideIcon>{mail.tag}</Chip>}
          {mail.state === "Pending" && mail.aiSuggestedTag && (
            <Chip
              tone={TAG_TONE[mail.aiSuggestedTag]}
              icon={<Sparkles className="h-2.5 w-2.5 shrink-0" />}
            >
              {mail.aiSuggestedTag} · {Math.round((mail.aiConfidence ?? 0) * 100)}%
            </Chip>
          )}
          {mail.state === "Flagged" && (
            <Chip tone="pending" icon={<Flag className="h-2.5 w-2.5 shrink-0" />}>
              {mail.flaggedBy ?? "Flagged"}
            </Chip>
          )}
        </div>
      </div>
    </div>
  );
}

function StateChip({ state }: { state: MailItem["state"] }) {
  const map: Record<MailItem["state"], ChipTone> = {
    Pending: "pending",
    Tagged: "success",
    Discarded: "neutral",
    Flagged: "pending",
  };
  return <Chip tone={map[state]} strikethrough={state === "Discarded"}>{state}</Chip>;
}

function BulkTagMenu({ onPick }: { onPick: (t: MailTag) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          Tag <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        {TAGS.map((t) => (
          <button
            key={t}
            onClick={() => onPick(t)}
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
          >
            {t}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ReadingPane({
  mail, matters, users, clients, currentUserId,
  onDiscard, onFlag, onTag, onAttachToMatter, onOpenFind, onOpenReassign, onPreviewAttachment,
}: {
  mail: MailItem;
  matters: ReturnType<typeof useMatters>["data"];
  users: ReturnType<typeof useUsers>["data"];
  clients: ReturnType<typeof useClients>["data"];
  currentUserId: string;
  onDiscard: () => void;
  onFlag: (reason: string) => void;
  onTag: (t: MailTag) => void;
  onAttachToMatter: (mid: string) => void;
  onOpenFind: () => void;
  onOpenReassign: () => void;
  onPreviewAttachment: (name: string) => void;
}) {
  void users;
  const [selectedTag, setSelectedTag] = useState<MailTag | undefined>(
    mail.tag ?? mail.aiSuggestedTag,
  );
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");

  useEffect(() => {
    setSelectedTag(mail.tag ?? mail.aiSuggestedTag);
  }, [mail.id, mail.tag, mail.aiSuggestedTag]);

  const isOutbox = mail.queue === "Outbox";
  const isExisting = selectedTag === "Existing Matter";
  const isNew = selectedTag === "New Matter";

  return (
    <article className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{mail.subject}</h2>
            <div className="text-xs text-muted-foreground mt-1 space-x-2">
              <span><span className="text-foreground">From</span> {mail.from}</span>
              <span>·</span>
              <span><span className="text-foreground">To</span> {mail.to.join(", ")}</span>
              {mail.cc.length > 0 && <><span>·</span><span>Cc {mail.cc.join(", ")}</span></>}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true })}
            </div>
          </div>
          <div className="flex gap-1">
            <Popover open={flagOpen} onOpenChange={setFlagOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm"><Flag className="h-4 w-4 mr-1" />Flag</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-2">
                <div className="text-sm font-medium">Reason</div>
                <Textarea rows={3} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="Needs partner attention…" />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onFlag(flagReason || "Partner attention");
                    setFlagOpen(false);
                    setFlagReason("");
                  }}
                >
                  Flag mail
                </Button>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={onDiscard}><Trash2 className="h-4 w-4 mr-1" />Discard</Button>
            <Button variant="ghost" size="sm" onClick={onOpenReassign}><UserPlus className="h-4 w-4 mr-1" />Request reassignment</Button>
          </div>
        </div>
      </header>

      {/* Attachments strip */}
      {mail.attachments.length > 0 && (
        <div className="border-b border-border p-3 flex gap-2 overflow-x-auto">
          {mail.attachments.map((a) => (
            <button
              key={a.name}
              onClick={() => onPreviewAttachment(a.name)}
              className="min-w-[240px] max-w-[260px] rounded-md border border-border bg-muted/30 p-2 text-left hover:bg-muted"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium truncate flex-1">{a.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{a.type.split("/").pop()}</span>
              </div>
              {a.aiSummary && (
                <div className="text-[11px] text-muted-foreground line-clamp-2">
                  <Sparkles className="inline h-2.5 w-2.5 mr-1 text-[hsl(var(--accent))]" />
                  {a.aiSummary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="p-4 border-b border-border">
        <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: mail.bodyHtml }} />
      </div>

      {/* Tag card */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Tag this mail</div>
          {mail.aiSuggestedTag && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-[hsl(var(--accent))]" />
              Suggested: <span className="font-medium text-foreground">{mail.aiSuggestedTag}</span>
              <span className="font-mono">· {Math.round((mail.aiConfidence ?? 0) * 100)}%</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-[hsl(var(--accent))] hover:underline">Why</button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs space-y-1">
                  <div className="font-medium">Matched phrases</div>
                  <div className="text-muted-foreground">
                    "{mail.subject.split(" ").slice(0, 4).join(" ")}…" · sender domain classified as client
                    {mail.matchCandidates[0]?.refNoHit && (
                      <> · reference no. <span className="font-mono">{mail.matchCandidates[0].refNoHit}</span></>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((t, i) => {
            const tone = TAG_TONE[t];
            const isSelected = selectedTag === t;
            const isSuggested = mail.aiSuggestedTag === t;
            const dot = `var(--chip-${tone}-fg)`;
            const softBg = `var(--chip-${tone}-bg)`;
            return (
              <button
                key={t}
                onClick={() => setSelectedTag(t)}
                className={cn(
                  "relative px-2 py-1 rounded-md border text-xs flex items-center gap-1.5 transition",
                  isSuggested
                    ? "ring-2 ring-[hsl(var(--accent))] ring-offset-1 border-[hsl(var(--accent))] pr-2.5"
                    : "border-border",
                  isSelected
                    ? "text-foreground"
                    : "hover:brightness-95 text-foreground",
                )}
                style={isSelected || isSuggested ? { backgroundColor: softBg } : undefined}
              >
                <span className="font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: dot }}
                  aria-hidden
                />
                {isSuggested && <Sparkles className="h-3 w-3 text-[hsl(var(--accent))]" />}
                <span>{t}</span>
                {isSuggested && (
                  <span className="ml-1 inline-flex items-center h-4 px-1 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-mono text-[9px] tracking-tight">
                    AI {Math.round((mail.aiConfidence ?? 0) * 100)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!selectedTag}
            onClick={() => selectedTag && onTag(selectedTag)}
          >
            Confirm tag <kbd className="ml-2 px-1 py-0.5 rounded border border-white/30 font-mono text-[10px]">↵</kbd>
          </Button>
        </div>
      </div>

      {/* Existing Matter path */}
      {isExisting && (
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Candidate matches</div>
            <Button variant="ghost" size="sm" onClick={onOpenFind}>Search more</Button>
          </div>
          {mail.matchCandidates.length === 0 ? (
            <div className="text-xs text-muted-foreground">No candidates. Search manually.</div>
          ) : (
            mail.matchCandidates.map((c) => {
              const m = matters.find((x) => x.id === c.matterId);
              if (!m) return null;
              const client = clients.find((cl) => cl.id === m.clientId);
              const looksLike = mail.subject.toLowerCase().includes("appeal") ? "Appeal" : m.deliverable;
              return (
                <div key={c.matterId} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm">{m.matterId}</span>
                      <span className="text-sm ml-2">{m.title}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{Math.round(c.confidence * 100)}%</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{client?.name}</div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] pt-1">
                    {c.refNoHit && (
                      <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] px-1.5 py-0.5">
                        <Check className="h-3 w-3" /> <span className="font-mono">{c.refNoHit}</span>
                      </span>
                    )}
                    {c.entityHit && (
                      <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] px-1.5 py-0.5">
                        <Check className="h-3 w-3" /> {c.entityHit}
                      </span>
                    )}
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                      c.deliverableMatch ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]"
                    )}>
                      {c.deliverableMatch ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {c.deliverableMatch ? `Deliverable: ${m.deliverable}` : `this mail looks like ${looksLike}; candidate is ${m.deliverable}`}
                    </span>
                  </div>
                  <div className="pt-1">
                    <Button size="sm" onClick={() => onAttachToMatter(m.id)}>
                      {isOutbox ? "File deliverable → " : "Attach to this matter"} {isOutbox && <span className="ml-1 font-mono">{m.matterId}</span>}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* New Matter path */}
      {isNew && (
        <div className="p-4 border-t border-border">
          <div className="rounded-md border border-border p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">New matter from this mail</div>
              <div className="text-xs text-muted-foreground">
                Fields will be pre-filled from the mail and attachments.
              </div>
            </div>
            <Button asChild>
              <Link to="/matter/new" search={{ fromMail: mail.id }}>
                Create matter from this mail <Send className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Outbox: file deliverable */}
      {isOutbox && !isExisting && (
        <div className="p-4 border-t border-border">
          <div className="rounded-md border border-border p-3 flex items-center justify-between">
            <div className="text-sm">
              <Info className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
              Outbox mail — choose an Existing Matter to file as Case Delivery (Final).
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedTag("Existing Matter")}>
              Show candidates
            </Button>
          </div>
        </div>
      )}

      {mail.matterId && (
        <div className="p-4 border-t border-border text-xs text-muted-foreground">
          Filed to <Link to="/matter/$id" params={{ id: mail.matterId }} className="font-mono text-[hsl(var(--accent))] hover:underline">{matters.find((x) => x.id === mail.matterId)?.matterId}</Link>{" "}
          <Badge variant="outline" className="ml-2 text-[10px]">Source: Docketer + AI</Badge>
        </div>
      )}

      <div className="mt-auto p-3 text-[11px] text-muted-foreground border-t border-border">
        <span className="mr-2">Assigned to</span>
        <Badge variant="outline" className="text-[10px]">{users.find((u) => u.id === mail.assignedDocketerId)?.fullName ?? currentUserId}</Badge>
        <Inbox className="inline h-3 w-3 ml-3 mr-1" />
        Docketing round-robin
      </div>
    </article>
  );
}

function FindAMatter({
  matters, clients, onPick,
}: { matters: ReturnType<typeof useMatters>["data"]; clients: ReturnType<typeof useClients>["data"]; onPick: (mid: string) => void }) {
  const [field, setField] = useState<"matterId" | "invoice" | "title" | "client" | "docRef">("matterId");
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (!q) return matters.slice(0, 8);
    const needle = q.toLowerCase();
    return matters
      .filter((m) => {
        const client = clients.find((c) => c.id === m.clientId);
        if (field === "matterId") return String(m.matterId).includes(needle);
        if (field === "title") return m.title.toLowerCase().includes(needle);
        if (field === "client") return client?.name.toLowerCase().includes(needle);
        if (field === "docRef") return m.docRefNumber?.toLowerCase().includes(needle);
        if (field === "invoice") return m.docRefNumber?.toLowerCase().includes(needle);
        return false;
      })
      .slice(0, 12);
  }, [field, q, matters, clients]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <Select value={field} onValueChange={(v) => setField(v as typeof field)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="matterId">Matter ID</SelectItem>
            <SelectItem value="invoice">Invoice / RTB No.</SelectItem>
            <SelectItem value="title">Matter Title</SelectItem>
            <SelectItem value="client">Client's Name</SelectItem>
            <SelectItem value="docRef">DOC Reference</SelectItem>
          </SelectContent>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9" />
      </div>
      <div className="space-y-1 max-h-[70vh] overflow-y-auto">
        {results.map((m) => {
          const c = clients.find((cl) => cl.id === m.clientId);
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className="w-full text-left rounded-md border border-border p-2 hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{m.matterId}</span>
                <Badge variant="outline" className="text-[10px]">{m.deliverable}</Badge>
              </div>
              <div className="text-sm">{m.title}</div>
              <div className="text-xs text-muted-foreground">{c?.name} · {m.docRefNumber ?? "no ref"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReassignForm({
  users, onSubmit,
}: { users: ReturnType<typeof useUsers>["data"]; onSubmit: (uid: string, note: string) => void }) {
  const [uid, setUid] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Reassign to</div>
        <Select value={uid} onValueChange={setUid}>
          <SelectTrigger><SelectValue placeholder="Choose teammate" /></SelectTrigger>
          <SelectContent>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName} · {u.branch}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Note</div>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this needs to move…" />
      </div>
      <Button className="w-full" disabled={!uid} onClick={() => onSubmit(uid, note)}>
        <Loader2 className="hidden h-3 w-3 animate-spin mr-1" /> Send request
      </Button>
    </div>
  );
}