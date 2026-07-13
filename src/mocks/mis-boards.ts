import type { MISBoard, Role } from "@/types";

const now = "2026-06-01T00:00:00.000Z";

function w(reportId: string, viz: MISBoard["widgets"][number]["viz"], size: MISBoard["widgets"][number]["size"], title?: string) {
  return { id: `w-${reportId}-${size}`, reportId, viz, size, title };
}

/** Default seeded board per leadership role. Returned once when the user first opens /mis. */
export function seedBoardsForRole(role: Role, userId: string): MISBoard[] {
  const base = { ownerId: userId, visibility: "Private" as const, createdAt: now, updatedAt: now, seeded: true };
  if (role === "Practice Head") {
    return [{
      ...base,
      id: `mb-seed-practice-${userId}`,
      name: "Practice MIS",
      subtitle: "Live for your practice. Scope trims automatically.",
      defaultForRole: role,
      widgets: [
        w("cockpit-funnel", "Funnel", "md", "WIP → Billed → Collected"),
        w("cockpit-leading", "Summary", "md", "Leading indicators"),
        w("tpl-revenue-category", "Bar", "md", "Revenue by category"),
        w("tpl-outstanding-client", "Bar", "md", "Outstanding by client"),
        w("tpl-my-billing-fytd", "Bar", "sm", "Billed FYTD"),
        w("tpl-my-collection", "Summary", "sm", "Collected FYTD"),
        w("tpl-live-by-state", "Bar", "sm", "Live matters by branch"),
        w("tpl-fee-quotes-awaiting", "Summary", "sm", "Quotes awaiting response"),
      ],
    }];
  }
  if (role === "Group Head") {
    return [{
      ...base,
      id: `mb-seed-group-${userId}`,
      name: "Group MIS",
      subtitle: "Your group at a glance.",
      defaultForRole: role,
      widgets: [
        w("cockpit-funnel", "Funnel", "md", "WIP → Billed → Collected"),
        w("cockpit-leading", "Summary", "md", "Leading indicators"),
        w("tpl-team-performance", "Bar", "md", "Team performance"),
        w("tpl-outstanding-client", "Bar", "md", "Outstanding by client"),
        w("tpl-live-by-state", "Bar", "sm", "Live matters by branch"),
        w("tpl-my-writeoffs", "Summary", "sm", "Write-offs"),
      ],
    }];
  }
  if (role === "Executive Head" || role === "Management") {
    return [{
      ...base,
      id: `mb-seed-firm-${userId}`,
      name: "Firm MIS",
      subtitle: "Firm-wide numbers with drill through.",
      defaultForRole: role,
      widgets: [
        w("cockpit-funnel", "Funnel", "lg", "WIP → Billed → Collected"),
        w("cockpit-leading", "Summary", "md", "Leading indicators"),
        w("tpl-revenue-category", "Bar", "md", "Revenue by category"),
        w("tpl-live-by-state", "Bar", "md", "Live matters by branch"),
        w("tpl-outstanding-client", "Bar", "md", "Outstanding by client"),
        w("tpl-team-performance", "Bar", "md", "Team performance"),
        w("tpl-pipeline-throughput", "Funnel", "sm", "Docketing throughput"),
        w("tpl-nb-credits", "Bar", "sm", "Non billable credits"),
      ],
    }];
  }
  if (role === "Case Partner") {
    return [{
      ...base,
      id: `mb-seed-partner-${userId}`,
      name: "My practice at a glance",
      subtitle: "Pinned numbers you look at every morning.",
      defaultForRole: role,
      widgets: [
        w("tpl-my-billing-fytd", "Bar", "md", "Billed FYTD"),
        w("tpl-my-collection", "Summary", "md", "Collected FYTD"),
        w("tpl-outstanding-client", "Bar", "md", "Outstanding by client"),
        w("tpl-my-matters-status", "Bar", "sm", "My matters by status"),
        w("tpl-fee-quotes-awaiting", "Summary", "sm", "Quotes awaiting response"),
      ],
    }];
  }
  if (role === "Team Manager") {
    return [{
      ...base,
      id: `mb-seed-tm-${userId}`,
      name: "Pipeline MIS",
      subtitle: "Throughput, queues and STP.",
      defaultForRole: role,
      widgets: [
        w("tpl-pipeline-throughput", "Funnel", "md", "Pipeline throughput"),
        w("tpl-team-performance", "Bar", "md", "Team performance"),
      ],
    }];
  }
  if (role === "Accounts") {
    return [{
      ...base,
      id: `mb-seed-accts-${userId}`,
      name: "Collections focus",
      subtitle: "Outstanding first, everything else after.",
      defaultForRole: role,
      widgets: [
        w("tpl-outstanding-client", "Bar", "md", "Outstanding by client"),
        w("tpl-my-writeoffs", "Summary", "sm", "Write-offs"),
        w("tpl-revenue-category", "Bar", "md", "Revenue by category"),
      ],
    }];
  }
  return [];
}

/** Cockpit-native widgets that don't come from firmTemplates. Kept minimal (built into MISWidget). */
export const COCKPIT_WIDGETS: Record<string, { name: string; description: string; dataset: "cockpit" }> = {
  "cockpit-funnel": { name: "WIP → Billed → Collected", description: "Firm cockpit funnel (leading indicators).", dataset: "cockpit" },
  "cockpit-leading": { name: "Leading indicators", description: "Utilisation, coverage, WIP.", dataset: "cockpit" },
};