import { createFileRoute } from "@tanstack/react-router";
import { CollectionsWorkspace } from "@/components/accounts/CollectionsWorkspace";
export const Route = createFileRoute("/collections")({ component: CollectionsWorkspace });
