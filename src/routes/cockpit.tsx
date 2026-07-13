import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PartnerCockpit } from "@/components/cockpit/PartnerCockpit";
export const Route = createFileRoute("/cockpit")({ component: Layout });
function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/cockpit") return <Outlet />;
  return <PartnerCockpit />;
}
