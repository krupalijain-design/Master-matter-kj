import { useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import {
  useClients,
  useHearings,
  useMatters,
  useNonBillableResolved,
  useRtbs,
  useTasks,
  useTimeEntries,
  useUsers,
} from "@/hooks/use-data";
import type { RunContext } from "@/lib/report-engine";

export function useRunContext(): RunContext {
  const { data: users } = useUsers();
  const { data: clients } = useClients();
  const { data: matters } = useMatters();
  const { data: time } = useTimeEntries();
  const { data: rtbs } = useRtbs();
  const { data: hearings } = useHearings();
  const { data: tasks } = useTasks();
  const { data: nb } = useNonBillableResolved();
  const userId = useAppStore((s) => s.currentUserId);
  const user = useMemo(() => users.find((u) => u.id === userId) ?? users[0], [users, userId]);
  const added = useAppStore((s) => s.timeEntriesAdded);
  const timeAll = useMemo(() => [...added, ...time], [added, time]);
  return { user, users, clients, matters, time: timeAll, rtbs, hearings, tasks, nb };
}