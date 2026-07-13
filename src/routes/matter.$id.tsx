import { createFileRoute } from "@tanstack/react-router";
import { MatterDetail } from "@/components/matter-detail/MatterDetail";
import { BackLink } from "@/components/common/BackLink";

export const Route = createFileRoute("/matter/$id")({ component: MatterDetailRoute });

function MatterDetailRoute() {
  const { id } = Route.useParams();
  return (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/matter" label="Back to Matters" /></div>
      <MatterDetail id={id} />
    </div>
  );
}
