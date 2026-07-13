import { createFileRoute } from "@tanstack/react-router";
import { TimesheetGrid } from "@/components/timesheet/TimesheetGrid";
export const Route = createFileRoute("/timesheet")({
  component: TimesheetGrid,
  validateSearch: (s: Record<string, unknown>) => ({
    day: typeof s.day === "string" ? s.day : undefined,
    filter: typeof s.filter === "string" ? s.filter : undefined,
  }),
});
