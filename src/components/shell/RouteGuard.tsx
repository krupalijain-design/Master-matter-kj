import { useNavigate, useRouterState, Outlet } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { pathAllowedByRole, rolesGrantingPath, homeRouteFor } from "@/rbac/matrix";

const OPEN_PATHS = ["/", "/login", "/notifications"];

export function RouteGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { currentUserId, currentRole, setCurrentRole, appendAudit } = useAppStore();
  const { data: users } = useUsers();
  const navigate = useNavigate();
  const me = users.find((u) => u.id === currentUserId);

  if (!me || OPEN_PATHS.includes(pathname)) return <Outlet />;
  if (pathAllowedByRole(pathname, currentRole)) return <Outlet />;

  const otherGrantors = rolesGrantingPath(pathname, me.roles).filter((r) => r !== currentRole);
  if (otherGrantors.length > 0) {
    const suggest = otherGrantors[0];
    return (
      <>
        <div className="border-b bg-warning/10 px-4 h-9 flex items-center gap-2 text-[12px]">
          <Lock className="h-3 w-3 text-warning" />
          <span>This is a {suggest} surface. Switch lens to interact.</span>
          <Button size="sm" variant="outline" className="h-6 ml-2 text-[11px]"
            onClick={() => { setCurrentRole(suggest); navigate({ to: homeRouteFor(suggest) }); }}>
            Switch to {suggest}
          </Button>
        </div>
        <Outlet />
      </>
    );
  }

  // No held role permits this route: designed "No access" state
  const requestAccess = () => {
    appendAudit({ actor: me.id, actorName: me.fullName, activeRole: currentRole, action: `Requested access to ${pathname}`, resource: pathname });
    toast.success("Access request sent", { description: "Notified Admin Manager. You'll hear back once granted." });
  };

  return (
    <div className="p-10 max-w-xl mx-auto text-center">
      <div className="mx-auto h-10 w-10 rounded-full bg-muted grid place-items-center mb-3">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-semibold">No access to this surface</h1>
      <p className="text-[13px] text-muted-foreground mt-1">
        Your current roles don't grant access to <span className="font-mono">{pathname}</span>.
      </p>
      <Alert className="mt-4 text-left">
        <AlertDescription className="text-[12px]">
          You can request access and Admin Manager will decide. Access decisions are logged.
        </AlertDescription>
      </Alert>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate({ to: homeRouteFor(currentRole) })}>Back to home</Button>
        <Button size="sm" onClick={requestAccess}>Request access</Button>
      </div>
    </div>
  );
}
