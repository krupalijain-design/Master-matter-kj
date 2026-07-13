import type { Role, RoleDefinition, RoleCategory, RbacAction, RbacResource, User, Matter } from "@/types";

// Route prefixes visible in each role's lens
const NAV = {
  partner: ["/cockpit", "/matter", "/client", "/timesheet", "/approvals", "/reports", "/notifications", "/nonbillable"],
  cm: ["/today", "/matter", "/client", "/timesheet", "/reports", "/notifications", "/nonbillable"],
  assoc: ["/today", "/matter", "/client", "/timesheet", "/reports", "/notifications", "/nonbillable"],
  paralegal: ["/today", "/matter", "/client", "/timesheet", "/notifications", "/diary"],
  ea: ["/today", "/timesheet", "/notifications"],
  docketer: ["/mails", "/matter", "/client", "/notifications"],
  maker: ["/mails", "/matter", "/client", "/notifications"],
  checker: ["/mails", "/matter", "/client", "/notifications", "/pipeline"],
  masterDocketer: ["/mails", "/client", "/client/requests", "/notifications"],
  teamMgr: ["/pipeline", "/matter", "/client", "/timesheet", "/approvals", "/reports", "/notifications", "/admin/roles"],
  admin: ["/admin", "/notifications"],
  dbAdmin: ["/admin"],
  court: ["/diary", "/notifications"],
  accounts: ["/collections", "/reports", "/notifications"],
  hr: ["/nonbillable", "/compliance", "/reports", "/notifications"],
  head: ["/cockpit/scope", "/cockpit", "/matter", "/client", "/reports", "/notifications"],
  mgmt: ["/cockpit/firm", "/cockpit", "/reports", "/notifications"],
};

const p = (action: RbacAction, resource: RbacResource, scope: RoleDefinition["permissions"][number]["scope"] = "own") => ({ action, resource, scope });

export const roleRegistry: RoleDefinition[] = [
  // Pipeline
  { role: "Docketer", category: "pipeline", homeRoute: "/mails", navSet: NAV.docketer, permissions: [p("triage", "mails", "firm"), p("read", "clients", "firm"), p("log-time" as RbacAction, "timesheet", "own")] },
  { role: "Maker", category: "pipeline", homeRoute: "/mails", navSet: NAV.maker, permissions: [p("triage", "mails", "firm"), p("create", "matter", "firm")] },
  { role: "Checker", category: "pipeline", homeRoute: "/mails", navSet: NAV.checker, permissions: [p("review", "mails", "firm"), p("edit", "matter", "firm"), p("assign", "allocate", "firm"), p("view", "cockpit", "firm")] },
  { role: "Master Docketer", category: "pipeline", homeRoute: "/client/requests", navSet: NAV.masterDocketer, permissions: [p("create", "clients", "firm"), p("edit", "clients", "firm")] },
  { role: "Team Manager", category: "pipeline", homeRoute: "/pipeline", navSet: NAV.teamMgr, permissions: [p("view", "mails", "firm"), p("rebalance", "mails", "firm"), p("manage", "admin", "team")] },

  // Matter ops
  { role: "Case Partner", category: "matter-ops", homeRoute: "/cockpit", navSet: NAV.partner, permissions: [
      p("read", "mails", "team"), p("create", "matter", "team"), p("edit", "matter", "team"),
      p("assign", "allocate", "team"), p("decide", "fee-quote", "team"), p("approve", "rtb", "team"),
      p("approve", "approvals-ts", "team"), p("view", "cockpit", "practice"), p("read", "hearings", "team"),
    ]},
  { role: "Case Manager", category: "matter-ops", homeRoute: "/today", navSet: NAV.cm, permissions: [
      p("read", "mails", "team"), p("edit", "matter", "team"), p("assign", "allocate", "team"),
      p("initiate", "rtb", "team"), p("view", "cockpit", "team"),
    ]},
  { role: "Associate", category: "matter-ops", homeRoute: "/today", navSet: NAV.assoc, permissions: [
      p("read", "mails", "own"), p("edit", "matter", "own"), p("read", "hearings", "own"),
    ]},
  { role: "Paralegal", category: "matter-ops", homeRoute: "/today", navSet: NAV.paralegal, permissions: [
      p("read", "matter", "own"), p("initiate", "rtb", "own"), p("create", "diary", "own"),
    ]},
  { role: "EA", category: "matter-ops", homeRoute: "/timesheet", navSet: NAV.ea, permissions: [p("edit", "timesheet", "team")] },

  // Leadership
  { role: "Group Head", category: "leadership", homeRoute: "/cockpit/scope", navSet: NAV.head, permissions: [p("view", "cockpit", "group")] },
  { role: "Practice Head", category: "leadership", homeRoute: "/cockpit/scope", navSet: NAV.head, permissions: [p("view", "cockpit", "practice")] },
  { role: "Executive Head", category: "leadership", homeRoute: "/cockpit/scope", navSet: NAV.head, permissions: [p("view", "cockpit", "firm")] },
  { role: "Management", category: "leadership", homeRoute: "/cockpit/firm", navSet: NAV.mgmt, permissions: [p("view", "cockpit", "firm")] },

  // Support
  { role: "Court Staff", category: "support", homeRoute: "/diary", navSet: NAV.court, permissions: [p("create", "diary", "firm")] },
  { role: "Accounts", category: "support", homeRoute: "/collections", navSet: NAV.accounts, permissions: [p("post", "rtb", "firm"), p("view", "collections", "firm")] },
  { role: "HR", category: "support", homeRoute: "/compliance", navSet: NAV.hr, permissions: [p("view", "compliance", "firm"), p("export", "compliance", "firm")] },
  { role: "Admin Manager", category: "support", homeRoute: "/admin", navSet: NAV.admin, permissions: [p("manage", "admin", "firm")] },
  { role: "DB Admin", category: "support", homeRoute: "/admin", navSet: NAV.dbAdmin, permissions: [p("manage", "admin", "firm")] },
];

export const roleDef = (role: Role): RoleDefinition | undefined => roleRegistry.find((r) => r.role === role);

export const CATEGORY_LABEL: Record<RoleCategory, string> = {
  "matter-ops": "Matter ops",
  pipeline: "Pipeline",
  leadership: "Leadership",
  support: "Support",
};

export const homeRouteFor = (role: Role): string => roleDef(role)?.homeRoute ?? "/today";

export const navSetFor = (role: Role): string[] => roleDef(role)?.navSet ?? [];

export const unionNavSet = (roles: Role[]): string[] => {
  const s = new Set<string>();
  roles.forEach((r) => navSetFor(r).forEach((x) => s.add(x)));
  return [...s];
};

export const pathAllowedByRoles = (pathname: string, roles: Role[]): boolean => {
  const paths = unionNavSet(roles);
  return paths.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
};

export const pathAllowedByRole = (pathname: string, role: Role): boolean => {
  return navSetFor(role).some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
};

export const rolesGrantingPath = (pathname: string, roles: Role[]): Role[] =>
  roles.filter((r) => pathAllowedByRole(pathname, r));

export interface CanContext {
  matter?: Matter;
  activeRole: Role;
  user: User;
}

/** UNION of held roles. Scope narrowing via optional matter context. */
export function can(user: User, action: RbacAction, resource: RbacResource, ctx?: { matter?: Matter }): boolean {
  for (const role of user.roles) {
    const def = roleDef(role);
    if (!def) continue;
    for (const perm of def.permissions) {
      if (perm.action !== action || perm.resource !== resource) continue;
      if (!ctx?.matter || perm.scope === "firm" || perm.scope === "practice" || perm.scope === "group" || perm.scope === "branch") return true;
      const m = ctx.matter;
      if (perm.scope === "own") {
        if (m.casePartnerId === user.id || m.caseManagerId === user.id || m.caseAssociateIds.includes(user.id) || m.paralegalIds.includes(user.id)) return true;
      }
      if (perm.scope === "team") {
        if (m.casePartnerId === user.id || m.caseManagerId === user.id || m.caseAssociateIds.includes(user.id)) return true;
      }
    }
  }
  return false;
}

/** Roles for which money surfaces are hidden. */
export const MONEY_HIDDEN_ROLES: Role[] = ["Paralegal", "Court Staff"];

export const hidesMoney = (role: Role) => MONEY_HIDDEN_ROLES.includes(role);
