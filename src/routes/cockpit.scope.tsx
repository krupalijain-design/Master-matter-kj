import { createFileRoute } from "@tanstack/react-router";
import { LeadershipCockpit } from "@/components/leadership/LeadershipCockpit";
export const Route = createFileRoute("/cockpit/scope")({ component: () => <LeadershipCockpit /> });
