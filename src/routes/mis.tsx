import { createFileRoute } from "@tanstack/react-router";
import { MISHome } from "@/components/mis/MISHome";

export const Route = createFileRoute("/mis")({
  component: MISHome,
});