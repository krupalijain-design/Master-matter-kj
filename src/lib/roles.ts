import type { Role } from "@/types";
import { homeRouteFor as _home } from "@/rbac/matrix";

export const homeRouteFor = _home;

export type NavGroup = "partner" | "docketing" | "team" | "associate" | "leadership" | "support";

export function navGroupFor(role: Role): NavGroup {
  if (role === "Docketer" || role === "Maker" || role === "Checker" || role === "Master Docketer") return "docketing";
  if (role === "Team Manager") return "team";
  if (role === "Case Partner") return "partner";
  if (role === "Group Head" || role === "Practice Head" || role === "Executive Head" || role === "Management") return "leadership";
  if (role === "Accounts" || role === "HR" || role === "Court Staff" || role === "Admin Manager" || role === "DB Admin") return "support";
  return "associate";
}
