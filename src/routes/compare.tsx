import { createFileRoute } from "@tanstack/react-router";
import { CompareThemesView } from "@/components/CompareThemesView";

export const Route = createFileRoute("/compare")({
  component: CompareThemesView,
});
