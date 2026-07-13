import { createFileRoute } from "@tanstack/react-router";
import { ClientDetail } from "@/components/client/ClientDetail";
import { BackLink } from "@/components/common/BackLink";

export const Route = createFileRoute("/client/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  return (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/client" label="Back to Clients" /></div>
      <ClientDetail id={id} />
    </div>
  );
}
