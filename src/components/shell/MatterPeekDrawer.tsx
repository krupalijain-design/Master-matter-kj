import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Gavel } from "lucide-react";
import { useMatters, useClients, useUsers, useHearings, useRtbs } from "@/hooks/use-data";
import { formatINR } from "@/lib/format";

export function MatterPeekDrawer({
  matterId,
  onClose,
  loading,
}: {
  matterId: string | null;
  onClose: () => void;
  loading?: boolean;
}) {
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const { data: hearings } = useHearings();
  const { data: rtbs } = useRtbs();
  const m = matters.find((x) => x.id === matterId);
  const c = m ? clients.find((x) => x.id === m.clientId) : null;
  const nextHearing = m
    ? hearings
        .filter((h) => h.matterId === m.id && new Date(h.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
    : null;
  const matterRtbs = m ? rtbs.filter((r) => r.matterId === m.id) : [];
  const billed = matterRtbs.reduce((s, r) => s + r.billingAmount, 0);
  const outstanding = matterRtbs.reduce((s, r) => s + r.outstandingAmount, 0);
  const teamNames = m
    ? [m.casePartnerId, m.caseManagerId, ...m.caseAssociateIds]
        .filter((x): x is string => !!x)
        .map((id) => users.find((u) => u.id === id)?.fullName)
        .filter(Boolean)
    : [];

  return (
    <Sheet open={!!matterId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-none p-0 flex flex-col">
        {(loading || !m) ? (
          <div className="p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-3/4" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="px-5 py-4 border-b">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">#{m.matterId}</span>
                <Badge variant="outline" className="text-[10px]">{m.branch}</Badge>
                <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                <span className="ml-auto text-[10px]">{m.status} · {m.pipelineState}</span>
              </div>
              <SheetTitle className="text-base leading-snug">{m.title}</SheetTitle>
            </SheetHeader>
            <div className="p-5 space-y-4 text-sm overflow-y-auto">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Client</div>
                <div>{c?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Team</div>
                <div className="flex flex-wrap gap-1">
                  {teamNames.length === 0 && <span className="text-muted-foreground">—</span>}
                  {teamNames.map((n) => (
                    <Badge key={n} variant="secondary" className="text-[10px] font-normal">{n}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Next hearing</div>
                {nextHearing ? (
                  <div className="flex items-center gap-2">
                    <Gavel className="h-3.5 w-3.5 text-accent" />
                    <span className="font-mono tabular-nums text-[12px]">
                      {new Date(nextHearing.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-muted-foreground text-[12px]">· {nextHearing.forum}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-[12px]">No hearing scheduled.</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 bg-muted/30">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Billed</div>
                  <div className="font-mono tabular-nums text-sm">{formatINR(billed)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
                  <div className={`font-mono tabular-nums text-sm ${outstanding > 0 ? "text-warning" : ""}`}>{formatINR(outstanding)}</div>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Issue in brief</div>
                <div className="text-muted-foreground text-[13px] leading-relaxed">{m.issueInBrief}</div>
              </div>
              <Link
                to="/matter/$id"
                params={{ id: m.id }}
                onClick={onClose}
                className="inline-flex items-center gap-1 text-accent text-sm hover:underline"
              >
                Open full matter <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
