import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsWorkspace } from "@/components/approvals/ApprovalsWorkspace";
export const Route = createFileRoute("/approvals")({ component: ApprovalsWorkspace });
