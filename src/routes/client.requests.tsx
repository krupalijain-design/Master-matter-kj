import { createFileRoute } from "@tanstack/react-router";
import { ClientRequestsQueue } from "@/components/client/ClientRequestsQueue";
import { BackLink } from "@/components/common/BackLink";

export const Route = createFileRoute("/client/requests")({
  component: () => (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/client" label="Back to Clients" /></div>
      <ClientRequestsQueue />
    </div>
  ),
});
