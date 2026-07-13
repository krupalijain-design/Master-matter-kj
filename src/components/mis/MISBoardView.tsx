import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Clock, Share2, Trash2, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { seedBoardsForRole } from "@/mocks/mis-boards";
import { canSeeBoard } from "@/lib/mis";
import { MISWidget } from "@/components/mis/MISWidget";
import { AddWidgetDialog } from "@/components/mis/AddWidgetDialog";
import type { MISBoard, ReportVisibility } from "@/types";

function useResolvedBoards(): MISBoard[] {
  const boards = useAppStore((s) => s.misBoards);
  const role = useAppStore((s) => s.currentRole);
  const userId = useAppStore((s) => s.currentUserId);
  const shares = useAppStore((s) => s.misBoardShares);
  const { data: users } = useUsers();
  const user = users.find((u) => u.id === userId) ?? users[0];
  return useMemo(() => {
    if (!user) return boards;
    const owned = boards.filter((b) => b.ownerId === userId);
    const hasSeed = owned.some((b) => b.defaultForRole === role);
    const seed = hasSeed ? [] : seedBoardsForRole(role, userId);
    const visible = boards.filter((b) => b.ownerId !== userId && canSeeBoard(user, b, shares[b.id]));
    return [...owned, ...seed, ...visible];
  }, [boards, role, userId, user, shares]);
}

export function MISBoardView({ boardId }: { boardId: string }) {
  const navigate = useNavigate();
  const boards = useResolvedBoards();
  const board = boards.find((b) => b.id === boardId);
  const userId = useAppStore((s) => s.currentUserId);
  const role = useAppStore((s) => s.currentRole);
  const { data: users } = useUsers();
  const addBoard = useAppStore((s) => s.addMISBoard);
  const updateBoard = useAppStore((s) => s.updateMISBoard);
  const deleteBoard = useAppStore((s) => s.deleteMISBoard);
  const addWidget = useAppStore((s) => s.addMISWidget);
  const updateWidget = useAppStore((s) => s.updateMISWidget);
  const removeWidget = useAppStore((s) => s.removeMISWidget);
  const moveWidget = useAppStore((s) => s.moveMISWidget);
  const shareBoardWith = useAppStore((s) => s.shareMISBoardWith);
  const recordDelivery = useAppStore((s) => s.recordMISBoardDelivery);
  const shares = useAppStore((s) => s.misBoardShares);
  const [addOpen, setAddOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(board?.name ?? "");
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!board) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <Link to="/mis"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />All boards</Button></Link>
        <div className="mt-8 text-center text-muted-foreground">Board not found.</div>
      </div>
    );
  }

  const isOwner = board.ownerId === userId;
  const isSeed = !!board.seeded && board.ownerId === userId;
  // Seed becomes real on first mutation
  const materializeSeed = () => {
    if (isSeed) {
      addBoard({ ...board, seeded: false });
    }
  };

  const owner = users.find((u) => u.id === board.ownerId);

  const handleShareBoard = (userIds: string[], visibility: ReportVisibility) => {
    materializeSeed();
    updateBoard(board.id, { visibility });
    shareBoardWith(board.id, userIds);
    toast.success(`Board shared with ${userIds.length} ${userIds.length === 1 ? "person" : "people"}.`);
    setShareOpen(false);
  };

  const scheduleBoard = () => {
    materializeSeed();
    const at = new Date().toISOString();
    recordDelivery(board.id, {
      at,
      status: "delivered",
      trace: [
        { step: "Snapshot compiled", status: "ok", at },
        { step: "Digest queued", status: "ok", at },
        { step: "Delivered to in-app", status: "ok", at },
      ],
    });
    toast.success("Board snapshot scheduled. A digest card was queued for each recipient.", {
      action: { label: "View delivery", onClick: () => toast.info("Delivery trace saved. See Reports > Schedules.") },
    });
  };

  const commitName = () => {
    materializeSeed();
    if (nameDraft.trim() && nameDraft !== board.name) {
      updateBoard(board.id, { name: nameDraft.trim() });
    }
    setNameEditing(false);
  };

  const onAddWidget = (w: Parameters<typeof addWidget>[1]) => {
    materializeSeed();
    addWidget(board.id, w);
    toast.success("Widget pinned.");
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/mis"><Button variant="ghost" size="sm" className="h-7 px-2"><ArrowLeft className="h-4 w-4 mr-1" />All boards</Button></Link>
        {isSeed && <Badge variant="outline" className="text-[10px]">Seeded default · {role}</Badge>}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {nameEditing && isOwner ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameDraft(board.name); setNameEditing(false); } }}
              className="font-display text-[26px] h-auto py-0 border-0 shadow-none focus-visible:ring-0 px-0"
            />
          ) : (
            <h1
              className={"font-display text-[28px] leading-tight tracking-tight text-foreground " + (isOwner ? "cursor-text hover:bg-muted/40 rounded px-1 -mx-1" : "")}
              onClick={() => { if (isOwner) { setNameDraft(board.name); setNameEditing(true); } }}
              title={isOwner ? "Click to rename" : undefined}
            >{board.name}</h1>
          )}
          <p className="mt-1 text-[13px] text-muted-foreground">
            {board.subtitle ?? "Your pinned numbers. Each widget trims to your scope."}
            {owner && !isOwner && <> · by {owner.fullName}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={scheduleBoard}><Clock className="h-3.5 w-3.5 mr-1" />Schedule board</Button>
          {isOwner && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}><Share2 className="h-3.5 w-3.5 mr-1" />Share board</Button>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add widget</Button>
              {!isSeed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 px-2">…</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-danger" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" />Delete board
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      </div>

      {board.widgets.length === 0 ? (
        <div className="border rounded-xl bg-surface p-10 text-center">
          <div className="font-display text-[20px]">Pin your first number.</div>
          <p className="text-sm text-muted-foreground mt-1">Start from a template or a report you already run.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add widget</Button>
            <Link to="/reports"><Button variant="outline">Go to templates</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3">
          {board.widgets.map((w) => (
            <MISWidget
              key={w.id}
              boardId={board.id}
              widget={w}
              editable={isOwner}
              onMove={(dir) => { materializeSeed(); moveWidget(board.id, w.id, dir); }}
              onRemove={() => { materializeSeed(); removeWidget(board.id, w.id); }}
              onResize={(size) => { materializeSeed(); updateWidget(board.id, w.id, { size }); }}
            />
          ))}
        </div>
      )}

      <AddWidgetDialog open={addOpen} onOpenChange={setAddOpen} onAdd={onAddWidget} />

      <ShareBoardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        board={board}
        initialShareIds={shares[board.id] ?? []}
        onSubmit={handleShareBoard}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this board?</AlertDialogTitle>
            <AlertDialogDescription>Widgets and share settings will be removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteBoard(board.id); toast.success("Board deleted."); navigate({ to: "/mis" }); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ShareBoardDialog({
  open, onOpenChange, board, initialShareIds, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  board: MISBoard;
  initialShareIds: string[];
  onSubmit: (userIds: string[], visibility: ReportVisibility) => void;
}) {
  const { data: users } = useUsers();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(initialShareIds.map((id) => [id, true])));
  const [visibility, setVisibility] = useState<ReportVisibility>(board.visibility);
  const filtered = users.filter((u) => u.fullName.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const submit = () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    onSubmit(ids, visibility);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader><DialogTitle>Share board</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Visibility</Label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(["Private", "Team", "Practice"] as ReportVisibility[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={"px-2.5 py-1 text-[12px] rounded-md border " + (visibility === v ? "border-accent bg-accent/10 text-accent" : "hover:bg-muted/50")}
                >{v}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Shared boards render trimmed data per viewer. Two people see the same board with their own scope.
            </p>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Also share directly with people</Label>
            <Input placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs mt-1" />
            <div className="border rounded-md mt-2 max-h-[240px] overflow-y-auto divide-y">
              {filtered.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={!!selected[u.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [u.id]: !!v }))} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{u.fullName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{u.roles.join(", ")}</div>
                  </div>
                  {initialShareIds.includes(u.id) && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                </label>
              ))}
              {filtered.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">No people.</div>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}