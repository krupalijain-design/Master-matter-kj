import { createFileRoute } from "@tanstack/react-router";
import { MISBoardView } from "@/components/mis/MISBoardView";
import { BackLink } from "@/components/common/BackLink";

export const Route = createFileRoute("/mis/$boardId")({
  component: RouteView,
});

function RouteView() {
  const { boardId } = Route.useParams();
  return (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/mis" label="Back to MIS boards" /></div>
      <MISBoardView boardId={boardId} />
    </div>
  );
}