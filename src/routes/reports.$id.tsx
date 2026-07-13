import { createFileRoute } from "@tanstack/react-router";
import { ReportRun } from "@/components/reports/ReportRun";
import { BackLink } from "@/components/common/BackLink";
export const Route = createFileRoute("/reports/$id")({
  component: RouteView,
});
function RouteView() {
  const { id } = Route.useParams();
  return (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/reports" label="Back to Reports" /></div>
      <ReportRun id={id} />
    </div>
  );
}