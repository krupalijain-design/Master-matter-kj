import { Eye } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";

export function LensChip() {
  const { currentUserId, currentRole } = useAppStore();
  const { data: users } = useUsers();
  const me = users.find((u) => u.id === currentUserId);
  if (!me || me.roles.length < 2) return null;
  return (
    <div className="border-b bg-muted/40 px-4 h-7 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Eye className="h-3 w-3" />
      <span>Viewing as</span>
      <span className="text-foreground font-medium">{currentRole}</span>
      <span className="text-muted-foreground">·</span>
      <span>Actions available across all held roles ({me.roles.length}).</span>
    </div>
  );
}
