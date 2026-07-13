import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ClientList } from "@/components/client/ClientList";

export const Route = createFileRoute("/client")({ component: Layout });

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/client") return <Outlet />;
  return <ClientList />;
}
