import type {
  Client,
  Hearing,
  Matter,
  MISBoard,
  NonBillableWork,
  ReportAggregate,
  ReportDataset,
  ReportDef,
  ReportFilter,
  ReportVisibility,
  Role,
  RTB,
  Task,
  TimeEntry,
  User,
} from "@/types";

// ---------- Field metadata ----------

export type FieldType = "string" | "number" | "currency" | "date" | "enum" | "bool";

export interface FieldMeta {
  key: string;
  label: string;
  type: FieldType;
  enumValues?: string[];
  gated?: (user: User) => boolean; // true => locked/unselectable
  gateReason?: string;
  aggregatable?: boolean;
  hint?: string;
}

const MONEY_HIDDEN: Role[] = ["Paralegal", "Court Staff"];
export const isMoneyHidden = (u: User) => u.roles.some((r) => MONEY_HIDDEN.includes(r));
export const isPipelineAllowed = (u: User) =>
  u.roles.some((r) =>
    ["Team Manager", "Admin Manager", "DB Admin", "Group Head", "Practice Head", "Executive Head", "Management", "Checker", "Master Docketer"].includes(r),
  );
export const isBillingAllowed = (u: User) => !isMoneyHidden(u);
export const isNarrativeVisible = (u: User) =>
  u.roles.some((r) =>
    ["Case Partner", "Case Manager", "Team Manager", "Admin Manager", "Group Head", "Practice Head", "Executive Head", "Management"].includes(r),
  );

export interface DatasetMeta {
  key: ReportDataset;
  label: string;
  description: string;
  fields: FieldMeta[];
  gated?: (user: User) => boolean;
  gateReason?: string;
}

export const DATASETS: DatasetMeta[] = [
  {
    key: "matters",
    label: "Matters",
    description: "Every matter, filterable by status, category, and team.",
    fields: [
      { key: "matterId", label: "Matter ID", type: "string" },
      { key: "title", label: "Title", type: "string" },
      { key: "clientName", label: "Client", type: "string" },
      { key: "casePartnerName", label: "Case Partner", type: "string" },
      { key: "caseManagerName", label: "Case Manager", type: "string" },
      { key: "branch", label: "Branch", type: "enum", enumValues: ["New Delhi", "Mumbai", "Nagpur", "Bengaluru"] },
      { key: "category", label: "Category", type: "string" },
      { key: "subCategory", label: "Sub category", type: "string" },
      { key: "deliverable", label: "Deliverable", type: "string" },
      { key: "status", label: "Status", type: "enum", enumValues: ["Ongoing", "Completed"] },
      { key: "pipelineState", label: "Pipeline state", type: "enum", enumValues: ["Pending", "Approved", "Rejected", "Abandoned"] },
      { key: "allocationState", label: "Allocation", type: "enum", enumValues: ["Unallocated", "Allocated"] },
      { key: "complexity", label: "Complexity", type: "enum", enumValues: ["Low", "Medium", "High"] },
      { key: "feeQuote", label: "Fee quote", type: "currency", gated: isMoneyHidden, gateReason: "Money hidden for your role", aggregatable: true },
      { key: "feeQuoteStatus", label: "Fee quote status", type: "enum", enumValues: ["Not sent", "Sent", "Accepted", "Rejected"] },
      { key: "createdAt", label: "Created", type: "date" },
      { key: "referenceDate", label: "Reference date", type: "date" },
    ],
  },
  {
    key: "time",
    label: "Time",
    description: "Timesheet entries. Narratives are restricted to the matter team and approvers.",
    fields: [
      { key: "userName", label: "Person", type: "string" },
      { key: "matterIdShort", label: "Matter", type: "string" },
      { key: "matterTitle", label: "Matter title", type: "string" },
      { key: "clientName", label: "Client", type: "string" },
      { key: "date", label: "Date", type: "date" },
      { key: "hours", label: "Hours", type: "number", aggregatable: true },
      { key: "activityType", label: "Activity", type: "string" },
      { key: "billable", label: "Billable", type: "bool" },
      { key: "status", label: "Status", type: "enum", enumValues: ["Draft", "Submitted", "Approved", "Queried"] },
      { key: "narrative", label: "Narrative", type: "string", gated: (u) => !isNarrativeVisible(u), gateReason: "Narratives restricted to matter team and approvers" },
    ],
  },
  {
    key: "billing",
    label: "Billing / RTB",
    description: "RTBs, invoices, and outstanding amounts.",
    gated: (u) => !isBillingAllowed(u),
    gateReason: "Billing hidden for your role",
    fields: [
      { key: "rtbNo", label: "RTB No.", type: "string" },
      { key: "matterIdShort", label: "Matter", type: "string" },
      { key: "clientName", label: "Client", type: "string" },
      { key: "casePartnerName", label: "Case Partner", type: "string" },
      { key: "billedByName", label: "Billed by", type: "string" },
      { key: "billingAmount", label: "Billing amount", type: "currency", aggregatable: true },
      { key: "outstandingAmount", label: "Outstanding", type: "currency", aggregatable: true },
      { key: "status", label: "Status", type: "enum", enumValues: ["Draft", "Pending Approval", "Approved", "Invoiced", "Paid", "Cancellation Requested", "Written Off", "Voided"] },
      { key: "invoiceDate", label: "Invoice date", type: "date" },
      { key: "invoiceMonth", label: "Invoice month", type: "string" },
    ],
  },
  {
    key: "hearings",
    label: "Hearings",
    description: "Court appearances and results.",
    fields: [
      { key: "matterIdShort", label: "Matter", type: "string" },
      { key: "clientName", label: "Client", type: "string" },
      { key: "forum", label: "Forum", type: "enum", enumValues: ["CESTAT Delhi", "GSTAT", "Delhi High Court", "Supreme Court", "Commissioner (Appeals)"] },
      { key: "date", label: "Hearing date", type: "date" },
      { key: "nextDate", label: "Next date", type: "date" },
      { key: "result", label: "Result", type: "string" },
      { key: "appearedByName", label: "Appeared by", type: "string" },
      { key: "readiness", label: "Readiness", type: "enum", enumValues: ["Ready", "Prep pending"] },
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Everything on somebody's plate.",
    fields: [
      { key: "subject", label: "Task", type: "string" },
      { key: "taskType", label: "Type", type: "string" },
      { key: "matterIdShort", label: "Matter", type: "string" },
      { key: "assigneeName", label: "Assignee", type: "string" },
      { key: "dueDate", label: "Due", type: "date" },
      { key: "priority", label: "Priority", type: "enum", enumValues: ["High", "Normal"] },
      { key: "status", label: "Status", type: "enum", enumValues: ["Open", "Completed"] },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    description: "The client registry.",
    fields: [
      { key: "name", label: "Client", type: "string" },
      { key: "sector", label: "Sector", type: "string" },
      { key: "subSector", label: "Sub sector", type: "string" },
      { key: "state", label: "State", type: "string" },
      { key: "city", label: "City", type: "string" },
      { key: "status", label: "Status", type: "enum", enumValues: ["active", "pending_master"] },
      { key: "activeMatters", label: "Active matters", type: "number", aggregatable: true },
      { key: "realizationRate", label: "Realisation %", type: "number", aggregatable: true },
    ],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    description: "Mails, makers, checkers, throughput.",
    gated: (u) => !isPipelineAllowed(u),
    gateReason: "Pipeline reports for TM, Admin and Leadership",
    fields: [
      { key: "matterIdShort", label: "Matter", type: "string" },
      { key: "title", label: "Title", type: "string" },
      { key: "pipelineState", label: "State", type: "enum", enumValues: ["Pending", "Approved", "Rejected", "Abandoned"] },
      { key: "makerName", label: "Maker", type: "string" },
      { key: "checkerName", label: "Checker", type: "string" },
      { key: "createdAt", label: "Created", type: "date" },
      { key: "createdVia", label: "Created via", type: "enum", enumValues: ["mail", "manual"] },
    ],
  },
  {
    key: "nonbillable",
    label: "Non billable",
    description: "Articles, newsletters, seminars.",
    fields: [
      { key: "userName", label: "Person", type: "string" },
      { key: "kind", label: "Kind", type: "enum", enumValues: ["Article", "Newsletter", "Conference", "Seminar", "Webinar"] },
      { key: "title", label: "Title", type: "string" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status", type: "enum", enumValues: ["Submitted", "Approved", "Rejected"] },
    ],
  },
];

export const datasetMeta = (k: ReportDataset): DatasetMeta =>
  DATASETS.find((d) => d.key === k) ?? DATASETS[0];

export const fieldMeta = (k: ReportDataset, key: string): FieldMeta | undefined =>
  datasetMeta(k).fields.find((f) => f.key === key);

// ---------- Row extractors ----------

export interface RunContext {
  user: User;
  users: User[];
  clients: Client[];
  matters: Matter[];
  time: TimeEntry[];
  rtbs: RTB[];
  hearings: Hearing[];
  tasks: Task[];
  nb: NonBillableWork[];
}

type Row = Record<string, unknown>;

const uname = (users: User[], id?: string) => (id ? users.find((u) => u.id === id)?.fullName ?? "" : "");
const cname = (clients: Client[], id: string) => clients.find((c) => c.id === id)?.name ?? "";
const shortMatter = (m?: Matter) => (m ? `#${m.matterId}` : "");

function matterRows(c: RunContext): Row[] {
  return c.matters.map((m) => ({
    _id: m.id,
    matterId: `#${m.matterId}`,
    _matter: m,
    title: m.title,
    clientName: cname(c.clients, m.clientId),
    casePartnerName: uname(c.users, m.casePartnerId),
    caseManagerName: uname(c.users, m.caseManagerId),
    branch: m.branch,
    category: m.category,
    subCategory: m.subCategory,
    deliverable: m.deliverable,
    status: m.status,
    pipelineState: m.pipelineState,
    allocationState: m.allocationState,
    complexity: m.complexity ?? "",
    feeQuote: m.feeQuote ?? 0,
    feeQuoteStatus: m.feeQuoteStatus ?? "",
    createdAt: m.createdAt,
    referenceDate: m.referenceDate ?? "",
  }));
}

function timeRows(c: RunContext): Row[] {
  return c.time.map((t) => {
    const m = c.matters.find((x) => x.id === t.matterId);
    return {
      _id: t.id,
      _userId: t.userId,
      _matterId: t.matterId,
      userName: uname(c.users, t.userId),
      matterIdShort: shortMatter(m),
      matterTitle: m?.title ?? "",
      clientName: m ? cname(c.clients, m.clientId) : "",
      date: t.date,
      hours: +(t.hours + t.minutes / 60).toFixed(2),
      activityType: t.activityType,
      billable: t.billable,
      status: t.status,
      narrative: t.narrative,
    };
  });
}

function billingRows(c: RunContext): Row[] {
  return c.rtbs.map((r) => {
    const m = c.matters.find((x) => x.id === r.matterId);
    const invMonth = r.invoiceDate ? r.invoiceDate.slice(0, 7) : "";
    return {
      _id: r.id,
      _matterId: r.matterId,
      rtbNo: r.rtbNo,
      matterIdShort: shortMatter(m),
      clientName: m ? cname(c.clients, m.clientId) : "",
      casePartnerName: m ? uname(c.users, m.casePartnerId) : "",
      billedByName: uname(c.users, r.billedBy),
      billingAmount: r.billingAmount,
      outstandingAmount: r.outstandingAmount,
      status: r.status,
      invoiceDate: r.invoiceDate ?? "",
      invoiceMonth: invMonth,
    };
  });
}

function hearingRows(c: RunContext): Row[] {
  return c.hearings.map((h) => {
    const m = c.matters.find((x) => x.id === h.matterId);
    return {
      _id: h.id,
      _matterId: h.matterId,
      matterIdShort: shortMatter(m),
      clientName: m ? cname(c.clients, m.clientId) : "",
      forum: h.forum,
      date: h.date,
      nextDate: h.nextDate ?? "",
      result: h.result ?? "",
      appearedByName: uname(c.users, h.appearedById),
      readiness: h.readiness,
    };
  });
}

function taskRows(c: RunContext): Row[] {
  return c.tasks.map((t) => {
    const m = t.matterId ? c.matters.find((x) => x.id === t.matterId) : undefined;
    return {
      _id: t.id,
      _matterId: t.matterId ?? "",
      _assigneeId: t.assigneeId,
      subject: t.subject,
      taskType: t.taskType,
      matterIdShort: shortMatter(m),
      assigneeName: uname(c.users, t.assigneeId),
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
    };
  });
}

function clientRows(c: RunContext): Row[] {
  return c.clients.map((cl) => ({
    _id: cl.id,
    name: cl.name,
    sector: cl.sector,
    subSector: cl.subSector,
    state: cl.state,
    city: cl.city,
    status: cl.status,
    activeMatters: cl.activeMatters,
    realizationRate: cl.realizationRate,
  }));
}

function pipelineRows(c: RunContext): Row[] {
  return c.matters.map((m) => ({
    _id: m.id,
    matterIdShort: `#${m.matterId}`,
    title: m.title,
    pipelineState: m.pipelineState,
    makerName: uname(c.users, m.makerId),
    checkerName: uname(c.users, m.checkerId),
    createdAt: m.createdAt,
    createdVia: m.createdVia,
  }));
}

function nonbillableRows(c: RunContext): Row[] {
  return c.nb.map((n) => ({
    _id: n.id,
    _userId: n.userId,
    userName: uname(c.users, n.userId),
    kind: n.kind,
    title: n.title,
    date: n.date,
    status: n.status,
  }));
}

function extract(dataset: ReportDataset, c: RunContext): Row[] {
  switch (dataset) {
    case "matters": return matterRows(c);
    case "time": return timeRows(c);
    case "billing": return billingRows(c);
    case "hearings": return hearingRows(c);
    case "tasks": return taskRows(c);
    case "clients": return clientRows(c);
    case "pipeline": return pipelineRows(c);
    case "nonbillable": return nonbillableRows(c);
  }
}

// ---------- Scope trim ----------

function isLeadershipish(u: User): boolean {
  return u.roles.some((r) =>
    ["Group Head", "Practice Head", "Executive Head", "Management", "Admin Manager", "DB Admin", "Team Manager", "HR", "Accounts"].includes(r),
  );
}
function isPartnerish(u: User): boolean {
  return u.roles.some((r) => ["Case Partner", "Case Manager"].includes(r));
}

/** Returns a rowFilter + a human-readable scope line. */
export function scopeFor(user: User, dataset: ReportDataset, c: RunContext): { filter: (row: Row) => boolean; line: string } {
  const uid = user.id;
  if (dataset === "clients" || dataset === "pipeline") {
    return { filter: () => true, line: "Showing: firm" };
  }
  if (isLeadershipish(user)) return { filter: () => true, line: "Showing: firm" };

  if (dataset === "matters" || dataset === "hearings") {
    const teamMatterIds = new Set<string>(
      c.matters
        .filter((m) => m.casePartnerId === uid || m.caseManagerId === uid || m.caseAssociateIds.includes(uid) || m.paralegalIds.includes(uid))
        .map((m) => m.id),
    );
    return {
      filter: (r) => teamMatterIds.has((r._id as string) ?? (r._matterId as string)),
      line: isPartnerish(user) ? "Showing: your team's matters" : "Showing: your matters",
    };
  }
  if (dataset === "billing") {
    if (isPartnerish(user)) {
      // rows where CP is me, or billedBy is me
      const mineMatterIds = new Set(c.matters.filter((m) => m.casePartnerId === uid).map((m) => m.id));
      return { filter: (r) => (r._matterId ? mineMatterIds.has(r._matterId as string) : false), line: "Showing: your matters' billing" };
    }
    return { filter: () => false, line: "Showing: billing hidden for your role" };
  }
  if (dataset === "time") {
    if (isPartnerish(user)) {
      const teamUserIds = new Set<string>();
      c.matters.forEach((m) => {
        if (m.casePartnerId === uid || m.caseManagerId === uid) {
          [m.caseManagerId, ...m.caseAssociateIds, ...m.paralegalIds].forEach((x) => x && teamUserIds.add(x));
          teamUserIds.add(uid);
        }
      });
      return { filter: (r) => teamUserIds.has(r._userId as string), line: "Showing: your team's time" };
    }
    return { filter: (r) => (r._userId as string) === uid, line: "Showing: your time" };
  }
  if (dataset === "tasks") {
    if (isPartnerish(user)) {
      const teamMatterIds = new Set(c.matters.filter((m) => m.casePartnerId === uid || m.caseManagerId === uid).map((m) => m.id));
      return {
        filter: (r) => (r._assigneeId as string) === uid || teamMatterIds.has(r._matterId as string),
        line: "Showing: your team's tasks",
      };
    }
    return { filter: (r) => (r._assigneeId as string) === uid, line: "Showing: your tasks" };
  }
  if (dataset === "nonbillable") {
    return { filter: (r) => (r._userId as string) === uid, line: "Showing: your non billable" };
  }
  return { filter: () => true, line: "Showing: firm" };
}

// ---------- Filters ----------

function fyStart(): Date {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 3, 1);
}

function relativeRange(token: string): { from: Date; to: Date } | null {
  const now = new Date();
  if (token === "this_fy") return { from: fyStart(), to: now };
  if (token === "last_30d") {
    const from = new Date(); from.setDate(from.getDate() - 30);
    return { from, to: now };
  }
  if (token === "last_7d") {
    const from = new Date(); from.setDate(from.getDate() - 7);
    return { from, to: now };
  }
  if (token === "this_month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  return null;
}

function matchFilter(row: Row, f: ReportFilter, user: User): boolean {
  if (f.op === "smart") {
    if (f.value === "my_matters") {
      const mid = (row._matterId as string) ?? (row._id as string);
      return typeof mid === "string" && mid.length > 0;
    }
    if (f.value === "my_team") return true;
    return true;
  }
  const v = row[f.field];
  if (f.op === "eq") return String(v) === String(f.value);
  if (f.op === "neq") return String(v) !== String(f.value);
  if (f.op === "in") return Array.isArray(f.value) && (f.value as string[]).includes(String(v));
  if (f.op === "contains") return String(v ?? "").toLowerCase().includes(String(f.value ?? "").toLowerCase());
  if (f.op === "gte") return Number(v) >= Number(f.value);
  if (f.op === "lte") return Number(v) <= Number(f.value);
  if (f.op === "between") {
    const b = f.value as { from?: string; to?: string };
    const t = new Date(String(v)).getTime();
    if (Number.isNaN(t)) return false;
    if (b.from && t < new Date(b.from).getTime()) return false;
    if (b.to && t > new Date(b.to).getTime()) return false;
    return true;
  }
  if (f.op === "relative") {
    const range = relativeRange(String(f.value));
    if (!range) return true;
    const t = new Date(String(v)).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  }
  return true;
  void user;
}

// ---------- Aggregation ----------

function groupKey(row: Row, keys: string[]): string {
  return keys.map((k) => String(row[k] ?? "")).join("§");
}

export interface RunResult {
  rows: Row[]; // filtered, sorted, capped
  grouped?: {
    columns: string[]; // group columns + aggregate columns (aliased)
    rows: Row[];
  };
  scopeLine: string;
  total: number;
}

export function runReport(def: ReportDef, c: RunContext): RunResult {
  const raw = extract(def.dataset, c);
  const scope = scopeFor(c.user, def.dataset, c);
  let rows = raw.filter((r) => scope.filter(r));
  for (const f of def.filters) rows = rows.filter((r) => matchFilter(r, f, c.user));
  if (def.sortBy) {
    const { field, dir } = def.sortBy;
    rows = [...rows].sort((a, b) => {
      const av = a[field], bv = b[field];
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av ?? "").localeCompare(String(bv ?? "")) : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }
  const total = rows.length;
  if (def.limit && def.limit > 0) rows = rows.slice(0, def.limit);

  let grouped: RunResult["grouped"];
  if (def.groupBy.length > 0) {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = groupKey(r, def.groupBy);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    const aggRows: Row[] = [];
    for (const [key, arr] of groups) {
      const parts = key.split("§");
      const row: Row = {};
      def.groupBy.forEach((g, i) => { row[g] = parts[i]; });
      for (const a of def.aggregates) {
        const label = a.label ?? `${a.fn}_${a.field}`;
        if (a.fn === "count") row[label] = arr.length;
        else {
          const nums = arr.map((r) => Number(r[a.field] ?? 0)).filter((n) => !Number.isNaN(n));
          if (a.fn === "sum") row[label] = nums.reduce((s, n) => s + n, 0);
          if (a.fn === "avg") row[label] = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        }
      }
      aggRows.push(row);
    }
    grouped = {
      columns: [...def.groupBy, ...def.aggregates.map((a) => a.label ?? `${a.fn}_${a.field}`)],
      rows: aggRows,
    };
  }
  return { rows, grouped, scopeLine: scope.line, total };
}

// ---------- Visibility grants ----------

export function canGrantVisibility(u: User, v: ReportVisibility): boolean {
  if (v === "Private") return true;
  if (v === "Team") return true;
  if (v === "Practice") return u.roles.some((r) => ["Case Partner", "Practice Head", "Executive Head", "Management", "Admin Manager"].includes(r));
  if (v === "Firm-template") return u.roles.some((r) => ["Practice Head", "Executive Head", "Management", "Admin Manager"].includes(r));
  return false;
}

export function canSeeReport(u: User, def: ReportDef): boolean {
  if (def.ownerId === u.id) return true;
  if (def.visibility === "Firm-template") return true;
  if (def.visibility === "Practice") return true; // simplification for demo
  if (def.visibility === "Team") return true;
  return false;
}

// ---------- Utilities for builder UI ----------

export function defaultReport(user: User, dataset: ReportDataset, name = "Untitled report"): ReportDef {
  const ds = datasetMeta(dataset);
  const cols = ds.fields.slice(0, 5).filter((f) => !f.gated?.(user)).map((f) => f.key);
  const now = new Date().toISOString();
  return {
    id: `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ownerId: user.id,
    name,
    description: "",
    dataset,
    columns: cols,
    columnLabels: {},
    filters: [],
    groupBy: [],
    aggregates: [],
    viz: "Table",
    format: { density: "editorial", currency: "inr" },
    visibility: "Private",
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateAsPrivate(def: ReportDef, user: User, suffix = " (copy)"): ReportDef {
  const now = new Date().toISOString();
  return {
    ...def,
    id: `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ownerId: user.id,
    name: def.name + suffix,
    visibility: "Private",
    isTemplate: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastRunAt: undefined,
    schedule: undefined,
    sourceTemplateId: def.isTemplate ? def.id : def.sourceTemplateId,
  };
}

export type { MISBoard };