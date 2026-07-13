import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeamManagerPipeline } from "@/components/pipeline/TeamManagerPipeline";
import { AutomationTab } from "@/components/pipeline/AutomationTab";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

function PipelinePage() {
  const { data: users } = useUsers();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const roles = currentUser?.roles ?? [];

  const canSeeAutomation =
    roles.includes("Team Manager") ||
    roles.includes("Admin Manager") ||
    roles.includes("Group Head") ||
    roles.includes("Practice Head") ||
    roles.includes("Executive Head") ||
    roles.includes("Management");
  const canManageRules = roles.includes("Team Manager") || roles.includes("Admin Manager");

  const [tab, setTab] = useState<"pipeline" | "automation">("pipeline");

  if (!canSeeAutomation) {
    return <TeamManagerPipeline />;
  }

  return (
    <div className="p-6 space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-0">
          <div className="-mx-6 -mt-4">
            <TeamManagerPipeline />
          </div>
        </TabsContent>
        <TabsContent value="automation" className="mt-4">
          <AutomationTab canManageRules={canManageRules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
