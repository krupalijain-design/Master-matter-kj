import { createFileRoute } from "@tanstack/react-router";
import { AutoLog } from "@/components/mails/AutoLog";
import { BackLink } from "@/components/common/BackLink";
export const Route = createFileRoute("/mails/auto-log")({
  component: () => (
    <div>
      <div className="px-6 pt-4"><BackLink fallbackTo="/mails" label="Back to Inbox" /></div>
      <AutoLog />
    </div>
  ),
});
