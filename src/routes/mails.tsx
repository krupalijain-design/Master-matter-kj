import { useState } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { MailInbox } from "@/components/mails/MailInbox";
import { CheckerReviewQueue } from "@/components/checker/CheckerReviewQueue";
import { MakerQueue } from "@/components/mails/MakerQueue";
import { AuditSampleQueue } from "@/components/checker/AuditSampleQueue";
import { useAppStore } from "@/store/app-store";
import { useUsers, useMatters } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/mails")({ component: Layout });

type MailsTab = "inbox" | "maker" | "review" | "audit";

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const { data: users } = useUsers();
  const { data: matters } = useMatters();
  const overrides = useAppStore((s) => s.matterPipelineOverrides);
  const [tab, setTab] = useState<MailsTab>("inbox");

  if (pathname !== "/mails") return <Outlet />;

  const currentUser = users.find((u) => u.id === currentUserId);
  const isChecker = currentRole === "Checker" || (currentUser?.roles.includes("Checker") ?? false);
  const isMaker = currentRole === "Maker" || (currentUser?.roles.includes("Maker") ?? false);

  const pendingReviewCount = matters.filter(
    (m) => m.createdVia === "mail" && m.pipelineState === "Pending" && !overrides[m.id],
  ).length + Object.values(overrides).filter((o) => o.pipelineState === "Pending").length;

  if (!isChecker && !isMaker) return <MailInbox />;

  const tabs: { key: MailsTab; label: string; badge?: number; accent?: boolean; show: boolean }[] = [
    { key: "inbox", label: "Inbox", show: true },
    { key: "maker", label: "Maker queue", show: isMaker },
    { key: "review", label: "Review queue", badge: pendingReviewCount, accent: true, show: isChecker },
    { key: "audit", label: "Audit sample", show: isChecker },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b border-border px-4 flex items-center gap-1">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px flex items-center gap-2",
              tab === t.key
                ? "border-[hsl(var(--accent))] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {typeof t.badge === "number" && (
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-[11px]",
                  t.accent && t.badge > 0 && "border-[hsl(var(--accent))]/50 text-[hsl(var(--accent))]",
                )}
              >
                {t.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "inbox" && <MailInbox />}
        {tab === "maker" && <MakerQueue />}
        {tab === "review" && <CheckerReviewQueue />}
        {tab === "audit" && <AuditSampleQueue />}
      </div>
    </div>
  );
}
