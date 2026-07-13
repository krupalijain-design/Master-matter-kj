import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";

export function ShareReportDrawer({
  open,
  onOpenChange,
  reportId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportId: string;
}) {
  const { data: users } = useUsers();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const reportShares = useAppStore((s) => s.reportShares);
  const shareReportWith = useAppStore((s) => s.shareReportWith);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>(reportShares[reportId] ?? []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users
      .filter((u) => u.id !== currentUserId)
      .filter((u) => !term || u.fullName.toLowerCase().includes(term) || u.roles.some((r) => r.toLowerCase().includes(term)))
      .slice(0, 40);
  }, [users, currentUserId, q]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = () => {
    shareReportWith(reportId, selected);
    toast.success(`Shared with ${selected.length} ${selected.length === 1 ? "person" : "people"}. Each sees rows trimmed to their own scope.`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-5 border-b">
          <SheetTitle className="font-display text-[20px] font-normal">Share this report</SheetTitle>
          <p className="text-xs text-muted-foreground">Named recipients see the report definition, but rows are always scope-trimmed to them.</p>
        </SheetHeader>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search people by name or role"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {selected.map((id) => {
                const u = users.find((x) => x.id === id);
                if (!u) return null;
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[11px]">
                    {u.fullName}
                    <button onClick={() => toggle(id)} className="hover:bg-background rounded p-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">No people match.</div>
          )}
          {filtered.map((u) => {
            const on = selected.includes(u.id);
            return (
              <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 border-b hover:bg-muted/40 cursor-pointer">
                <Checkbox checked={on} onCheckedChange={() => toggle(u.id)} />
                <div className="w-7 h-7 rounded-full bg-accent/10 text-accent text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                  {u.avatarInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{u.fullName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{u.roles.join(" · ")}</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={save}>Save sharing</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}