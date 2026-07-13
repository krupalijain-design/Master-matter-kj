import { useNavigate } from "@tanstack/react-router";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator,
} from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { homeRouteFor } from "@/rbac/matrix";
import { roleDef, CATEGORY_LABEL } from "@/rbac/matrix";
import type { Role, RoleCategory } from "@/types";

const ORDER: RoleCategory[] = ["matter-ops", "pipeline", "leadership", "support"];

export function RoleSwitcher() {
  const { currentUserId, currentRole, setCurrentRole } = useAppStore();
  const { data: users } = useUsers();
  const navigate = useNavigate();
  const me = users.find((u) => u.id === currentUserId);
  if (!me) return null;

  const grouped: Record<RoleCategory, Role[]> = { "matter-ops": [], pipeline: [], leadership: [], support: [] };
  me.roles.forEach((r) => {
    const def = roleDef(r);
    if (def) grouped[def.category].push(r);
  });

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => {
        const role = v as Role;
        setCurrentRole(role);
        navigate({ to: homeRouteFor(role) });
      }}
    >
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER.map((cat, idx) => {
          const items = grouped[cat];
          if (items.length === 0) return null;
          return (
            <SelectGroup key={cat}>
              {idx > 0 && <SelectSeparator />}
              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{CATEGORY_LABEL[cat]}</SelectLabel>
              {items.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
