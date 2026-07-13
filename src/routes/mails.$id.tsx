import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";
export const Route = createFileRoute("/mails/$id")({ component: () => <PageStub title="Mail" description="Selected mail with attachments, AI suggestion, and match candidates." /> });
