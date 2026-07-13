import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/app-store";
import { homeRouteFor } from "@/lib/roles";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { currentRole } = useAppStore();
  const [email, setEmail] = useState("kavita.rao@snowfig.in");
  const [pw, setPw] = useState("");
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate({ to: homeRouteFor(currentRole), replace: true });
  };
  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-background border rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary text-primary-foreground grid place-items-center text-xs font-bold">S</div>
          <div className="font-semibold tracking-tight">Snowfig <span className="text-muted-foreground font-normal">LCMS</span></div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="email" className="text-xs">Work email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pw" className="text-xs">Password</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button type="submit" className="w-full">Sign in</Button>
        <div className="relative py-2 text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider bg-background px-2 relative z-10">or</span>
          <div className="absolute inset-x-0 top-1/2 border-t" />
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => submit()}>
          Continue with Microsoft 365
        </Button>
      </form>
    </div>
  );
}
