import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { PlayCircle, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RoleSwitcher } from "./RoleSwitcher";
import { NotificationsBell } from "./NotificationsBell";
import { CommandPalette } from "./CommandPalette";
import { MatterPeekDrawer } from "./MatterPeekDrawer";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";

function TimeRing({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, progress));
  const dash = 2 * Math.PI * 10;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0">
      <circle cx="12" cy="12" r="10" stroke="currentColor" className="text-muted" strokeWidth="3" fill="none" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" className="text-accent" strokeWidth="3" fill="none" strokeDasharray={dash} strokeDashoffset={dash * (1 - pct / 100)} strokeLinecap="round" transform="rotate(-90 12 12)" />
    </svg>
  );
}

export function TopBar() {
  const [palOpen, setPalOpen] = useState(false);
  const [peekMatterId, setPeekMatterId] = useState<string | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: users } = useUsers();
  const { currentUserId, openQuickTimeWith, setDemoOverlayOpen, demoDoneSteps } = useAppStore();
  const me = users.find((u) => u.id === currentUserId);
  const loggedHours = 2.5;
  const capacity = 8;
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalOpen((v) => !v);
        return;
      }
      if (inField) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        toast("Keyboard shortcuts", { description: "⌘K palette · T time · C create · G→M/W/R/I go · / search · ? this help · Esc close" });
        return;
      }
      if (e.key === "t" || e.key === "T") {
        openQuickTimeWith({});
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPalOpen(true);
        return;
      }
      if (e.key === "g" || e.key === "G") {
        setGPressed(true);
        setTimeout(() => setGPressed(false), 800);
        return;
      }
      if (gPressed) {
        const k = e.key.toLowerCase();
        if (k === "m") navigate({ to: "/matter" });
        else if (k === "w") navigate({ to: "/today" });
        else if (k === "r") navigate({ to: "/reports" });
        else if (k === "i") navigate({ to: "/mails" });
        setGPressed(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, gPressed, openQuickTimeWith]);

  if (pathname === "/login") return null;

  return (
    <>
      <header className="h-14 shrink-0 border-b bg-background/95 backdrop-blur sticky top-0 z-20 flex items-center gap-4 px-4">
        <div className="flex items-center gap-2 min-w-[200px]">
          <div className="h-6 w-6 rounded bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold">S</div>
          <span className="font-semibold text-sm tracking-tight">Snowfig <span className="text-muted-foreground font-normal">LCMS</span></span>
        </div>
        <button
          onClick={() => setPalOpen(true)}
          className="flex-1 max-w-2xl h-8 rounded-md border bg-muted/40 hover:bg-muted text-left px-3 flex items-center gap-2 text-[13px] text-muted-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search matters, clients, RTBs…</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border">⌘K</kbd>
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => openQuickTimeWith({})}
            className="h-8 pl-1.5 pr-2.5 rounded-md hover:bg-muted flex items-center gap-1.5 text-[12px] text-muted-foreground"
            aria-label="Time meter"
          >
            <TimeRing progress={(loggedHours / capacity) * 100} />
            <span className="tabular-nums font-mono"><span className="text-foreground">{loggedHours}</span>/{capacity}h</span>
          </button>
          <NotificationsBell />
          <button
            onClick={() => setDemoOverlayOpen(true)}
            className="h-8 px-2 rounded-md hover:bg-muted flex items-center gap-1.5 text-[12px] text-muted-foreground"
            aria-label="Demo script"
            title="Demo script (⌘⇧D)"
          >
            <PlayCircle className="h-4 w-4" />
            <span className="tabular-nums font-mono"><span className="text-foreground">{demoDoneSteps.length}</span>/9</span>
          </button>
          <RoleSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">{me?.avatarInitials ?? "?"}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-medium">{me?.fullName}</div>
                <div className="text-[11px] text-muted-foreground">{me?.email}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast("Preferences: stub")}>Preferences</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast("Delivery trace: stub")}>Delivery trace</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/login" })}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <CommandPalette open={palOpen} setOpen={setPalOpen} onPeekMatter={setPeekMatterId} />
      <MatterPeekDrawer matterId={peekMatterId} onClose={() => setPeekMatterId(null)} />
    </>
  );
}