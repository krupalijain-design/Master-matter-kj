import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard page header: serif H1 + one-line human subtitle. */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-5", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-tight font-normal tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}