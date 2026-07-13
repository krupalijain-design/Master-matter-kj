import type { AuditEntry } from "@/types";

export const auditLog: AuditEntry[] = [
  { id: "a-1", actor: "u-kavita", actorName: "Kavita Rao", activeRole: "Case Partner", action: "Approved RTB 0000833282", matterId: "m-1096264", at: new Date(Date.now() - 3600_000).toISOString() },
  { id: "a-2", actor: "u-meera", actorName: "Meera Joshi", activeRole: "Checker", action: "Accepted matter into pipeline", matterId: "m-1096281", at: new Date(Date.now() - 7200_000).toISOString() },
];
