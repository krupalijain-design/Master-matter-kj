import { useQuery } from "@tanstack/react-query";
import { matters as _matters } from "@/mocks/matters";
import { clients as _clients } from "@/mocks/clients";
import { mails as _mails } from "@/mocks/mails";
import { rtbs as _rtbs } from "@/mocks/rtbs";
import { writeOffRequests as _wo } from "@/mocks/writeOffs";
import { timeEntries as _te } from "@/mocks/timeEntries";
import { hearings as _hearings } from "@/mocks/hearings";
import { tasks as _tasks } from "@/mocks/tasks";
import { notifications as _notifs } from "@/mocks/notifications";
import { users as _users } from "@/mocks/users";
import { nonBillable as _nb } from "@/mocks/nonBillable";
import { seedClientRequests } from "@/mocks/clientRequests";
import { useAppStore } from "@/store/app-store";
import type { Client, ClientChangeRequest, Matter, NonBillableWork, RTB, WriteOffRequest } from "@/types";
import { useMemo } from "react";

function useSeed<T>(key: string, data: T): { data: T } {
  const q = useQuery({ queryKey: [key], queryFn: async () => data, staleTime: Infinity, initialData: data });
  return { data: (q.data ?? data) as T };
}

const _rawUseMatters = () => useSeed("matters", _matters);
/** Matters with client-pending tag stripped when the underlying client has been approved. */
export const useMatters = () => {
  const raw = _rawUseMatters();
  const approved = useAppStore((s) => s.approvedPendingClientIds);
  const pipelineOverrides = useAppStore((s) => s.matterPipelineOverrides);
  const data = useMemo<Matter[]>(() => {
    return raw.data.map((m) => {
      const withTag = approved.includes(m.clientId) && m.tags.includes("client-pending")
        ? { ...m, tags: m.tags.filter((t) => t !== "client-pending") }
        : m;
      const o = pipelineOverrides[m.id];
      if (!o) return withTag;
      return {
        ...withTag,
        pipelineState: o.pipelineState,
        allocationState:
          o.pipelineState === "Approved" && withTag.allocationState === "Unallocated"
            ? "Unallocated"
            : withTag.allocationState,
      };
    });
  }, [raw.data, approved, pipelineOverrides]);
  return { data };
};
export const useClients = () => useSeed("clients", _clients);
export const useMails = () => useSeed("mails", _mails);
const _rawUseRtbs = () => useSeed("rtbs", _rtbs);
export const useRtbs = () => {
  const raw = _rawUseRtbs();
  const overrides = useAppStore((s) => s.rtbApprovalOverrides);
  const payments = useAppStore((s) => s.paymentPosts);
  const data = useMemo<RTB[]>(() => raw.data.map((r) => {
    const o = overrides[r.id];
    let out: RTB = o ? { ...r, status: o.status } : r;
    const p = payments[r.id];
    if (p) {
      const outstanding = Math.max(0, out.outstandingAmount - p.amount);
      out = {
        ...out,
        outstandingAmount: outstanding,
        status: outstanding === 0 ? "Paid" : out.status,
        invoiceNo: out.invoiceNo ?? p.invoiceNo,
      };
    }
    return out;
  }), [raw.data, overrides, payments]);
  return { data };
};
export const useWriteOffs = () => {
  const overrides = useAppStore((s) => s.writeOffOverrides);
  const data = useMemo<(WriteOffRequest & { status: "Pending" | "Approved" | "Declined"; decidedAt?: string; declineReason?: string })[]>(
    () => _wo.map((w) => {
      const o = overrides[w.id];
      return { ...w, status: o?.status ?? "Pending", decidedAt: o?.at, declineReason: o?.reason };
    }),
    [overrides],
  );
  return { data };
};
export const useTimeEntries = () => useSeed("time", _te);
export const useHearings = () => useSeed("hearings", _hearings);
export const useTasks = () => useSeed("tasks", _tasks);
export const useNotifications = () => useSeed("notifs", _notifs);
const _rawUseUsers = () => useSeed("users", _users);
export const useUsers = () => {
  const raw = _rawUseUsers();
  const overrides = useAppStore((s) => s.userRoleOverrides);
  const data = useMemo(
    () => raw.data.map((u) => (overrides[u.id] ? { ...u, roles: overrides[u.id] } : u)),
    [raw.data, overrides],
  );
  return { data };
};
export const useNonBillable = () => useSeed("nb", _nb);

/** NonBillable = seed + store-added, with status/approver overrides applied. */
export const useNonBillableResolved = () => {
  const added = useAppStore((s) => s.nbAdditions);
  const overrides = useAppStore((s) => s.nbStatusOverrides);
  const data = useMemo<NonBillableWork[]>(() => {
    const combined: NonBillableWork[] = [..._nb, ...added];
    return combined.map((n) => {
      const o = overrides[n.id];
      if (!o) return n;
      return { ...n, status: o.status, approverId: o.approverId ?? n.approverId };
    });
  }, [added, overrides]);
  return { data };
};

/** Clients with store overrides applied (approvedPendingClientIds flips status to Active). */
export const useClientsResolved = () => {
  const base = _clients;
  const approved = useAppStore((s) => s.approvedPendingClientIds);
  const muted = useAppStore((s) => s.mutedClientIds);
  const data = useMemo<Client[]>(
    () =>
      base.map((c) => ({
        ...c,
        status: approved.includes(c.id) ? "active" : c.status,
        mutedNotifications: muted.includes(c.id),
      })),
    [base, approved, muted],
  );
  return { data };
};

/** Client change requests = seed + store-added, with store status overrides. */
export const useClientRequests = () => {
  const added = useAppStore((s) => s.clientRequestsAdded);
  const overrides = useAppStore((s) => s.clientRequestOverrides);
  const data = useMemo<ClientChangeRequest[]>(() => {
    const combined = [...seedClientRequests, ...added];
    return combined.map((r) => {
      const o = overrides[r.id];
      if (!o) return r;
      return {
        ...r,
        status: o.status ?? r.status,
        makerId: o.makerId ?? r.makerId,
        makerName: o.makerName ?? r.makerName,
        checkerId: o.checkerId ?? r.checkerId,
        checkerName: o.checkerName ?? r.checkerName,
        updatedAt: o.updatedAt ?? r.updatedAt,
        thread: [...r.thread, ...(o.appendThread ?? [])],
      };
    });
  }, [added, overrides]);
  return { data };
};