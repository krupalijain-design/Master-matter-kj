import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { timeAgo } from "@/lib/format";

const groupOrder = ["Critical", "Action needed", "FYI"] as const;

export function NotificationsBell() {
  const { data: notifs } = useNotifications();
  const { currentUserId } = useAppStore();
  const [open, setOpen] = useState(false);
  const mine = useMemo(() => notifs.filter((n) => n.userId === currentUserId), [notifs, currentUserId]);
  const unactionedCritical = mine.filter((n) => n.priority === "Critical" && n.state === "Unread").length;
  const unreadCount = mine.filter((n) => n.state === "Unread").length;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center ${unactionedCritical ? "bg-danger" : "bg-accent"}`}>
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96 p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-sm">Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {groupOrder.map((group) => {
            const items = mine.filter((n) => n.priority === group);
            if (!items.length) return null;
            return (
              <div key={group} className="py-2">
                <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                {items.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-border/60 ${n.state === "Unread" ? "bg-background" : "bg-muted/30"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] leading-snug text-foreground">{n.title}</div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {n.matterId && <span className="font-mono tabular-nums">{n.matterId.replace("m-", "#")}</span>}
                      <span>{timeAgo(n.createdAt)}</span>
                    </div>
                    {n.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {n.actions.map((a) => (
                          <Button
                            key={a.label}
                            size="sm"
                            variant={a.intent === "primary" ? "default" : a.intent === "danger" ? "destructive" : "outline"}
                            className="h-7 text-xs"
                            onClick={() => toast.success(`${a.label}: acknowledged`, { description: n.title })}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="border-t p-3">
          <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs text-accent hover:underline">Open Notifications →</Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}