import { createFileRoute } from "@tanstack/react-router";
import { ManagementCockpit } from "@/components/cockpit/ManagementCockpit";
export const Route = createFileRoute("/cockpit/firm")({ component: () => <ManagementCockpit forceFirm /> });
