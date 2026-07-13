import { createFileRoute } from "@tanstack/react-router";
import { NonBillableWorkspace } from "@/components/nonbillable/NonBillableWorkspace";
export const Route = createFileRoute("/nonbillable")({
  head: () => ({ meta: [{ title: "Non-billable work · Snowfig LCMS" }] }),
  component: NonBillableWorkspace,
});
