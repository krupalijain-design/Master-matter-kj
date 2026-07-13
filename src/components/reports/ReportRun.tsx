import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BellPlus, Download, Pencil, Pin, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/app-store";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { useRunContext } from "@/components/reports/useRunContext";
import { firmTemplates } from "@/mocks/reports";
import { useUsers } from "@/hooks/use-data";
import { ShareReportDrawer } from "@/components/reports/ShareReportDrawer";
import { seedBoardsForRole } from "@/mocks/mis-boards";

const visibilityTone = (v: string): ChipTone =>
  v === "Private" ? "neutral" : v === "Team" ? "info" : v === "Practice" ? "accent" : "success";

export function ReportRun({ id }: { id: string }) {
  const navigate = useNavigate();
  const reports = useAppStore((s) => s.reports);
  const touchReportRun = useAppStore((s) => s.touchReportRun);
  const templateOverrides = useAppStore((s) => s.templateOverrides);
  const subscriptions = useAppStore((s) => s.reportSubscriptions);
  const addSubscription = useAppStore((s) => s.addSubscription);
  const userId = useAppStore((s) => s.currentUserId);
  const role = useAppStore((s) => s.currentRole);
  const misBoards = useAppStore((s) => s.misBoards);
  const addBoard = useAppStore((s) => s.addMISBoard);
  const addWidget = useAppStore((s) => s.addMISWidget);
  const { data: users } = useUsers();
  const search = useRouterState({ select: (s) => s.location.search }) as unknown as Record<string, string | undefined>;
  const origin = search.origin;
  const [shareOpen, setShareOpen] = useState(false);

  const tplBase = firmTemplates.find((r) => r.id === id);
  const def = reports.find((r) => r.id === id) ?? templateOverrides[id] ?? tplBase;
  const ctx = useRunContext();

  useEffect(() => {
    if (def && reports.some((r) => r.id === id)) touchReportRun(id);
  }, [def?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) {
    return (
      <div className="p-6 max-w-[900px] mx-auto">
        <PageHeader title="Report not found" subtitle="It may have been deleted." />
        <Link to="/reports"><Button variant="outline" size="sm">Back to Reports</Button></Link>
      </div>
    );
  }

  const isTemplate = !!tplBase;
  const alreadySubscribed = subscriptions.some((s) => s.reportId === id && s.subscriberId === userId);
  const owner = users.find((u) => u.id === def.ownerId);
  const subscribe = () => {
    addSubscription({
      id: `sub-${Date.now().toString(36)}`,
      reportId: id,
      subscriberId: userId,
      cadence: "weekly",
      channel: "in-app",
      time: "08:00",
      paused: false,
      createdAt: new Date().toISOString(),
    });
    toast.success("Subscribed. A personal schedule was added to Reports > Schedules.");
  };

  const ownedBoards = misBoards.filter((b) => b.ownerId === userId);
  const seededBoards = ownedBoards.some((b) => b.defaultForRole === role) ? [] : seedBoardsForRole(role, userId);
  const pinTargets = [...ownedBoards, ...seededBoards];

  const pinToBoard = (boardId: string) => {
    const seed = seededBoards.find((b) => b.id === boardId);
    if (seed) addBoard({ ...seed, seeded: false });
    addWidget(boardId, {
      id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      reportId: def!.id,
      title: def!.name,
      viz: def!.viz,
      size: "md",
    });
    const board = pinTargets.find((b) => b.id === boardId);
    toast.success(`Pinned to "${board?.name ?? "board"}".`, {
      action: { label: "Open board", onClick: () => navigate({ to: "/mis/$boardId", params: { boardId } }) },
    });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <PageHeader
        title={def.name}
        subtitle={def.description || "Ad hoc filters do not mutate the saved report."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={subscribe} disabled={alreadySubscribed}>
              <BellPlus className="h-3.5 w-3.5 mr-1" />{alreadySubscribed ? "Subscribed" : "Subscribe"}
            </Button>
            {!isTemplate && def.ownerId === userId && (
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                <Share2 className="h-3.5 w-3.5 mr-1" />Share
              </Button>
            )}
            {!isTemplate && (
              <Link to="/reports/$id/edit" params={{ id: def.id }}>
                <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => toast.success("Excel export queued")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.success("CSV export queued")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.success("PDF export queued")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Pin className="h-3.5 w-3.5 mr-1" />Pin to MIS board</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {pinTargets.length === 0 && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/mis" })}>Create your first board…</DropdownMenuItem>
                )}
                {pinTargets.map((b) => (
                  <DropdownMenuItem key={b.id} onClick={() => pinToBoard(b.id)}>{b.name}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        {origin && (
          <Chip tone="accent" icon={null}>
            From: {origin}
            <button
              aria-label="Remove origin"
              onClick={() => navigate({ to: "/reports/$id", params: { id }, search: {} as never })}
              className="ml-1 -mr-1 rounded hover:brightness-95 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Chip>
        )}
        <Chip tone={visibilityTone(def.visibility)}>{def.visibility}</Chip>
        <Chip tone="neutral">v{def.version}</Chip>
        {owner && def.ownerId !== userId && (
          <span className="text-[11px] text-muted-foreground">by {owner.fullName}</span>
        )}
        {def.filters.map((f) => (
          <Chip key={f.id} tone="neutral">
            {f.field} {f.op} {typeof f.value === "object" ? JSON.stringify(f.value) : String(f.value ?? "")}
          </Chip>
        ))}
      </div>

      <ReportPreview def={def} ctx={ctx} />
      <ShareReportDrawer open={shareOpen} onOpenChange={setShareOpen} reportId={id} />
    </div>
  );
}