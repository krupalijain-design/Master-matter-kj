import { createFileRoute } from "@tanstack/react-router";
import { AllocationQueue } from "@/components/allocation/AllocationQueue";
export const Route = createFileRoute("/matter/allocation")({ component: AllocationQueue });
