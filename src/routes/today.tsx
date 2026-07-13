import { createFileRoute } from "@tanstack/react-router";
import { MyWork } from "@/components/today/MyWork";
export const Route = createFileRoute("/today")({ component: MyWork });
