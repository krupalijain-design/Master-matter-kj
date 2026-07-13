import { Outlet, useRouterState } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { LensChip } from "./LensChip";
import { RouteGuard } from "./RouteGuard";
import { QuickTimeOverlay } from "@/components/timesheet/QuickTimeOverlay";
import { DemoScript } from "./DemoScript";

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/login") return <Outlet />;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <LensChip />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <RouteGuard />
        </main>
      </div>
      <QuickTimeOverlay />
      <DemoScript />
    </div>
  );
}