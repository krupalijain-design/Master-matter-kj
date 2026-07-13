import { Chip } from "@/components/ui/chip";

export interface HistoryItem {
  id: string;
  who: string;
  what: string;
  at: string;
  source: "Manual" | "Mail rule" | "AI" | "Outlook" | "Clerk email" | "Court sync";
}

export function HistoryTab({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) return <div className="rounded-lg border p-10 text-center text-[13px] text-muted-foreground">No audit events yet.</div>;
  return (
    <div className="rounded-lg border shadow-sm overflow-hidden bg-background">
      <table className="w-full editorial-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Event</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td className="font-mono tabular-nums text-[12px] text-muted-foreground whitespace-nowrap">
                {new Date(it.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </td>
              <td className="text-[13px]">{it.who}</td>
              <td className="text-[13px]">{it.what}</td>
              <td><Chip tone="neutral">{it.source}</Chip></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}