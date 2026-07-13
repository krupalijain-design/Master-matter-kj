import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppStore, type ReportDelivery, type ReportSubscription } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { firmTemplates } from "@/mocks/reports";
import type { ReportDef } from "@/types";
import { Chip } from "@/components/ui/chip";

type Row = {
  key: string; // owner:reportId or sub:subId
  reportId: string;
  reportName: string;
  reportOwnerId: string;
  cadence: string;
  channel: string;
  recipientsLabel: string;
  kind: "owner" | "personal";
  subscriptionId?: string;
  paused: boolean;
};

export function SchedulesManager() {
  const reports = useAppStore((s) => s.reports);
  const templateOverrides = useAppStore((s) => s.templateOverrides);
  const subscriptions = useAppStore((s) => s.reportSubscriptions);
  const deliveries = useAppStore((s) => s.reportDeliveries);
  const userId = useAppStore((s) => s.currentUserId);
  const removeSubscription = useAppStore((s) => s.removeSubscription);
  const setSubscriptionPaused = useAppStore((s) => s.setSubscriptionPaused);
  const recordReportDelivery = useAppStore((s) => s.recordReportDelivery);
  const { data: users } = useUsers();

  const findReport = (id: string): ReportDef | undefined =>
    reports.find((r) => r.id === id) ?? templateOverrides[id] ?? firmTemplates.find((r) => r.id === id);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const r of reports) {
      if (r.ownerId === userId && r.schedule) {
        out.push({
          key: `owner:${r.id}`,
          reportId: r.id,
          reportName: r.name,
          reportOwnerId: r.ownerId,
          cadence: r.schedule.cadence,
          channel: r.schedule.channel,
          recipientsLabel: r.schedule.recipients.length
            ? `${r.schedule.recipients.length} recipient${r.schedule.recipients.length === 1 ? "" : "s"}`
            : "Just me",
          kind: "owner",
          paused: false,
        });
      }
    }
    for (const sub of subscriptions) {
      if (sub.subscriberId !== userId) continue;
      const rep = findReport(sub.reportId);
      if (!rep) continue;
      out.push({
        key: `sub:${sub.id}`,
        reportId: sub.reportId,
        reportName: rep.name,
        reportOwnerId: rep.ownerId,
        cadence: sub.cadence,
        channel: sub.channel,
        recipientsLabel: "Just me (personal)",
        kind: "personal",
        subscriptionId: sub.id,
        paused: sub.paused,
      });
    }
    return out;
  }, [reports, subscriptions, userId, templateOverrides]);

  const deliverNow = (row: Row, forceFail: boolean) => {
    const now = new Date().toISOString();
    const trace = [
      { step: "Compose digest card", status: "ok" as const, at: now },
      { step: `Enqueue on ${row.channel}`, status: "ok" as const, at: now },
      {
        step: forceFail ? "Delivery gateway timeout" : "Delivered",
        status: forceFail ? ("fail" as const) : ("ok" as const),
        at: now,
      },
    ];
    const delivery: ReportDelivery = {
      at: now,
      status: forceFail ? "failed" : "delivered",
      errorId: forceFail ? `LCMS-${Date.now().toString(16).slice(-4).toUpperCase()}` : undefined,
      trace,
    };
    recordReportDelivery(row.key, delivery);
    if (forceFail) {
      toast.error(`Delivery failed for "${row.reportName}"`, {
        description: `Owner has been notified. Error ${delivery.errorId}.`,
      });
    } else {
      toast.success(`Digest card sent for "${row.reportName}"`);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="border rounded-xl bg-surface p-10 text-center">
        <div className="font-display text-[18px]">No schedules yet.</div>
        <div className="text-sm text-muted-foreground mt-1">
          Subscribe to a report or add a schedule when saving one. Recipients see rows trimmed to their own scope.
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-surface">
      <table className="w-full editorial-table">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Report</th>
            <th className="text-left px-4 py-3 font-medium">Cadence</th>
            <th className="text-left px-4 py-3 font-medium">Channel</th>
            <th className="text-left px-4 py-3 font-medium">Recipients</th>
            <th className="text-left px-4 py-3 font-medium">Last delivery</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const d = deliveries[row.key];
            return (
              <tr key={row.key} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 align-top">
                  <Link to="/reports/$id" params={{ id: row.reportId }} className="font-medium hover:text-accent">
                    {row.reportName}
                  </Link>
                  <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                    {row.kind === "owner" ? "Owner schedule" : "Personal subscription"}
                    {row.paused ? " · paused" : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs capitalize">{row.cadence}</td>
                <td className="px-4 py-3 text-xs capitalize">{row.channel}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.recipientsLabel}</td>
                <td className="px-4 py-3">
                  <DeliveryCell delivery={d} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => deliverNow(row, false)}>
                      <Send className="h-3.5 w-3.5 mr-1" />Deliver now
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => deliverNow(row, true)}>
                      Simulate failure
                    </Button>
                    {row.kind === "personal" && row.subscriptionId && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setSubscriptionPaused(row.subscriptionId!, !row.paused)}
                        >
                          {row.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive"
                          onClick={() => {
                            removeSubscription(row.subscriptionId!);
                            toast.success("Subscription removed");
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryCell({ delivery }: { delivery?: ReportDelivery }) {
  if (!delivery) return <span className="text-xs text-muted-foreground">Not delivered yet</span>;
  const ok = delivery.status === "delivered";
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Chip tone={ok ? "success" : "danger"}>{ok ? "Delivered" : "Failed"}</Chip>
        <span className="text-[11px] text-muted-foreground font-mono">
          {new Date(delivery.at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1 flex-wrap">
        {delivery.trace.map((t, i) => (
          <Chip
            key={i}
            tone={t.status === "ok" ? "neutral" : "danger"}
            title={new Date(t.at).toLocaleTimeString("en-IN")}
          >
            {t.step}
          </Chip>
        ))}
        {delivery.errorId && (
          <span className="text-[10px] font-mono text-destructive">{delivery.errorId}</span>
        )}
      </div>
    </div>
  );
}

// Kept for type export symmetry
export type { ReportSubscription };