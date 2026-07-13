import { createFileRoute } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
export const Route = createFileRoute("/notifications")({ component: NotificationCenter });