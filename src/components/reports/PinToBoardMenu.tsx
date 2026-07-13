import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/app-store";
import { seedBoardsForRole } from "@/mocks/mis-boards";
import type { ReportDef } from "@/types";

interface Props {
  /** Called on click; must return a ReportDef (existing or freshly built). */
  buildReport: () => ReportDef;
  /** Widget title shown on the board (defaults to report name). */
  widgetTitle?: string;
  size?: "sm" | "md" | "lg";
  /** Trigger renderer. Defaults to a small "Pin" outline button. */
  trigger?: ReactNode;
}

export function PinToBoardMenu({ buildReport, widgetTitle, size = "md", trigger }: Props) {
  const navigate = useNavigate();
  const misBoards = useAppStore((s) => s.misBoards);
  const reports = useAppStore((s) => s.reports);
  const role = useAppStore((s) => s.currentRole);
  const userId = useAppStore((s) => s.currentUserId);
  const addBoard = useAppStore((s) => s.addMISBoard);
  const addWidget = useAppStore((s) => s.addMISWidget);
  const addReport = useAppStore((s) => s.addReport);

  const ownedBoards = misBoards.filter((b) => b.ownerId === userId);
  const seededBoards = ownedBoards.some((b) => b.defaultForRole === role) ? [] : seedBoardsForRole(role, userId);
  const pinTargets = [...ownedBoards, ...seededBoards];

  const pinTo = (boardId: string) => {
    let def = buildReport();
    // Persist the report if it's not already known.
    if (!reports.some((r) => r.id === def.id)) addReport(def);
    else def = reports.find((r) => r.id === def.id) ?? def;

    const seed = seededBoards.find((b) => b.id === boardId);
    if (seed) addBoard({ ...seed, seeded: false });

    addWidget(boardId, {
      id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      reportId: def.id,
      title: widgetTitle ?? def.name,
      viz: def.viz,
      size,
    });
    const board = pinTargets.find((b) => b.id === boardId);
    toast.success(`Pinned to "${board?.name ?? "board"}"`, {
      action: { label: "Open board", onClick: () => navigate({ to: "/mis/$boardId", params: { boardId } }) },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Pin className="h-3 w-3 mr-1" /> Pin to MIS board
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {pinTargets.length === 0 ? (
          <DropdownMenuItem onClick={() => navigate({ to: "/mis" })}>Create your first board…</DropdownMenuItem>
        ) : (
          <>
            {pinTargets.map((b) => (
              <DropdownMenuItem key={b.id} onClick={() => pinTo(b.id)}>{b.name}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/mis" })}>Manage boards…</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
