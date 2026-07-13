import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { firmTemplates } from "@/mocks/reports";
import { COCKPIT_WIDGETS } from "@/mocks/mis-boards";
import type { MISBoardWidget, ReportDef, ReportViz } from "@/types";
import { canSeeReport } from "@/lib/report-engine";
import { useUsers } from "@/hooks/use-data";

type Section = "mine" | "shared" | "templates" | "cockpit";

export function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (w: MISBoardWidget) => void;
}) {
  const reports = useAppStore((s) => s.reports);
  const shares = useAppStore((s) => s.reportShares);
  const userId = useAppStore((s) => s.currentUserId);
  const { data: users } = useUsers();
  const user = users.find((u) => u.id === userId) ?? users[0];
  const [section, setSection] = useState<Section>("mine");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string; viz: ReportViz } | null>(null);
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [viz, setViz] = useState<ReportViz>("Bar");

  const items = useMemo(() => {
    const list: Array<{ id: string; name: string; description?: string; viz: ReportViz }> = [];
    if (section === "mine") {
      reports.filter((r) => r.ownerId === userId).forEach((r) => list.push({ id: r.id, name: r.name, description: r.description, viz: r.viz }));
    } else if (section === "shared") {
      reports
        .filter((r) => r.ownerId !== userId && user && ((canSeeReport(user, r) && r.visibility !== "Private") || (shares[r.id] ?? []).includes(userId)))
        .forEach((r) => list.push({ id: r.id, name: r.name, description: r.description, viz: r.viz }));
    } else if (section === "templates") {
      firmTemplates.forEach((r: ReportDef) => list.push({ id: r.id, name: r.name, description: r.description, viz: r.viz }));
    } else {
      Object.entries(COCKPIT_WIDGETS).forEach(([id, c]) => list.push({ id, name: c.name, description: c.description, viz: "Summary" }));
    }
    const term = q.trim().toLowerCase();
    return term ? list.filter((r) => r.name.toLowerCase().includes(term)) : list;
  }, [section, q, reports, shares, userId, user]);

  const add = () => {
    if (!selected) return;
    onAdd({
      id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      reportId: selected.id,
      title: selected.name,
      viz,
      size,
    });
    setSelected(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader><DialogTitle>Add a widget</DialogTitle></DialogHeader>
        <div className="flex items-center gap-1 border-b -mx-6 px-6 pb-2">
          {([["mine", "My reports"], ["shared", "Shared"], ["templates", "Firm templates"], ["cockpit", "Cockpit"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setSection(k); setSelected(null); }}
              className={"px-2.5 py-1.5 text-[12px] rounded-md " + (section === k ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50")}
            >{l}</button>
          ))}
          <div className="ml-auto"><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="h-7 w-48 text-xs" /></div>
        </div>
        <div className="max-h-[260px] overflow-y-auto -mx-6 px-6 py-2 space-y-1">
          {items.length === 0 && <div className="text-xs text-muted-foreground py-6 text-center">Nothing here yet.</div>}
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => { setSelected({ id: it.id, name: it.name, viz: it.viz }); setViz(it.viz); }}
              className={"w-full text-left border rounded-md p-2.5 flex items-start gap-2 " + (selected?.id === it.id ? "border-accent bg-accent/5" : "hover:bg-muted/40")}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{it.name}</div>
                {it.description && <div className="text-[11px] text-muted-foreground truncate">{it.description}</div>}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{it.viz}</Badge>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Visualization</Label>
            <Select value={viz} onValueChange={(v) => setViz(v as ReportViz)}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Table", "Summary", "Bar", "Line", "Funnel"] as ReportViz[]).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v as "sm" | "md" | "lg")}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small (¼ row)</SelectItem>
                <SelectItem value="md">Medium (½ row)</SelectItem>
                <SelectItem value="lg">Large (full row)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={add} disabled={!selected}>Add widget</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}