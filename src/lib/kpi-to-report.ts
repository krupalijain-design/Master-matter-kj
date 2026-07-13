import type { ReportDef, ReportDataset, ReportFilter, ReportVisibility } from "@/types";

export type SaveKind = "matters" | "rtb" | "time" | "pipeline" | "hearings" | "nonbillable";

export interface KpiSaveSpec {
  /** Cockpit drill kind (`matters` or `rtb`) or an explicit dataset for non-drill widgets. */
  kind: SaveKind;
  /** Cockpit drill filter token, e.g. "active-matters-firm". Free-form; best-effort translation. */
  filter?: string;
  /** Human-readable KPI or drill label — becomes the report name. */
  name: string;
  /** Optional richer description shown in the report header. */
  description?: string;
  /** Optional viz override; defaults to Table. */
  viz?: ReportDef["viz"];
}

const kindToDataset: Record<SaveKind, ReportDataset> = {
  matters: "matters",
  rtb: "billing",
  time: "time",
  pipeline: "pipeline",
  hearings: "hearings",
  nonbillable: "nonbillable",
};

const defaultColumns: Record<ReportDataset, string[]> = {
  matters: ["matterId", "clientName", "title", "deliverable", "subCategory", "casePartnerName", "branch", "createdAt"],
  billing: ["rtbNo", "clientName", "matterIdShort", "billingAmount", "outstandingAmount", "status", "billedByName", "invoiceDate"],
  time: ["userName", "date", "matterIdShort", "activityType", "hours"],
  pipeline: ["matterIdShort", "title", "pipelineState", "makerName", "checkerName", "createdAt"],
  hearings: ["matterIdShort", "clientName", "forum", "date", "nextDate", "result", "readiness"],
  tasks: ["subject", "taskType", "matterIdShort", "assigneeName", "dueDate", "priority", "status"],
  clients: ["name", "sector", "state", "status", "activeMatters"],
  nonbillable: ["userName", "kind", "title", "date", "status"],
};

/** Best-effort translation from cockpit drill filters to first-class ReportFilter rows. */
function filtersFromDrill(dataset: ReportDataset, filter: string | undefined): ReportFilter[] {
  if (!filter) return [];
  const f = (field: string, op: ReportFilter["op"], value: ReportFilter["value"]): ReportFilter => ({
    id: `f-${field}-${Math.random().toString(36).slice(2, 6)}`, field, op, value,
  });

  if (dataset === "matters") {
    if (filter === "active-matters" || filter === "active-matters-firm" || filter === "coverage-by-team") return [f("status", "eq", "Ongoing")];
    if (filter === "aged-wip-firm" || filter === "aged-wip-60" || filter.startsWith("ageing:")) return [f("status", "eq", "Ongoing")];
    if (filter === "pipeline-pending-firm") return [f("pipelineState", "eq", "Pending")];
    if (filter === "unallocated") return [f("allocationState", "eq", "Unallocated")];
    if (filter === "customs-scn") return [f("subCategory", "eq", "Customs"), f("deliverable", "eq", "Reply to SCN"), f("status", "eq", "Ongoing")];
    if (filter === "retainership-fy26") return [f("deliverable", "eq", "Retainership"), f("status", "eq", "Ongoing")];
    if (filter === "status:ongoing" || filter === "deadline-14" || filter === "deadline-14-firm") return [f("status", "eq", "Ongoing")];
    if (filter === "status:awaiting-client" || filter === "status:stuck-30" || filter === "status:partial-details") return [f("status", "eq", "Ongoing")];
    return [];
  }
  if (dataset === "billing") {
    if (filter === "funnel-billed") return [f("status", "in", ["Invoiced", "Paid"])];
    if (filter === "funnel-collected") return [f("status", "eq", "Paid")];
    if (filter === "funnel-writeoff") return [f("status", "eq", "Written Off")];
    if (filter === "funnel-creditnote") return [f("status", "in", ["Cancellation Requested", "Voided"])];
    if (filter === "funnel-wip") return [f("outstandingAmount", "gte", 1)];
    if (filter === "rtb-net-fytd") return [f("status", "in", ["Invoiced", "Paid", "Approved"]), f("invoiceDate", "relative", "this_fy")];
    if (filter.startsWith("partner:")) return [];
    return [];
  }
  return [];
}

/** Build a runnable Private ReportDef from a cockpit KPI or drill spec. */
export function kpiToReport(spec: KpiSaveSpec, ownerId: string, visibility: ReportVisibility = "Private"): ReportDef {
  const dataset = kindToDataset[spec.kind];
  const now = new Date().toISOString();
  const id = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    ownerId,
    name: spec.name,
    description: spec.description ?? `Saved from cockpit${spec.filter ? ` · ${spec.filter}` : ""}.`,
    dataset,
    columns: defaultColumns[dataset],
    columnLabels: {},
    filters: filtersFromDrill(dataset, spec.filter),
    groupBy: [],
    aggregates: [],
    viz: spec.viz ?? "Table",
    format: { density: "editorial", currency: "inr" },
    visibility,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
