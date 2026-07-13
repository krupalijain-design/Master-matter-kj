import { createFileRoute } from "@tanstack/react-router";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { BackLink } from "@/components/common/BackLink";
export const Route = createFileRoute("/reports/$id/edit")({
  component: RouteView,
});
function RouteView() {
  const { id } = Route.useParams();
  return (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/reports" label="Back to Reports" /></div>
      <ReportBuilder existingId={id} />
    </div>
  );
}