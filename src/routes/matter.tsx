import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { MatterList } from "@/components/matter/MatterList";
export const Route = createFileRoute("/matter")({ component: MatterLayout });
function MatterLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/matter") return <Outlet />;
  return <MatterList />;
}
