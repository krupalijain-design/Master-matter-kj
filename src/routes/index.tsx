import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { homeRouteFor } from "@/lib/roles";

export const Route = createFileRoute("/")({ component: IndexRedirect });

function IndexRedirect() {
  const navigate = useNavigate();
  const { currentRole } = useAppStore();
  useEffect(() => {
    navigate({ to: homeRouteFor(currentRole), replace: true });
  }, [navigate, currentRole]);
  return null;
}
