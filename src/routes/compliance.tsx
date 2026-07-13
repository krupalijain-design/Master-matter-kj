import { createFileRoute } from "@tanstack/react-router";
import { ComplianceView } from "@/components/hr/ComplianceView";
export const Route = createFileRoute("/compliance")({ component: ComplianceView });
