import { createFileRoute } from "@tanstack/react-router";
import { DiaryConsole } from "@/components/diary/DiaryConsole";
export const Route = createFileRoute("/diary")({ component: DiaryConsole });
