import type { ReactNode } from "react";

export function PageStub({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="font-display text-3xl font-normal tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}