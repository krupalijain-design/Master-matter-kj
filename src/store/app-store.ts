import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, AuditEntry, ClientChangeRequest, ClientRequestComment, ClientRequestStatus, TimeEntry, RTB } from "@/types";
import type { NonBillableWork, ReportDef, MISBoard, MISBoardWidget } from "@/types";
import type { AutodocketConfig } from "@/lib/autodocket";
import { DEFAULT_AUTODOCKET_CONFIG } from "@/lib/autodocket";

export type MatterQuickFilter =
  | "partial-details"
  | "client-pending"
  | "pending-checker"
  | "not-synced"
  | "unallocated";

export type MatterTab = "all" | "ongoing" | "completed";

export interface MatterListView {
  id: string;
  name: string;
  tab: MatterTab;
  search: string;
  quickFilters: MatterQuickFilter[];
  columnKeys: string[];
  columnSearches: Record<string, string>;
}

export type CheckerRejectReason = "Duplicate" | "Wrong client" | "Incomplete" | "Other";

export interface MatterPipelineOverride {
  pipelineState: "Pending" | "Approved" | "Rejected" | "Abandoned";
  reason?: CheckerRejectReason;
  reasonNote?: string;
  duplicateOfMatterId?: string;
  actorId: string;
  actorRole: string;
  at: string;
}

export interface MailReassignment {
  fromUserId: string;
  toUserId: string;
  role: "Docketer" | "Maker" | "Checker" | "Master Docketer";
  at: string;
  note?: string;
}

export interface AutoFileRecord {
  mailId: string;
  matterId: string;
  confidence: number;
  at: string;
  sampled: boolean;
}

export type AuditVerdict = "correct" | "wrong";

export interface AuditSampleVerdict {
  mailId: string;
  verdict: AuditVerdict;
  reason?: string;
  at: string;
  actorId: string;
}

export interface MisfileReport {
  mailId: string;
  matterId: string;
  reporterId: string;
  reporterName: string;
  note?: string;
  at: string;
}

export interface ReportSubscription {
  id: string;
  reportId: string;
  subscriberId: string;
  cadence: "daily" | "weekly" | "monthly";
  channel: "email" | "in-app" | "teams";
  time: string;
  paused: boolean;
  createdAt: string;
}

export interface ReportDeliveryTraceStep {
  step: string;
  status: "ok" | "fail";
  at: string;
}

export interface ReportDelivery {
  at: string;
  status: "delivered" | "failed";
  errorId?: string;
  trace: ReportDeliveryTraceStep[];
}

type AppState = {
  currentUserId: string;
  currentRole: Role;
  railCollapsed: boolean;
  pinnedMatterIds: string[];
  matterColumnKeys: string[] | null;
  savedViews: MatterListView[];
  activeSavedViewId: string | null;
  quickTimeMatterId: string | null;
  quickTimeOpen: boolean;
  quickTimeContextDate: string | null;
  timeEntriesAdded: TimeEntry[];
  timeEntriesEdited: Record<string, Partial<TimeEntry>>;
  submittedWeeks: Record<string, { userId: string; at: string }[]>; // weekKey -> submissions
  rejectedSuggestionIds: string[];
  allocations: Record<string, { assigneeId: string; note?: string; at: string }>; // matterId -> assignment
  auditLog: AuditEntry[];
  downloadUsedBytes: number;
  downloadLimitBytes: number;
  clientRequestsAdded: ClientChangeRequest[];
  clientRequestOverrides: Record<string, {
    status?: ClientRequestStatus;
    makerId?: string;
    makerName?: string;
    checkerId?: string;
    checkerName?: string;
    updatedAt?: string;
    appendThread?: ClientRequestComment[];
  }>;
  approvedPendingClientIds: string[];
  clearedClientPendingMatterIds: string[];
  mutedClientIds: string[];
  matterPipelineOverrides: Record<string, MatterPipelineOverride>;
  mailPipelineReassignments: Record<string, MailReassignment>;
  autodocketConfig: AutodocketConfig;
  autoFileOverrides: Record<string, AutoFileRecord | null>; // null = revoked/rerouted
  auditVerdicts: Record<string, AuditSampleVerdict>;
  misfileReports: MisfileReport[];
  markedParts: Record<string, { attachmentName: string; parts: { label: string; pageRange: string }[] }[]>; // mailId → per-attachment parts
  tsApprovalOverrides: Record<string, "Approved" | "Queried">; // timeEntryId → status
  tsQueryThreads: Record<string, { authorId: string; authorName: string; body: string; at: string }[]>;
  rtbApprovalOverrides: Record<string, { status: RTB["status"]; reason?: string; at: string; actorId: string }>;
  writeOffOverrides: Record<string, { status: "Pending" | "Approved" | "Declined"; reason?: string; at: string }>;
  notificationOverrides: Record<string, { state?: "Unread" | "Read" | "Done" | "Snoozed"; snoozeUntil?: string; at?: string }>;
  notifPrefs: {
    matrix: Record<string, { inApp: boolean; email: boolean; teams: boolean; digestOnly: boolean }>;
    quietHours: { start: string; end: string };
    digestTime: string;
  };
  todayManualTasks: { id: string; subject: string; matterId?: string; assigneeId: string; dueDate: string; priority: "High" | "Normal"; createdAt: string; delegatedFromId?: string }[];
  todayCompletedIds: string[];
  todayDismissedIds: string[];
  todayReschedules: Record<string, string>;
  paymentPosts: Record<string, { amount: number; at: string; actorId: string; invoiceNo?: string }>;
  conflictReferrals: { id: string; matterTitle: string; byUserId: string; byUserName: string; at: string }[];
  nbAdditions: NonBillableWork[];
  nbStatusOverrides: Record<string, { status: NonBillableWork["status"]; approverId?: string; note?: string; decidedAt: string }>;
  userRoleOverrides: Record<string, Role[]>;
  queueMembership: { docketer: Record<string, number>; maker: Record<string, number>; checker: Record<string, number> };
  reports: ReportDef[];
  addReport: (r: ReportDef) => void;
  updateReport: (id: string, patch: Partial<ReportDef>) => void;
  deleteReport: (id: string) => void;
  touchReportRun: (id: string) => void;
  reportShares: Record<string, string[]>;
  reportSubscriptions: ReportSubscription[];
  reportDeliveries: Record<string, ReportDelivery>;
  templateOverrides: Record<string, ReportDef>;
  shareReportWith: (reportId: string, userIds: string[]) => void;
  addSubscription: (sub: ReportSubscription) => void;
  removeSubscription: (id: string) => void;
  setSubscriptionPaused: (id: string, paused: boolean) => void;
  recordReportDelivery: (key: string, delivery: ReportDelivery) => void;
  saveTemplateOverride: (def: ReportDef) => void;
  misBoards: MISBoard[];
  misBoardShares: Record<string, string[]>;
  misBoardDeliveries: Record<string, ReportDelivery>;
  addMISBoard: (b: MISBoard) => void;
  updateMISBoard: (id: string, patch: Partial<MISBoard>) => void;
  deleteMISBoard: (id: string) => void;
  addMISWidget: (boardId: string, widget: MISBoardWidget) => void;
  updateMISWidget: (boardId: string, widgetId: string, patch: Partial<MISBoardWidget>) => void;
  removeMISWidget: (boardId: string, widgetId: string) => void;
  moveMISWidget: (boardId: string, widgetId: string, dir: -1 | 1) => void;
  shareMISBoardWith: (boardId: string, userIds: string[]) => void;
  recordMISBoardDelivery: (boardId: string, delivery: ReportDelivery) => void;
  setCurrentRole: (role: Role) => void;
  setCurrentUser: (id: string, role: Role) => void;
  toggleRail: () => void;
  pinMatter: (id: string) => void;
  unpinMatter: (id: string) => void;
  setMatterColumnKeys: (keys: string[]) => void;
  addSavedView: (v: MatterListView) => void;
  removeSavedView: (id: string) => void;
  setActiveSavedViewId: (id: string | null) => void;
  openQuickTime: (matterId: string | null) => void;
  openQuickTimeWith: (ctx: { matterId?: string | null; date?: string | null }) => void;
  closeQuickTime: () => void;
  addTimeEntry: (te: TimeEntry) => void;
  updateTimeEntry: (id: string, patch: Partial<TimeEntry>) => void;
  submitWeek: (weekKey: string, userId: string) => void;
  rejectSuggestion: (id: string) => void;
  allocateMatter: (matterId: string, assigneeId: string, note?: string) => void;
  unallocateMatter: (matterId: string) => void;
  appendAudit: (entry: Omit<AuditEntry, "id" | "at">) => void;
  consumeDownload: (bytes: number) => boolean;
  resetDownloadBudget: () => void;
  addClientRequest: (req: ClientChangeRequest) => void;
  updateClientRequest: (id: string, patch: {
    status?: ClientRequestStatus;
    makerId?: string;
    makerName?: string;
    checkerId?: string;
    checkerName?: string;
  }) => void;
  appendClientRequestComment: (id: string, comment: ClientRequestComment) => void;
  approvePendingClient: (clientId: string) => void;
  toggleClientMute: (clientId: string) => void;
  setMatterPipelineOverride: (matterId: string, override: MatterPipelineOverride) => void;
  clearMatterPipelineOverride: (matterId: string) => void;
  rebalanceMail: (mailId: string, reassignment: MailReassignment) => void;
  undoRebalanceMail: (mailId: string) => void;
  updateAutodocketConfig: (patch: Partial<AutodocketConfig>) => void;
  recordAutoFile: (rec: AutoFileRecord) => void;
  revokeAutoFile: (mailId: string) => void;
  setAuditVerdict: (v: AuditSampleVerdict) => void;
  addMisfileReport: (r: MisfileReport) => void;
  addMarkedParts: (mailId: string, attachmentName: string, parts: { label: string; pageRange: string }[]) => void;
  approveTimeEntry: (id: string) => void;
  queryTimeEntry: (id: string, comment: { authorId: string; authorName: string; body: string }) => void;
  undoTimeEntryDecision: (id: string) => void;
  approveRTB: (id: string, actorId: string) => void;
  declineRTB: (id: string, reason: string, actorId: string) => void;
  voidRTB: (id: string, actorId: string) => void;
  setWriteOffStatus: (id: string, status: "Approved" | "Declined", reason?: string) => void;
  setNotificationState: (id: string, patch: { state?: "Unread" | "Read" | "Done" | "Snoozed"; snoozeUntil?: string }) => void;
  markAllNotificationsRead: (ids: string[]) => void;
  setNotifPrefCell: (category: string, channel: "inApp" | "email" | "teams" | "digestOnly", value: boolean) => void;
  setNotifQuietHours: (start: string, end: string) => void;
  setDigestTime: (t: string) => void;
  addTodayTask: (task: { id: string; subject: string; matterId?: string; assigneeId: string; dueDate: string; priority: "High" | "Normal"; delegatedFromId?: string }) => void;
  completeTodayRow: (id: string) => void;
  uncompleteTodayRow: (id: string) => void;
  dismissTodayRow: (id: string) => void;
  undoDismissTodayRow: (id: string) => void;
  rescheduleTodayRow: (id: string, isoDate: string) => void;
  delegateTodayRow: (sourceId: string, subject: string, matterId: string | undefined, toUserId: string, fromUserId: string, dueDate: string, priority: "High" | "Normal") => void;
  postPayment: (rtbId: string, amount: number, actorId: string, invoiceNo?: string) => void;
  addConflictReferral: (ref: { matterTitle: string; byUserId: string; byUserName: string }) => void;
  addNonBillable: (nb: NonBillableWork) => void;
  decideNonBillable: (id: string, status: "Approved" | "Rejected", approverId: string, note?: string) => void;
  setUserRoles: (userId: string, roles: Role[]) => void;
  setQueueWeight: (queue: "docketer" | "maker" | "checker", userId: string, weight: number) => void;
  demoDoneSteps: number[];
  demoOverlayOpen: boolean;
  toggleDemoStep: (n: number) => void;
  markDemoStep: (n: number) => void;
  resetDemoProgress: () => void;
  setDemoOverlayOpen: (open: boolean) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: "u-kavita",
      currentRole: "Case Partner",
      railCollapsed: false,
      pinnedMatterIds: ["m-1096264", "m-1096270", "m-1096281"],
      matterColumnKeys: null,
      savedViews: [],
      activeSavedViewId: null,
      quickTimeMatterId: null,
      quickTimeOpen: false,
      quickTimeContextDate: null,
      timeEntriesAdded: [],
      timeEntriesEdited: {},
      submittedWeeks: {},
      rejectedSuggestionIds: [],
      allocations: {},
      auditLog: [],
      downloadUsedBytes: 0,
      downloadLimitBytes: 5 * 1024 * 1024 * 1024, // 5GB/day
      clientRequestsAdded: [],
      clientRequestOverrides: {},
      approvedPendingClientIds: [],
      clearedClientPendingMatterIds: [],
      mutedClientIds: [],
      matterPipelineOverrides: {},
      mailPipelineReassignments: {},
      autodocketConfig: DEFAULT_AUTODOCKET_CONFIG,
      autoFileOverrides: {},
      auditVerdicts: {},
      misfileReports: [],
      markedParts: {},
      tsApprovalOverrides: {},
      tsQueryThreads: {},
      rtbApprovalOverrides: {},
      writeOffOverrides: {},
      notificationOverrides: {},
      notifPrefs: {
        matrix: {
          "Hearings & deadlines": { inApp: true, email: true, teams: true, digestOnly: false },
          "RTB approvals": { inApp: true, email: true, teams: false, digestOnly: false },
          "CRTB approvals": { inApp: true, email: true, teams: false, digestOnly: false },
          "Allocation": { inApp: true, email: false, teams: false, digestOnly: false },
          "Checker queue": { inApp: true, email: false, teams: false, digestOnly: false },
          "Timesheet": { inApp: true, email: true, teams: false, digestOnly: true },
          "Docketing exceptions": { inApp: true, email: false, teams: false, digestOnly: false },
          "Reports": { inApp: false, email: false, teams: false, digestOnly: true },
        },
        quietHours: { start: "20:00", end: "08:00" },
        digestTime: "08:00",
      },
      todayManualTasks: [],
      todayCompletedIds: [],
      todayDismissedIds: [],
      todayReschedules: {},
      paymentPosts: {},
      conflictReferrals: [],
      nbAdditions: [],
      nbStatusOverrides: {},
      userRoleOverrides: {},
      queueMembership: { docketer: {}, maker: {}, checker: {} },
      reports: [],
      addReport: (r) => set((s) => ({ reports: [{ ...r, updatedAt: new Date().toISOString() }, ...s.reports.filter((x) => x.id !== r.id)] })),
      updateReport: (id, patch) =>
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString(), version: (r.version ?? 1) + 1 } : r)),
        })),
      deleteReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),
      touchReportRun: (id) =>
        set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, lastRunAt: new Date().toISOString() } : r)) })),
      reportShares: {},
      reportSubscriptions: [],
      reportDeliveries: {},
      templateOverrides: {},
      shareReportWith: (reportId, userIds) =>
        set((s) => ({ reportShares: { ...s.reportShares, [reportId]: userIds } })),
      addSubscription: (sub) =>
        set((s) => ({ reportSubscriptions: [sub, ...s.reportSubscriptions.filter((x) => x.id !== sub.id)] })),
      removeSubscription: (id) =>
        set((s) => ({ reportSubscriptions: s.reportSubscriptions.filter((x) => x.id !== id) })),
      setSubscriptionPaused: (id, paused) =>
        set((s) => ({ reportSubscriptions: s.reportSubscriptions.map((x) => (x.id === id ? { ...x, paused } : x)) })),
      recordReportDelivery: (key, delivery) =>
        set((s) => ({ reportDeliveries: { ...s.reportDeliveries, [key]: delivery } })),
      saveTemplateOverride: (def) =>
        set((s) => ({ templateOverrides: { ...s.templateOverrides, [def.id]: { ...def, updatedAt: new Date().toISOString() } } })),
      misBoards: [],
      misBoardShares: {},
      misBoardDeliveries: {},
      addMISBoard: (b) => set((s) => ({ misBoards: [b, ...s.misBoards.filter((x) => x.id !== b.id)] })),
      updateMISBoard: (id, patch) =>
        set((s) => ({
          misBoards: s.misBoards.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b)),
        })),
      deleteMISBoard: (id) => set((s) => ({ misBoards: s.misBoards.filter((b) => b.id !== id) })),
      addMISWidget: (boardId, widget) =>
        set((s) => ({
          misBoards: s.misBoards.map((b) =>
            b.id === boardId ? { ...b, widgets: [...b.widgets, widget], updatedAt: new Date().toISOString() } : b,
          ),
        })),
      updateMISWidget: (boardId, widgetId, patch) =>
        set((s) => ({
          misBoards: s.misBoards.map((b) =>
            b.id === boardId
              ? { ...b, widgets: b.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)), updatedAt: new Date().toISOString() }
              : b,
          ),
        })),
      removeMISWidget: (boardId, widgetId) =>
        set((s) => ({
          misBoards: s.misBoards.map((b) =>
            b.id === boardId ? { ...b, widgets: b.widgets.filter((w) => w.id !== widgetId), updatedAt: new Date().toISOString() } : b,
          ),
        })),
      moveMISWidget: (boardId, widgetId, dir) =>
        set((s) => ({
          misBoards: s.misBoards.map((b) => {
            if (b.id !== boardId) return b;
            const idx = b.widgets.findIndex((w) => w.id === widgetId);
            if (idx < 0) return b;
            const j = idx + dir;
            if (j < 0 || j >= b.widgets.length) return b;
            const next = b.widgets.slice();
            [next[idx], next[j]] = [next[j], next[idx]];
            return { ...b, widgets: next, updatedAt: new Date().toISOString() };
          }),
        })),
      shareMISBoardWith: (boardId, userIds) =>
        set((s) => ({ misBoardShares: { ...s.misBoardShares, [boardId]: userIds } })),
      recordMISBoardDelivery: (boardId, delivery) =>
        set((s) => ({ misBoardDeliveries: { ...s.misBoardDeliveries, [boardId]: delivery } })),
      demoDoneSteps: [],
      demoOverlayOpen: false,
      setCurrentRole: (role) => set({ currentRole: role }),
      setCurrentUser: (id, role) => set({ currentUserId: id, currentRole: role }),
      toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
      pinMatter: (id) =>
        set((s) => ({
          pinnedMatterIds: s.pinnedMatterIds.includes(id)
            ? s.pinnedMatterIds
            : [...s.pinnedMatterIds, id].slice(0, 8),
        })),
      unpinMatter: (id) =>
        set((s) => ({ pinnedMatterIds: s.pinnedMatterIds.filter((x) => x !== id) })),
      setMatterColumnKeys: (keys) => set({ matterColumnKeys: keys }),
      addSavedView: (v) => set((s) => ({ savedViews: [...s.savedViews.filter((x) => x.id !== v.id), v], activeSavedViewId: v.id })),
      removeSavedView: (id) => set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id), activeSavedViewId: s.activeSavedViewId === id ? null : s.activeSavedViewId })),
      setActiveSavedViewId: (id) => set({ activeSavedViewId: id }),
      openQuickTime: (matterId) => set({ quickTimeMatterId: matterId }),
      openQuickTimeWith: (ctx) => set({
        quickTimeMatterId: ctx.matterId ?? null,
        quickTimeContextDate: ctx.date ?? null,
        quickTimeOpen: true,
      }),
      closeQuickTime: () => set({ quickTimeOpen: false }),
      addTimeEntry: (te) => set((s) => ({ timeEntriesAdded: [te, ...s.timeEntriesAdded] })),
      updateTimeEntry: (id, patch) => set((s) => ({ timeEntriesEdited: { ...s.timeEntriesEdited, [id]: { ...(s.timeEntriesEdited[id] ?? {}), ...patch } } })),
      submitWeek: (weekKey, userId) => set((s) => ({
        submittedWeeks: {
          ...s.submittedWeeks,
          [weekKey]: [...(s.submittedWeeks[weekKey] ?? []).filter((x) => x.userId !== userId), { userId, at: new Date().toISOString() }],
        },
      })),
      rejectSuggestion: (id) => set((s) => ({ rejectedSuggestionIds: s.rejectedSuggestionIds.includes(id) ? s.rejectedSuggestionIds : [...s.rejectedSuggestionIds, id] })),
      allocateMatter: (matterId, assigneeId, note) =>
        set((s) => ({ allocations: { ...s.allocations, [matterId]: { assigneeId, note, at: new Date().toISOString() } } })),
      unallocateMatter: (matterId) =>
        set((s) => {
          const { [matterId]: _removed, ...rest } = s.allocations;
          return { allocations: rest };
        }),
      appendAudit: (entry) =>
        set((s) => ({
          auditLog: [
            { ...entry, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString() },
            ...s.auditLog,
          ].slice(0, 500),
        })),
      consumeDownload: (bytes) => {
        const s = get();
        if (s.downloadUsedBytes + bytes > s.downloadLimitBytes) return false;
        set({ downloadUsedBytes: s.downloadUsedBytes + bytes });
        return true;
      },
      resetDownloadBudget: () => set({ downloadUsedBytes: 0 }),
      addClientRequest: (req) =>
        set((s) => ({ clientRequestsAdded: [req, ...s.clientRequestsAdded] })),
      updateClientRequest: (id, patch) =>
        set((s) => ({
          clientRequestOverrides: {
            ...s.clientRequestOverrides,
            [id]: {
              ...(s.clientRequestOverrides[id] ?? {}),
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          },
        })),
      appendClientRequestComment: (id, comment) =>
        set((s) => {
          const prev = s.clientRequestOverrides[id] ?? {};
          return {
            clientRequestOverrides: {
              ...s.clientRequestOverrides,
              [id]: {
                ...prev,
                appendThread: [...(prev.appendThread ?? []), comment],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      approvePendingClient: (clientId) =>
        set((s) => ({
          approvedPendingClientIds: s.approvedPendingClientIds.includes(clientId)
            ? s.approvedPendingClientIds
            : [...s.approvedPendingClientIds, clientId],
        })),
      toggleClientMute: (clientId) =>
        set((s) => ({
          mutedClientIds: s.mutedClientIds.includes(clientId)
            ? s.mutedClientIds.filter((x) => x !== clientId)
            : [...s.mutedClientIds, clientId],
        })),
      setMatterPipelineOverride: (matterId, override) =>
        set((s) => ({
          matterPipelineOverrides: { ...s.matterPipelineOverrides, [matterId]: override },
        })),
      clearMatterPipelineOverride: (matterId) =>
        set((s) => {
          const { [matterId]: _removed, ...rest } = s.matterPipelineOverrides;
          return { matterPipelineOverrides: rest };
        }),
      rebalanceMail: (mailId, reassignment) =>
        set((s) => ({
          mailPipelineReassignments: { ...s.mailPipelineReassignments, [mailId]: reassignment },
        })),
      undoRebalanceMail: (mailId) =>
        set((s) => {
          const { [mailId]: _r, ...rest } = s.mailPipelineReassignments;
          return { mailPipelineReassignments: rest };
        }),
      updateAutodocketConfig: (patch) =>
        set((s) => ({ autodocketConfig: { ...s.autodocketConfig, ...patch } })),
      recordAutoFile: (rec) =>
        set((s) => ({ autoFileOverrides: { ...s.autoFileOverrides, [rec.mailId]: rec } })),
      revokeAutoFile: (mailId) =>
        set((s) => ({ autoFileOverrides: { ...s.autoFileOverrides, [mailId]: null } })),
      setAuditVerdict: (v) =>
        set((s) => ({ auditVerdicts: { ...s.auditVerdicts, [v.mailId]: v } })),
      addMisfileReport: (r) =>
        set((s) => ({ misfileReports: [r, ...s.misfileReports] })),
      addMarkedParts: (mailId, attachmentName, parts) =>
        set((s) => {
          const existing = s.markedParts[mailId] ?? [];
          const rest = existing.filter((e) => e.attachmentName !== attachmentName);
          return {
            markedParts: { ...s.markedParts, [mailId]: [...rest, { attachmentName, parts }] },
          };
        }),
      approveTimeEntry: (id) =>
        set((s) => ({ tsApprovalOverrides: { ...s.tsApprovalOverrides, [id]: "Approved" } })),
      queryTimeEntry: (id, comment) =>
        set((s) => ({
          tsApprovalOverrides: { ...s.tsApprovalOverrides, [id]: "Queried" },
          tsQueryThreads: {
            ...s.tsQueryThreads,
            [id]: [...(s.tsQueryThreads[id] ?? []), { ...comment, at: new Date().toISOString() }],
          },
        })),
      undoTimeEntryDecision: (id) =>
        set((s) => {
          const { [id]: _r, ...rest } = s.tsApprovalOverrides;
          return { tsApprovalOverrides: rest };
        }),
      approveRTB: (id, actorId) =>
        set((s) => ({ rtbApprovalOverrides: { ...s.rtbApprovalOverrides, [id]: { status: "Approved", at: new Date().toISOString(), actorId } } })),
      declineRTB: (id, reason, actorId) =>
        set((s) => ({ rtbApprovalOverrides: { ...s.rtbApprovalOverrides, [id]: { status: "Draft", reason, at: new Date().toISOString(), actorId } } })),
      voidRTB: (id, actorId) =>
        set((s) => ({ rtbApprovalOverrides: { ...s.rtbApprovalOverrides, [id]: { status: "Voided", at: new Date().toISOString(), actorId } } })),
      setWriteOffStatus: (id, status, reason) =>
        set((s) => ({ writeOffOverrides: { ...s.writeOffOverrides, [id]: { status, reason, at: new Date().toISOString() } } })),
      setNotificationState: (id, patch) =>
        set((s) => ({
          notificationOverrides: {
            ...s.notificationOverrides,
            [id]: { ...(s.notificationOverrides[id] ?? {}), ...patch, at: new Date().toISOString() },
          },
        })),
      markAllNotificationsRead: (ids) =>
        set((s) => {
          const next = { ...s.notificationOverrides };
          for (const id of ids) {
            const cur = next[id] ?? {};
            if (cur.state !== "Done") next[id] = { ...cur, state: "Read", at: new Date().toISOString() };
          }
          return { notificationOverrides: next };
        }),
      setNotifPrefCell: (category, channel, value) =>
        set((s) => ({
          notifPrefs: {
            ...s.notifPrefs,
            matrix: {
              ...s.notifPrefs.matrix,
              [category]: { ...(s.notifPrefs.matrix[category] ?? { inApp: false, email: false, teams: false, digestOnly: false }), [channel]: value },
            },
          },
        })),
      setNotifQuietHours: (start, end) => set((s) => ({ notifPrefs: { ...s.notifPrefs, quietHours: { start, end } } })),
      setDigestTime: (t) => set((s) => ({ notifPrefs: { ...s.notifPrefs, digestTime: t } })),
      addTodayTask: (task) => set((s) => ({ todayManualTasks: [{ ...task, createdAt: new Date().toISOString() }, ...s.todayManualTasks] })),
      completeTodayRow: (id) => set((s) => ({ todayCompletedIds: s.todayCompletedIds.includes(id) ? s.todayCompletedIds : [...s.todayCompletedIds, id] })),
      uncompleteTodayRow: (id) => set((s) => ({ todayCompletedIds: s.todayCompletedIds.filter((x) => x !== id) })),
      dismissTodayRow: (id) => set((s) => ({ todayDismissedIds: s.todayDismissedIds.includes(id) ? s.todayDismissedIds : [...s.todayDismissedIds, id] })),
      undoDismissTodayRow: (id) => set((s) => ({ todayDismissedIds: s.todayDismissedIds.filter((x) => x !== id) })),
      rescheduleTodayRow: (id, iso) => set((s) => ({ todayReschedules: { ...s.todayReschedules, [id]: iso } })),
      delegateTodayRow: (sourceId, subject, matterId, toUserId, fromUserId, dueDate, priority) =>
        set((s) => ({
          todayCompletedIds: s.todayCompletedIds.includes(sourceId) ? s.todayCompletedIds : s.todayCompletedIds,
          todayDismissedIds: s.todayDismissedIds.includes(sourceId) ? s.todayDismissedIds : [...s.todayDismissedIds, sourceId],
          todayManualTasks: [
            { id: `del-${Date.now().toString(36)}`, subject, matterId, assigneeId: toUserId, dueDate, priority, createdAt: new Date().toISOString(), delegatedFromId: fromUserId },
            ...s.todayManualTasks,
          ],
        })),
      postPayment: (rtbId, amount, actorId, invoiceNo) =>
        set((s) => ({
          paymentPosts: {
            ...s.paymentPosts,
            [rtbId]: { amount, actorId, invoiceNo, at: new Date().toISOString() },
          },
        })),
      addConflictReferral: (ref) =>
        set((s) => ({
          conflictReferrals: [
            { ...ref, id: `cr-${Date.now().toString(36)}`, at: new Date().toISOString() },
            ...s.conflictReferrals,
          ],
        })),
      addNonBillable: (nb) =>
        set((s) => ({ nbAdditions: [nb, ...s.nbAdditions] })),
      decideNonBillable: (id, status, approverId, note) =>
        set((s) => ({
          nbStatusOverrides: {
            ...s.nbStatusOverrides,
            [id]: { status, approverId, note, decidedAt: new Date().toISOString() },
          },
        })),
      setUserRoles: (userId, roles) =>
        set((s) => ({ userRoleOverrides: { ...s.userRoleOverrides, [userId]: roles } })),
      setQueueWeight: (queue, userId, weight) =>
        set((s) => ({
          queueMembership: {
            ...s.queueMembership,
            [queue]: { ...s.queueMembership[queue], [userId]: weight },
          },
        })),
      toggleDemoStep: (n) =>
        set((s) => ({
          demoDoneSteps: s.demoDoneSteps.includes(n)
            ? s.demoDoneSteps.filter((x) => x !== n)
            : [...s.demoDoneSteps, n].sort((a, b) => a - b),
        })),
      markDemoStep: (n) =>
        set((s) => ({
          demoDoneSteps: s.demoDoneSteps.includes(n)
            ? s.demoDoneSteps
            : [...s.demoDoneSteps, n].sort((a, b) => a - b),
        })),
      resetDemoProgress: () => set({ demoDoneSteps: [] }),
      setDemoOverlayOpen: (open) => set({ demoOverlayOpen: open }),
    }),
    { name: "snowfig-lcms-app" },
  ),
);