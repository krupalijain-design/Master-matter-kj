import { ChevronLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Shared in-app back affordance. Prefers browser history when the user
 * arrived from within the app; otherwise navigates to `fallbackTo`.
 */
export function BackLink({
  fallbackTo,
  label = "Back",
  className,
}: {
  fallbackTo: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const onClick = () => {
    const inAppHistory =
      typeof window !== "undefined" && window.history.length > 1;
    if (inAppHistory) {
      router.history.back();
    } else {
      router.navigate({ to: fallbackTo });
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 h-8 px-2 -ml-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className,
      )}
    >
      <ChevronLeft className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}