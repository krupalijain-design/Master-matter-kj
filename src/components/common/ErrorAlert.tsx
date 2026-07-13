import { AlertTriangle, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Generates a stable-ish mono error ID from any seed string. */
export function errorId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `LCMS-${h.toString(16).toUpperCase().slice(0, 4).padStart(4, "0")}`;
}

export function InlineErrorAlert({
  title,
  message,
  errorSeed,
  onRetry,
}: {
  title: string;
  message: string;
  errorSeed: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" className="my-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {title}
        <span className="font-mono text-[11px] font-normal opacity-80">{errorId(errorSeed)}</span>
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="h-7">
            <RotateCw className="h-3.5 w-3.5 mr-1" /> Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}