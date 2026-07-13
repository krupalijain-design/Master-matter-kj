import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, ChevronUp, Lock, MoreHorizontal, Trash2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatINR, cx } from "@/lib/format";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { useRunContext } from "@/components/reports/useRunContext";
import { runReport } from "@/lib/report-engine";
import { COCKPIT_WIDGETS } from "@/mocks/mis-boards";
import { canViewerRunReport, resolveReport, widgetGridClass, isCockpitWidget } from "@/lib/mis";
import { useAppStore } from "@/store/app-store";
import type { MISBoardWidget } from "@/types";
import { useRtbs, useMatters } from "@/hooks/use-data";

function stamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function MISWidget({
  boardId,
  widget,
  editable,
  onMove,
  onRemove,
  onResize,
}: {
  boardId: string;
  widget: MISBoardWidget;
  editable: boolean;
  onMove?: (dir: -1 | 1) => void;
  onRemove?: () => void;
  onResize?: (size: "sm" | "md" | "lg") => void;
}) {
  const reports = useAppStore((s) => s.reports);
  const templateOverrides = useAppStore((s) => s.templateOverrides);
  const ctx = useRunContext();
  const { data: rtbs } = useRtbs();
  const { data: matters } = useMatters();
  void boardId;

  if (isCockpitWidget(widget.reportId)) {
    return (
      <div className={cx(widgetGridClass(widget.size), "bg-surface border rounded-xl p-4 flex flex-col min-h-[220px]")}>
        <WidgetHeader
          title={widget.title ?? COCKPIT_WIDGETS[widget.reportId].name}
          scope="Firm cockpit · pinned"
          editable={editable}
          onMove={onMove}
          onRemove={onRemove}
          onResize={onResize}
          currentSize={widget.size}
          openHref="/cockpit/firm"
        />
        {widget.reportId === "cockpit-funnel" ? (
          <CockpitFunnelStat rtbs={rtbs} matters={matters} />
        ) : (
          <CockpitLeadingStat rtbs={rtbs} matters={matters} />
        )}
      </div>
    );
  }

  const def = resolveReport(widget.reportId, reports, templateOverrides);
  if (!def) {
    return (
      <div className={cx(widgetGridClass(widget.size), "bg-surface border rounded-xl p-4 flex flex-col min-h-[160px]")}>
        <WidgetHeader title={widget.title ?? "Deleted report"} scope="Source report no longer exists" editable={editable} onMove={onMove} onRemove={onRemove} onResize={onResize} currentSize={widget.size} />
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Remove this widget or replace it.</div>
      </div>
    );
  }

  const gated = !canViewerRunReport(ctx.user, def);
  const runResult = useMemo(() => (gated ? null : runReport(def, ctx)), [gated, def, ctx]);

  return (
    <div className={cx(widgetGridClass(widget.size), "bg-surface border rounded-xl p-4 flex flex-col min-h-[220px]")}>
      <WidgetHeader
        title={widget.title ?? def.name}
        scope={gated ? "Locked for your role" : (runResult?.scopeLine ?? "Showing: firm")}
        editable={editable}
        onMove={onMove}
        onRemove={onRemove}
        onResize={onResize}
        currentSize={widget.size}
        openHref={`/reports/$id`}
        openParams={{ id: def.id }}
        openSearch={{ origin: "MIS board" }}
        stampAt={stamp()}
        versionChip={`v${def.version}`}
      />
      {gated ? (
        <div className="flex-1 flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
          <Lock className="h-4 w-4" />
          <span>Dataset restricted for your role.</span>
        </div>
      ) : widget.viz === "Table" && widget.size === "sm" ? (
        <StatBlock label={def.aggregates[0]?.label ?? "Rows"} value={String(runResult?.total ?? 0)} />
      ) : (
        <div className="flex-1 overflow-hidden">
          <ReportPreview def={{ ...def, viz: widget.viz, limit: widget.size === "sm" ? 5 : def.limit ?? 10 }} ctx={ctx} showScopeLine={false} compact />
        </div>
      )}
    </div>
  );
}

function WidgetHeader({
  title, scope, editable, onMove, onRemove, onResize, currentSize, openHref, openParams, openSearch, stampAt, versionChip,
}: {
  title: string;
  scope: string;
  editable: boolean;
  onMove?: (dir: -1 | 1) => void;
  onRemove?: () => void;
  onResize?: (size: "sm" | "md" | "lg") => void;
  currentSize: "sm" | "md" | "lg";
  openHref?: string;
  openParams?: Record<string, string>;
  openSearch?: Record<string, string>;
  stampAt?: string;
  versionChip?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[16px] leading-tight truncate">{title}</h3>
          {versionChip && <Badge variant="outline" className="text-[9px] font-mono">{versionChip}</Badge>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {scope}{stampAt ? ` · updated ${stampAt}` : ""}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {openHref && (
            <DropdownMenuItem asChild>
              {openParams ? (
                <Link to={openHref as "/reports/$id"} params={openParams as { id: string }} search={openSearch as never}>
                  <ArrowUpRight className="h-3.5 w-3.5 mr-2" />Open full report
                </Link>
              ) : (
                <Link to={openHref as "/cockpit/firm"}>
                  <ArrowUpRight className="h-3.5 w-3.5 mr-2" />Open full view
                </Link>
              )}
            </DropdownMenuItem>
          )}
          {editable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onResize?.("sm")} disabled={currentSize === "sm"}><Maximize2 className="h-3.5 w-3.5 mr-2" />Small</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResize?.("md")} disabled={currentSize === "md"}><Maximize2 className="h-3.5 w-3.5 mr-2" />Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResize?.("lg")} disabled={currentSize === "lg"}><Maximize2 className="h-3.5 w-3.5 mr-2" />Large</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMove?.(-1)}><ChevronUp className="h-3.5 w-3.5 mr-2" />Move up</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMove?.(1)}><ChevronDown className="h-3.5 w-3.5 mr-2" />Move down</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRemove} className="text-danger"><Trash2 className="h-3.5 w-3.5 mr-2" />Remove</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-[36px] leading-none tabular-nums mt-1">{value}</div>
    </div>
  );
}

function CockpitFunnelStat({ rtbs, matters }: { rtbs: ReturnType<typeof useRtbs>["data"]; matters: ReturnType<typeof useMatters>["data"] }) {
  const wip = matters.filter((m) => m.status === "Ongoing").length;
  const billed = rtbs.filter((r) => r.status === "Invoiced" || r.status === "Paid").reduce((s, r) => s + r.billingAmount, 0);
  const collected = rtbs.filter((r) => r.status === "Paid").reduce((s, r) => s + r.billingAmount, 0);
  return (
    <div className="grid grid-cols-3 gap-3 flex-1">
      <FunnelCol label="WIP matters" value={wip.toLocaleString("en-IN")} />
      <FunnelCol label="Billed" value={formatINR(billed)} />
      <FunnelCol label="Collected" value={formatINR(collected)} />
    </div>
  );
}

function CockpitLeadingStat({ rtbs, matters }: { rtbs: ReturnType<typeof useRtbs>["data"]; matters: ReturnType<typeof useMatters>["data"] }) {
  const outstanding = rtbs.reduce((s, r) => s + r.outstandingAmount, 0);
  const unallocated = matters.filter((m) => m.allocationState === "Unallocated").length;
  return (
    <div className="grid grid-cols-2 gap-3 flex-1">
      <FunnelCol label="Outstanding" value={formatINR(outstanding)} />
      <FunnelCol label="Unallocated matters" value={unallocated.toLocaleString("en-IN")} />
    </div>
  );
}

function FunnelCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3 bg-muted/30 flex flex-col justify-between">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-[24px] leading-tight mt-2 tabular-nums">{value}</div>
    </div>
  );
}