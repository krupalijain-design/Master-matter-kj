import { useMemo, useState } from "react";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/app-store";
import { useNotifications, useHearings, useRtbs, useTasks } from "@/hooks/use-data";
import { formatINR } from "@/lib/format";
import { firmTemplates } from "@/mocks/reports";

const categories = [
  "Hearings & deadlines",
  "RTB approvals",
  "CRTB approvals",
  "Allocation",
  "Checker queue",
  "Timesheet",
  "Docketing exceptions",
  "Reports",
] as const;

type Channel = "inApp" | "email" | "teams" | "digestOnly";
const channels: { key: Channel; label: string }[] = [
  { key: "inApp", label: "In-app" },
  { key: "email", label: "Email" },
  { key: "teams", label: "Teams" },
  { key: "digestOnly", label: "Digest only" },
];

// Org policy: Hearings & deadlines cannot be fully muted (in-app locked on).
const lockedCells: Record<string, Partial<Record<Channel, true>>> = {
  "Hearings & deadlines": { inApp: true },
};

export function NotificationPreferences() {
  const { notifPrefs, setNotifPrefCell, setNotifQuietHours, setDigestTime } = useAppStore();
  const { data: notifs } = useNotifications();
  const { data: hearings } = useHearings();
  const { data: rtbs } = useRtbs();
  const { data: tasks } = useTasks();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [previewOpen, setPreviewOpen] = useState(false);

  const digest = useMemo(() => {
    const mine = notifs.filter((n) => n.userId === currentUserId);
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    const upcomingHearings = hearings
      .filter((h) => {
        const t = new Date(h.date).getTime();
        return t > now && t < in24h;
      })
      .slice(0, 3);
    const dueToday = tasks
      .filter((t) => {
        if (t.status !== "Open" || t.assigneeId !== currentUserId) return false;
        const d = new Date(t.dueDate);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      })
      .slice(0, 5);
    const rtbApprovals = mine.filter((n) => n.category === "RTB approvals" && n.state !== "Done");
    const pendingRtbs = rtbs.filter((r) => r.status === "Pending Approval");
    const pendingTotal = pendingRtbs.reduce((s, r) => s + r.billingAmount, 0);
    const fyi = mine.filter((n) => n.priority === "FYI");
    const scheduledReports = firmTemplates.slice(0, 2).map((t, i) => ({
      id: t.id,
      name: t.name,
      topRows: [
        i === 0 ? "Bharat Chemicals — ₹18,42,000 outstanding" : "GSTAT — Appeal No. 214/2025 · listed 18/06/2026",
        i === 0 ? "Ashwath Foods — ₹9,10,500 outstanding" : "GSTAT — Appeal No. 227/2025 · listed 24/06/2026",
        i === 0 ? "Meridian Textiles — ₹6,75,000 outstanding" : "GSTAT — Appeal No. 231/2025 · listed 02/07/2026",
      ],
    }));
    return { upcomingHearings, dueToday, rtbApprovals, pendingRtbs, pendingTotal, fyi, scheduledReports };
  }, [notifs, hearings, rtbs, tasks, currentUserId]);

  return (
    <TooltipProvider>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[26px] font-normal">Notification preferences</h1>
            <p className="text-xs text-muted-foreground mt-1">Choose how each category reaches you.</p>
          </div>
          <Link to="/notifications">
            <Button variant="ghost" size="sm">Back to inbox</Button>
          </Link>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Category</th>
                {channels.map((c) => (
                  <th key={c.key} className="text-center px-3 py-2 font-semibold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const row = notifPrefs.matrix[cat] ?? { inApp: false, email: false, teams: false, digestOnly: false };
                return (
                  <tr key={cat} className="border-t">
                    <td className="px-3 py-2 text-[13px]">{cat}</td>
                    {channels.map((c) => {
                      const locked = lockedCells[cat]?.[c.key];
                      const cell = (
                        <div className="flex items-center justify-center gap-1">
                          <Switch
                            checked={locked ? true : row[c.key]}
                            disabled={!!locked}
                            onCheckedChange={(v) => {
                              if (locked) return;
                              setNotifPrefCell(cat, c.key, v);
                            }}
                          />
                          {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      );
                      return (
                        <td key={c.key} className="px-3 py-2">
                          {locked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>{cell}</TooltipTrigger>
                              <TooltipContent>Org policy: hearings must always alert in-app.</TooltipContent>
                            </Tooltip>
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-semibold">Quiet hours</div>
            <div className="flex items-center gap-2 text-sm">
              <Input
                type="time"
                value={notifPrefs.quietHours.start}
                onChange={(e) => setNotifQuietHours(e.target.value, notifPrefs.quietHours.end)}
                className="w-32"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="time"
                value={notifPrefs.quietHours.end}
                onChange={(e) => setNotifQuietHours(notifPrefs.quietHours.start, e.target.value)}
                className="w-32"
              />
            </div>
            <p className="text-xs text-muted-foreground">Only Critical alerts break through.</p>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-semibold">Digest send-time</div>
            <Input
              type="time"
              value={notifPrefs.digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">One consolidated brief every morning.</p>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <div className="text-sm font-semibold">Digest preview</div>
              <div className="text-xs text-muted-foreground">What tomorrow's {notifPrefs.digestTime} digest would send.</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPreviewOpen(true);
                toast.success("Preview generated");
              }}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" /> Send me a preview
            </Button>
          </div>
          {previewOpen && (
            <div className="p-4 space-y-4 bg-muted/20">
              <div className="max-w-lg mx-auto bg-background rounded-md border p-5 space-y-5 text-sm">
                <div className="pb-3 border-b">
                  <div className="text-xs text-muted-foreground">Your daily brief</div>
                  <div className="font-semibold">Snowfig LCMS · {new Date().toLocaleDateString("en-IN")}</div>
                </div>

                {digest.upcomingHearings.length > 0 && (
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Hearings</div>
                    {digest.upcomingHearings.map((h) => (
                      <div key={h.id} className="text-xs py-1 flex items-center justify-between">
                        <span>{h.forum}{h.bench ? ` · ${h.bench}` : ""}</span>
                        <span className="text-muted-foreground">{new Date(h.date).toLocaleDateString("en-IN")}</span>
                      </div>
                    ))}
                  </section>
                )}

                {digest.dueToday.length > 0 && (
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Due today</div>
                    {digest.dueToday.map((t) => (
                      <div key={t.id} className="text-xs py-1">· {t.subject}</div>
                    ))}
                  </section>
                )}

                {digest.rtbApprovals.length > 0 && (
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Needs you</div>
                    {digest.rtbApprovals.map((n) => (
                      <div key={n.id} className="text-xs py-1 flex items-center justify-between">
                        <span>{n.title}</span>
                        <Link to="/notifications" className="text-accent hover:underline">Approve</Link>
                      </div>
                    ))}
                  </section>
                )}

                {digest.pendingRtbs.length > 0 && (
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Pending RTB summary</div>
                    <div className="text-xs rounded border bg-muted/40 px-3 py-2">
                      {digest.pendingRtbs.length} items totalling <span className="font-mono tabular-nums font-semibold">{formatINR(digest.pendingTotal)}</span>
                    </div>
                  </section>
                )}

                {digest.fyi.length > 0 && (
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">FYI</div>
                    {digest.fyi.slice(0, 4).map((n) => (
                      <div key={n.id} className="text-xs py-1 text-muted-foreground">· {n.title}</div>
                    ))}
                  </section>
                )}

                {digest.scheduledReports.length > 0 && (
                  <section>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Scheduled reports</div>
                    <div className="space-y-2">
                      {digest.scheduledReports.map((r) => (
                        <div key={r.id} className="rounded border bg-muted/30 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold truncate">Your report "{r.name}"</div>
                            <Link to="/reports/$id" params={{ id: r.id }} className="text-[11px] text-accent hover:underline shrink-0">Open full</Link>
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {r.topRows.map((row, i) => (
                              <div key={i} className="text-[11px] text-muted-foreground">· {row}</div>
                            ))}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1.5">Top 3 rows · scope trimmed to you</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
