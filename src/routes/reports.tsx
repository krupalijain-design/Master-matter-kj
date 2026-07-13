import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ReportsHome } from "@/components/reports/ReportsHome";
export const Route = createFileRoute("/reports")({ component: Layout });
function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/reports") return <Outlet />;
  return <ReportsHome />;
}
