import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/store/app-store";
import { useMails, useUsers } from "@/hooks/use-data";
import { decideAll } from "@/lib/autodocket";
import { cn } from "@/lib/utils";
import type { MailTag, Role } from "@/types";

const search = z.object({
  focus: z
    .enum(["tAuto", "tMaker", "samplePct", "killSwitch", "exclusions", "queues", "perTag"])
    .optional(),
});

export const Route = createFileRoute("/admin/rules")({
  component: AutomationRules,
  validateSearch: (s) => search.parse(s),
});

const TAGS: MailTag[] = [
  "New Matter", "Existing Matter", "Query", "Reminder", "Payment", "Expense Voucher", "Feedback", "Appreciation", "Complaint",
];

function AutomationRules() {
  const cfg = useAppStore((s) => s.autodocketConfig);
  const update = useAppStore((s) => s.updateAutodocketConfig);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);
  const { data: users } = useUsers();
  const currentUser = users.find((u) => u.id === currentUserId);
  const roles = currentUser?.roles ?? [];
  const canManageAll = roles.some((r) => r === "Admin Manager" || r === "DB Admin");
  const canQueueOnly = roles.includes("Team Manager") && !canManageAll;
  const readOnly = !canManageAll && !canQueueOnly;

  const { focus } = Route.useSearch();
  const tAutoRef = useRef<HTMLInputElement>(null);
  const tMakerRef = useRef<HTMLInputElement>(null);
  const sampleRef = useRef<HTMLInputElement>(null);
  const killRef = useRef<HTMLButtonElement>(null);
  const exclusionsRef = useRef<HTMLDivElement>(null);
  const queuesRef = useRef<HTMLDivElement>(null);
  const perTagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map: Record<string, HTMLElement | null> = {
      tAuto: tAutoRef.current,
      tMaker: tMakerRef.current,
      samplePct: sampleRef.current,
      killSwitch: killRef.current,
      exclusions: exclusionsRef.current,
      queues: queuesRef.current,
      perTag: perTagRef.current,
    };
    const el = focus ? map[focus] : null;
    if (el) {
      (el as HTMLElement).focus?.();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focus]);

  const ring = (key: string) =>
    focus === key ? "ring-2 ring-[hsl(var(--accent))] ring-offset-2 rounded-md" : "";

  const audit = (action: string) =>
    appendAudit({ actor: currentUserId, actorName: "You", activeRole: currentRole, action, resource: "admin" });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[26px] font-normal tracking-tight">Docketing rules</h1>
          <p className="text-sm text-muted-foreground">Exclusions, queue rotation, and automation thresholds. Changes apply immediately.</p>
        </div>
        {readOnly && <Badge variant="outline">Read-only</Badge>}
        {canQueueOnly && <Badge variant="outline">Queue mapping only</Badge>}
      </div>

      {cfg.killSwitch && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Kill switch active</AlertTitle>
          <AlertDescription>All inbound mail is routing to Docketer triage. Auto-file, Maker suggestions, and Checker sampling are paused.</AlertDescription>
        </Alert>
      )}

      <ImpactPreview />

      {/* Thresholds + kill switch */}
      <section className="rounded-lg border border-border p-4 space-y-4">
        <SectionHeader title="Automation thresholds" desc="Consumed by the /mails engine and /mails/auto-log." />

        <div className={cn("flex items-center justify-between p-1", ring("killSwitch"))}>
          <div>
            <Label className="text-sm">Kill switch, route 100% to Docketer</Label>
            <p className="text-xs text-muted-foreground">Use when the extractor misbehaves.</p>
          </div>
          <Switch
            ref={killRef}
            disabled={!canManageAll}
            checked={cfg.killSwitch}
            onCheckedChange={(v) => {
              update({ killSwitch: v });
              audit(v ? "Automation kill switch turned ON" : "Automation kill switch turned OFF");
              toast.success(v ? "Kill switch on" : "Kill switch off");
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className={cn("space-y-1.5 p-1", ring("tAuto"))}>
            <Label className="text-xs">T_auto (straight-through)</Label>
            <Input
              ref={tAutoRef} disabled={!canManageAll}
              type="number" step={0.01} min={0.5} max={1}
              value={cfg.tAuto}
              onChange={(e) => update({ tAuto: Number(e.target.value) })}
              className="font-mono h-8 text-sm"
            />
          </div>
          <div className={cn("space-y-1.5 p-1", ring("tMaker"))}>
            <Label className="text-xs">T_maker (below → Docketer)</Label>
            <Input
              ref={tMakerRef} disabled={!canManageAll}
              type="number" step={0.01} min={0} max={1}
              value={cfg.tMaker}
              onChange={(e) => update({ tMaker: Number(e.target.value) })}
              className="font-mono h-8 text-sm"
            />
          </div>
          <div className={cn("space-y-1.5 p-1", ring("samplePct"))}>
            <Label className="text-xs">Audit sample %</Label>
            <Input
              ref={sampleRef} disabled={!canManageAll}
              type="number" step={5} min={0} max={100}
              value={cfg.samplePct}
              onChange={(e) => update({ samplePct: Number(e.target.value) })}
              className="font-mono h-8 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Per-tag enable */}
      <section ref={perTagRef} className={cn("rounded-lg border border-border p-4 space-y-3", ring("perTag"))}>
        <SectionHeader title="Per-tag automation" desc="Disable to force human triage for a category, without touching thresholds." />
        <div className="grid grid-cols-3 gap-2">
          {TAGS.map((t) => {
            const enabled = cfg.perTagEnabled?.[t] !== false;
            return (
              <label key={t} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5">
                <span className="text-[13px]">{t}</span>
                <Switch
                  disabled={!canManageAll}
                  checked={enabled}
                  onCheckedChange={(v) => {
                    update({ perTagEnabled: { ...(cfg.perTagEnabled ?? {}), [t]: v } });
                    audit(`Per-tag automation ${v ? "enabled" : "disabled"}: ${t}`);
                  }}
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* Exclusions & spam */}
      <section ref={exclusionsRef} className={cn("rounded-lg border border-border p-4 space-y-4", ring("exclusions"))}>
        <SectionHeader title="Ingestion exclusions" desc="Senders, domains, and subject patterns that never enter the pipeline." />
        <ListEditor
          label="Excluded senders (email addresses)"
          items={cfg.excludedSenders ?? []}
          disabled={!canManageAll}
          placeholder="noreply@example.com"
          onChange={(items) => { update({ excludedSenders: items }); audit(`Excluded senders updated (${items.length})`); }}
        />
        <ListEditor
          label="Excluded domains"
          items={cfg.excludedDomains ?? []}
          disabled={!canManageAll}
          placeholder="mailer.example.com"
          onChange={(items) => { update({ excludedDomains: items }); audit(`Excluded domains updated (${items.length})`); }}
        />
        <ListEditor
          label="Subject patterns"
          items={cfg.excludedSubjectPatterns ?? []}
          disabled={!canManageAll}
          placeholder="Out of office"
          onChange={(items) => { update({ excludedSubjectPatterns: items }); audit(`Subject patterns updated (${items.length})`); }}
        />
        <ExclusionsTester cfg={cfg} />
      </section>

      {/* Queue membership */}
      <section ref={queuesRef} className={cn("rounded-lg border border-border p-4 space-y-4", ring("queues"))}>
        <SectionHeader title="Queue membership & weights" desc="Round-robin distribution across pipeline roles. 0 removes from rotation." />
        {(["docketer", "maker", "checker"] as const).map((q) => (
          <QueueWeights key={q} queue={q} users={users} disabled={!canManageAll && !canQueueOnly} />
        ))}
      </section>
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function ImpactPreview() {
  const cfg = useAppStore((s) => s.autodocketConfig);
  const { data: mails } = useMails();
  const stats = useMemo(() => {
    const decisions = decideAll(mails, cfg);
    const total = mails.length;
    const auto = decisions.filter((d) => d.route === "auto-file").length;
    const maker = decisions.filter((d) => d.route === "maker").length;
    const docketer = decisions.filter((d) => d.route === "docketer").length;
    return { total, auto, maker, docketer, autoPct: total ? Math.round((auto / total) * 100) : 0 };
  }, [mails, cfg]);
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[13px]">
      Current settings would have auto-filed <span className="font-mono tabular-nums font-medium">{stats.autoPct}%</span> of the last {stats.total} mails
      <span className="text-muted-foreground"> ({stats.auto} auto · {stats.maker} maker · {stats.docketer} triage)</span>.
    </div>
  );
}

function ListEditor({ label, items, onChange, placeholder, disabled }: { label: string; items: string[]; onChange: (next: string[]) => void; placeholder: string; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder} disabled={disabled} className="h-8 text-sm font-mono"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={disabled || !draft.trim()}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.map((it) => (
            <span key={it} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2 pr-1 py-0.5 text-[11px] font-mono">
              {it}
              <button
                type="button" disabled={disabled}
                onClick={() => onChange(items.filter((x) => x !== it))}
                className="rounded-full hover:bg-muted p-0.5 disabled:opacity-40"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExclusionsTester({ cfg }: { cfg: ReturnType<typeof useAppStore.getState>["autodocketConfig"] }) {
  const [sample, setSample] = useState("");
  const result = useMemo(() => {
    if (!sample.trim()) return null;
    const [from = "", subject = ""] = sample.split("|").map((s) => s.trim());
    const domain = from.split("@")[1]?.toLowerCase() ?? "";
    const senderHit = (cfg.excludedSenders ?? []).some((s) => s.toLowerCase() === from.toLowerCase());
    const domainHit = (cfg.excludedDomains ?? []).some((d) => domain.includes(d.toLowerCase()));
    const subjectHit = (cfg.excludedSubjectPatterns ?? []).some((p) => subject.toLowerCase().includes(p.toLowerCase()));
    return { blocked: senderHit || domainHit || subjectHit, senderHit, domainHit, subjectHit };
  }, [sample, cfg]);
  return (
    <div className="pt-2 border-t border-border/60">
      <Label className="text-xs">Test against a sample</Label>
      <Input
        value={sample} onChange={(e) => setSample(e.target.value)}
        placeholder="from@example.com | Subject line"
        className="h-8 mt-1 text-sm font-mono"
      />
      {result && (
        <div className={cn("mt-1.5 text-[12px]", result.blocked ? "text-destructive" : "text-muted-foreground")}>
          {result.blocked
            ? `Would be blocked (${[result.senderHit && "sender", result.domainHit && "domain", result.subjectHit && "subject"].filter(Boolean).join(", ")})`
            : "Would pass through"}
        </div>
      )}
    </div>
  );
}

function QueueWeights({ queue, users, disabled }: { queue: "docketer" | "maker" | "checker"; users: ReturnType<typeof useUsers>["data"]; disabled: boolean }) {
  const membership = useAppStore((s) => s.queueMembership);
  const setWeight = useAppStore((s) => s.setQueueWeight);
  const appendAudit = useAppStore((s) => s.appendAudit);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentRole = useAppStore((s) => s.currentRole);

  const roleFor: Record<typeof queue, Role> = { docketer: "Docketer", maker: "Maker", checker: "Checker" };
  const eligible = users.filter((u) => u.roles.includes(roleFor[queue]));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[13px] font-medium capitalize">{queue} rotation</div>
        <div className="text-[11px] text-muted-foreground">{eligible.length} eligible</div>
      </div>
      <div className="space-y-1.5">
        {eligible.length === 0 && <div className="text-[12px] text-muted-foreground italic">No users hold the {roleFor[queue]} role.</div>}
        {eligible.map((u) => {
          const w = membership[queue][u.id] ?? 1;
          return (
            <div key={u.id} className="grid grid-cols-[1fr_180px_40px] items-center gap-3 text-[12px]">
              <div className="truncate">{u.fullName} <span className="text-muted-foreground">· {u.branch}</span></div>
              <Slider
                value={[w]} min={0} max={5} step={1} disabled={disabled}
                onValueChange={([v]) => {
                  setWeight(queue, u.id, v);
                  appendAudit({ actor: currentUserId, actorName: "You", activeRole: currentRole, action: `${roleFor[queue]} queue weight for ${u.fullName} set to ${v}`, resource: "admin" });
                }}
              />
              <div className="font-mono tabular-nums text-right">{w === 0 ? "off" : `×${w}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}