import type { MISBoard, ReportDef, User } from "@/types";
import { firmTemplates } from "@/mocks/reports";
import { datasetMeta } from "@/lib/report-engine";
import { COCKPIT_WIDGETS } from "@/mocks/mis-boards";

/** Resolve a widget's underlying report definition (user report, template override, or firm template). */
export function resolveReport(
  reportId: string,
  reports: ReportDef[],
  templateOverrides: Record<string, ReportDef>,
): ReportDef | undefined {
  return reports.find((r) => r.id === reportId) ?? templateOverrides[reportId] ?? firmTemplates.find((r) => r.id === reportId);
}

/** True if the viewer can actually run this widget (dataset not gated for their role). */
export function canViewerRunReport(user: User, def: ReportDef): boolean {
  const ds = datasetMeta(def.dataset);
  if (ds.gated && ds.gated(user)) return false;
  return true;
}

/** Board visible to user? Owner OR shared with them OR public (Team/Practice/Firm-template). */
export function canSeeBoard(user: User, board: MISBoard, shares: string[] | undefined): boolean {
  if (board.ownerId === user.id) return true;
  if ((shares ?? []).includes(user.id)) return true;
  return board.visibility !== "Private";
}

export function widgetGridClass(size: "sm" | "md" | "lg"): string {
  if (size === "lg") return "col-span-12";
  if (size === "md") return "col-span-12 lg:col-span-6";
  return "col-span-12 sm:col-span-6 lg:col-span-3";
}

export function isCockpitWidget(reportId: string): boolean {
  return reportId in COCKPIT_WIDGETS;
}