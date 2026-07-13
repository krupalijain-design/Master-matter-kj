import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, LayoutDashboard, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { seedBoardsForRole } from "@/mocks/mis-boards";
import { canSeeBoard } from "@/lib/mis";
import type { MISBoard } from "@/types";

export function MISHome() {
  const navigate = useNavigate();
  const boards = useAppStore((s) => s.misBoards);
  const role = useAppStore((s) => s.currentRole);
  const userId = useAppStore((s) => s.currentUserId);
  const shares = useAppStore((s) => s.misBoardShares);
  const addBoard = useAppStore((s) => s.addMISBoard);
  const { data: users } = useUsers();
  const user = users.find((u) => u.id === userId) ?? users[0];
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

  const owned = useMemo(() => boards.filter((b) => b.ownerId === userId), [boards, userId]);
  const hasSeed = owned.some((b) => b.defaultForRole === role);
  const seeded = hasSeed ? [] : seedBoardsForRole(role, userId);
  const mine: MISBoard[] = [...owned, ...seeded];
  const shared = useMemo(
    () => (user ? boards.filter((b) => b.ownerId !== userId && canSeeBoard(user, b, shares[b.id])) : []),
    [boards, user, userId, shares],
  );

  const create = () => {
    if (!name.trim()) return;
    const id = `mb-${Date.now().toString(36)}`;
    addBoard({
      id,
      ownerId: userId,
      name: name.trim(),
      subtitle: "",
      widgets: [],
      visibility: "Private",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setName("");
    setNewOpen(false);
    toast.success("Board created.");
    navigate({ to: "/mis/$boardId", params: { boardId: id } });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="MIS boards"
        subtitle="Cockpits are opinionated. Boards are yours. Pin the numbers you look at every morning."
        actions={<Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />New board</Button>}
      />

      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">My boards</div>
        {mine.length === 0 ? (
          <EmptyMine onNew={() => setNewOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mine.map((b) => <BoardCard key={b.id} board={b} />)}
          </div>
        )}
      </section>

      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Shared with me</div>
        {shared.length === 0 ? (
          <div className="border rounded-lg bg-surface p-6 text-sm text-muted-foreground text-center">Nothing shared yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shared.map((b) => <BoardCard key={b.id} board={b} shared />)}
          </div>
        )}
      </section>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader><DialogTitle>New board</DialogTitle></DialogHeader>
          <div>
            <Label className="text-[11px] text-muted-foreground">Board name</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Collections focus" className="mt-1" onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoardCard({ board, shared }: { board: MISBoard; shared?: boolean }) {
  const { data: users } = useUsers();
  const owner = users.find((u) => u.id === board.ownerId);
  return (
    <Link to="/mis/$boardId" params={{ boardId: board.id }} className="block border rounded-xl bg-surface p-4 hover:border-accent/50 hover:shadow-sm transition">
      <div className="flex items-start gap-2">
        <LayoutDashboard className="h-4 w-4 mt-0.5 text-accent shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[17px] leading-tight truncate">{board.name}</div>
          {board.subtitle && <div className="text-[12px] text-muted-foreground truncate">{board.subtitle}</div>}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">{board.widgets.length} widget{board.widgets.length === 1 ? "" : "s"}</Badge>
            <Badge variant="outline" className="text-[10px]">{board.visibility}</Badge>
            {board.seeded && <Badge variant="outline" className="text-[10px] border-accent/40 text-accent"><Sparkles className="h-2.5 w-2.5 mr-1" />Seeded</Badge>}
            {shared && owner && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />{owner.fullName}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyMine({ onNew }: { onNew: () => void }) {
  return (
    <div className="border rounded-xl bg-surface p-8 text-center">
      <div className="font-display text-[20px]">Pin your first number.</div>
      <p className="text-sm text-muted-foreground mt-1">Start from a template →</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-1" />New board</Button>
        <Link to="/reports"><Button variant="outline">Browse templates</Button></Link>
      </div>
    </div>
  );
}