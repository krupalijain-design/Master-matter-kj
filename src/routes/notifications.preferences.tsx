import { createFileRoute } from "@tanstack/react-router";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { BackLink } from "@/components/common/BackLink";
export const Route = createFileRoute("/notifications/preferences")({
  component: () => (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/notifications" label="Back to Notifications" /></div>
      <NotificationPreferences />
    </div>
  ),
});