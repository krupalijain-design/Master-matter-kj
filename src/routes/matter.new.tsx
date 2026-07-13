import { createFileRoute } from "@tanstack/react-router";
import { MatterNewForm } from "@/components/matter-new/MatterNewForm";

type NewMatterSearch = { fromMail?: string };

export const Route = createFileRoute("/matter/new")({
  validateSearch: (search: Record<string, unknown>): NewMatterSearch => ({
    fromMail: typeof search.fromMail === "string" ? search.fromMail : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { fromMail } = Route.useSearch();
  return <MatterNewForm fromMailId={fromMail} />;
}
