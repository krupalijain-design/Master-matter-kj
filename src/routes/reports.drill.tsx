import { createFileRoute } from "@tanstack/react-router";
import { DrilledList } from "@/components/reports/DrilledList";
export const Route = createFileRoute("/reports/drill")({ component: DrilledList });
