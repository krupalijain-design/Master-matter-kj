import { useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus, Copy, Trash2, Play, Pencil, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { firmTemplates } from "@/mocks/reports";
import { canGrantVisibility, canSeeReport, datasetMeta, duplicateAsPrivate } from "@/lib/report-engine";
import { DrilledList } from "@/components/reports/DrilledList";
import { ShareReportDrawer } from "@/components/reports/ShareReportDrawer";
import { SchedulesManager } from "@/components/reports/SchedulesManager";
import type { ReportDef } from "@/types";

type Tab = "mine" | "shared" | "templates" | "schedules" | "runs";

const visibilityTone = (v: ReportDef["visibility"]): ChipTone =>
  v === "Private" ? "neutral" : v === "Team" ? "info" : v === "Practice" ? "accent" : "success";

export function ReportsHome() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as unknown as Record<string, string | undefined>;
  const initialTab: Tab = (search.tab as Tab) ?? (search.kind ? "runs" : "mine");
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data: users } = useUsers();
  const reports = useAppStore((s) => s.reports);
  const addReport = useAppStore((s) => s.addReport);
  const deleteReport = useAppStore((s) => s.deleteReport);
  const reportShares = useAppStore((s) => s.reportShares);
  const templateOverrides = useAppStore((s) => s.templateOverrides);
  const userId = useAppStore((s) => s.currentUserId);
  const user = users.find((u) => u.id === userId) ?? users[0];
  const [shareOpenFor, setShareOpenFor] = useState<string | null>(null);

  const mine = useMemo(() => reports.filter((r) => r.ownerId === userId), [reports, userId]);
  const shared = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.ownerId !== userId &&
          user &&
          (canSeeReport(user, r) && r.visibility !== "Private" || (reportShares[r.id] ?? []).includes(userId)),
      ),
    [reports, userId, user, reportShares],
  );

  const templates = useMemo(
    () => firmTemplates.map((t) => templateOverrides[t.id] ?? t),
    [templateOverrides],
  );

  const useTemplate = (t: ReportDef) => {
    if (!user) return;
    const copy = duplicateAsPrivate(t, user, "");
    addReport(copy);
    toast.success(`Copied "${t.name}" to your reports`);
    navigate({ to: "/reports/$id/edit", params: { id: copy.id } });
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <PageHeader
        title="Reports"
        subtitle="Build it once, run it forever."
        actions={
          <Link to="/reports/new">
            <Button className="h-9"><Plus className="h-4 w-4 mr-1.5" />New report</Button>
          </Link>
        }
      />

      <div className="flex items-center gap-1 border-b">
        {([
          ["mine", "My reports", mine.length],
          ["shared", "Shared with me", shared.length],
          ["templates", "Firm templates", templates.length],
          ["schedules", "Schedules", undefined],
          ["runs", "Runs", undefined],
        ] as const).map(([k, l, n]) => (
          <button
            key={k}
            onClick={() => { setTab(k); navigate({ to: "/reports", search: { tab: k } as never }); }}
            className={
              "px-3 py-2 text-sm border-b-2 -mb-px transition-colors " +
              (tab === k ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {l}{typeof n === "number" ? <span className="ml-1.5 text-xs text-muted-foreground">({n})</span> : null}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <MyReportsTable
          rows={mine}
          onShare={(id) => setShareOpenFor(id)}
          onDelete={(id) => { deleteReport(id); toast.success("Report deleted"); }}
          onDuplicate={(r) => user && addReport(duplicateAsPrivate(r, user))}
        />
      )}

      {tab === "shared" && (
        <SharedTable
          rows={shared}
          onUseAsTemplate={(r) => useTemplate(r)}
        />
      )}

      {tab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const usageCount = reports.filter((r) => r.sourceTemplateId === t.id).length;
            const canEditTemplate = !!user && canGrantVisibility(user, "Firm-template");
            return (
              <div key={t.id} className="bg-surface border rounded-xl p-5 flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{datasetMeta(t.dataset).label}</span>
                    <Chip tone="neutral">v{t.version}</Chip>
                  </div>
                  <div className="font-display text-[18px] leading-snug mt-0.5">{t.name}</div>
                  {t.description ? <div className="text-xs text-muted-foreground mt-1.5">{t.description}</div> : null}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />Used by {usageCount} {usageCount === 1 ? "person" : "people"}
                  </span>
                  <div className="flex items-center gap-1">
                    {canEditTemplate && (
                      <Link to="/reports/$id/edit" params={{ id: t.id }}>
                        <Button size="sm" variant="ghost" className="h-7 px-2"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                    )}
                    <Button size="sm" variant="outline" onClick={() => useTemplate(t)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />Use as template
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "schedules" && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Owner schedules and your personal subscriptions. Each recipient sees rows trimmed to their own scope.
          </div>
          <SchedulesManager />
        </div>
      )}

      {tab === "runs" && (
        <div>
          <div className="text-xs text-muted-foreground mb-3">Recent drills and ad-hoc runs. Every KPI on the app links here.</div>
          <DrilledList />
        </div>
      )}

      {shareOpenFor && (
        <ShareReportDrawer
          open={!!shareOpenFor}
          onOpenChange={(v) => !v && setShareOpenFor(null)}
          reportId={shareOpenFor}
        />
      )}
    </div>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function MyReportsTable({
  rows,
  readonly,
  onDelete,
  onDuplicate,
  onShare,
}: {
  rows: ReportDef[];
  readonly?: boolean;
  onDelete: (id: string) => void;
  onDuplicate: (r: ReportDef) => void;
  onShare?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="border rounded-xl bg-surface p-10 text-center">
        <div className="font-display text-[18px]">Nothing here yet.</div>
        <div className="text-sm text-muted-foreground mt-1">Start from a firm template, or build one from scratch.</div>
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden bg-surface">
      <table className="w-full editorial-table">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Name</th>
            <th className="text-left px-4 py-3 font-medium">Visibility</th>
            <th className="text-left px-4 py-3 font-medium">Last run</th>
            <th className="text-left px-4 py-3 font-medium">Schedule</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-4 py-3">
                <div className="font-medium">
                  <Link to="/reports/$id" params={{ id: r.id }} className="hover:text-accent">{r.name}</Link>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{datasetMeta(r.dataset).label}</div>
              </td>
              <td className="px-4 py-3">
                <Chip tone={visibilityTone(r.visibility)}>{r.visibility}</Chip>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{fmtDate(r.lastRunAt)}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.schedule ? `${r.schedule.cadence} · ${r.schedule.channel}` : "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link to="/reports/$id" params={{ id: r.id }}>
                    <Button size="sm" variant="ghost" className="h-7 px-2"><Play className="h-3.5 w-3.5 mr-1" />Run</Button>
                  </Link>
                  {onShare && !readonly && (
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onShare(r.id)}>
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!readonly && (
                    <Link to="/reports/$id/edit" params={{ id: r.id }}>
                      <Button size="sm" variant="ghost" className="h-7 px-2"><Pencil className="h-3.5 w-3.5" /></Button>
                    </Link>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onDuplicate(r)}><Copy className="h-3.5 w-3.5" /></Button>
                  {!readonly && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => onDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SharedTable({ rows, onUseAsTemplate }: { rows: ReportDef[]; onUseAsTemplate: (r: ReportDef) => void }) {
  const { data: users } = useUsers();
  if (rows.length === 0) {
    return (
      <div className="border rounded-xl bg-surface p-10 text-center">
        <div className="font-display text-[18px]">Nothing shared with you yet.</div>
        <div className="text-sm text-muted-foreground mt-1">Reports shared at Team/Practice scope or sent to you directly appear here.</div>
      </div>
    );
  }
  return (
    <div className="border rounded-lg overflow-hidden bg-surface">
      <table className="w-full editorial-table">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-4 font-medium">Report</th>
            <th className="text-left px-4 py-4 font-medium">Owner</th>
            <th className="text-left px-4 py-4 font-medium">Visibility</th>
            <th className="text-right px-4 py-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const owner = users.find((u) => u.id === r.ownerId);
            return (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-4 align-top">
                  <Link to="/reports/$id" params={{ id: r.id }} className="font-medium hover:text-accent font-display text-[15px]">
                    {r.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{datasetMeta(r.dataset).label}</div>
                  {r.description && <div className="text-xs text-muted-foreground mt-1">{r.description}</div>}
                </td>
                <td className="px-4 py-4 align-top">
                  {owner ? (
                    <div>
                      <div className="text-[13px]">{owner.fullName}</div>
                      <div className="text-[11px] text-muted-foreground">{owner.roles[0]}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-4 align-top">
                  <Chip tone={visibilityTone(r.visibility)}>{r.visibility}</Chip>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onUseAsTemplate(r)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />Use as template
                    </Button>
                    <Link to="/reports/$id" params={{ id: r.id }}>
                      <Button size="sm" className="h-7 px-2"><Play className="h-3.5 w-3.5 mr-1" />Run</Button>
                    </Link>
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