import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Pin, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMails } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { decideAll, isSampled } from "@/lib/autodocket";
import type { MailTag } from "@/types";
import { PinToBoardMenu } from "@/components/reports/PinToBoardMenu";
import { firmTemplates } from "@/mocks/reports";
import type { ReportDef } from "@/types";
import { getMetricColor } from "@/lib/theme-colors";

/** Template id used when pinning a headline automation stat to an MIS board. */
const STAT_TEMPLATE_BY_LABEL: Record<string, string> = {
  "Straight-through": "tpl-pipeline-stp",
  "Maker queue": "tpl-pipeline-queue-mix",
  "Docketer triage": "tpl-pipeline-queue-mix",
  "AI field acceptance": "tpl-pipeline-ai-acceptance",
  "Checker sample error": "tpl-pipeline-ai-acceptance",
  "Auto-file override": "tpl-pipeline-stp",
  "Avg human seconds / mail": "tpl-pipeline-queue-mix",
  "Client alias match saves": "tpl-pipeline-queue-mix",
};

function buildStatReport(label: string): ReportDef {
  const id = STAT_TEMPLATE_BY_LABEL[label] ?? "tpl-pipeline-stp";
  const tpl = firmTemplates.find((r) => r.id === id)!;
  return { ...tpl, name: `${label} · pipeline`, viz: "Summary" };
}

type FocusKey = "tAuto" | "tMaker" | "samplePct" | "killSwitch";

interface Suggestion {
  id: string;
  title: string;
  detail: string;
  focus: FocusKey;
  tone: "info" | "warn";
}

export function AutomationTab({ canManageRules }: { canManageRules: boolean }) {
  const { data: mails } = useMails();
  const cfg = useAppStore((s) => s.autodocketConfig);
  const verdicts = useAppStore((s) => s.auditVerdicts);
  const overrides = useAppStore((s) => s.autoFileOverrides);
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const decisions = decideAll(mails, cfg);
    const pendingScope = decisions.filter((d) => d.reason !== `state=Discarded` && d.reason !== `state=Flagged`);
    const total = pendingScope.length || 1;
    const auto = pendingScope.filter((d) => d.route === "auto-file");
    const maker = pendingScope.filter((d) => d.route === "maker");
    const dock = pendingScope.filter((d) => d.route === "docketer");

    const sampled = auto.filter((d) => isSampled(d.mailId, cfg.samplePct));
    const wrongVerdicts = sampled.filter((d) => verdicts[d.mailId]?.verdict === "wrong").length;
    const overrideCount = auto.filter((d) => overrides[d.mailId] === null).length;

    // AI field acceptance: of mails the human touched (Tagged), how often the AI tag survived.
    const humanTouched = mails.filter((m) => m.state === "Tagged" && m.aiSuggestedTag);
    const accepted = humanTouched.filter((m) => m.tag === m.aiSuggestedTag).length;
    const aiAcceptancePct = humanTouched.length
      ? Math.round((accepted / humanTouched.length) * 100)
      : 0;

    // Alias saves: mails matched to a candidate via entityHit (client alias/name).
    const aliasSaves = mails.filter(
      (m) => m.matchCandidates.some((c) => c.entityHit),
    ).length;

    // Deterministic mock: avg human seconds/mail across Maker + Docketer queue.
    const humanRoute = maker.length + dock.length;
    const avgSec = humanRoute
      ? Math.round(9 + (humanRoute % 7))
      : 11;

    return {
      stpPct: Math.round((auto.length / total) * 100),
      makerPct: Math.round((maker.length / total) * 100),
      dockPct: Math.round((dock.length / total) * 100),
      avgSec,
      sampledCount: sampled.length,
      wrongVerdicts,
      sampleErrorPct: sampled.length ? Math.round((wrongVerdicts / sampled.length) * 100) : 0,
      overridePct: auto.length ? Math.round((overrideCount / auto.length) * 100) : 0,
      aiAcceptancePct,
      aliasSaves,
      autoCount: auto.length,
      makerCount: maker.length,
      dockCount: dock.length,
      total,
    };
  }, [mails, cfg, verdicts, overrides]);

  // Per-tag breakdown from decisions + verdicts.
  const tagRows = useMemo(() => {
    const decisions = decideAll(mails, cfg);
    const groups = new Map<MailTag, { volume: number; auto: number; sampled: number; wrong: number }>();
    for (const d of decisions) {
      const tag = d.suggestedTag;
      if (!tag) continue;
      const g = groups.get(tag) ?? { volume: 0, auto: 0, sampled: 0, wrong: 0 };
      g.volume += 1;
      if (d.route === "auto-file") {
        g.auto += 1;
        if (isSampled(d.mailId, cfg.samplePct)) {
          g.sampled += 1;
          if (verdicts[d.mailId]?.verdict === "wrong") g.wrong += 1;
        }
      }
      groups.set(tag, g);
    }
    return [...groups.entries()]
      .map(([tag, g]) => ({
        tag,
        volume: g.volume,
        stpPct: g.volume ? Math.round((g.auto / g.volume) * 100) : 0,
        errorPct: g.sampled ? Math.round((g.wrong / g.sampled) * 100) : 0,
        sampled: g.sampled,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [mails, cfg, verdicts]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    // Rule 1: any tag with high STP and zero sampled errors → propose lower sampling.
    for (const r of tagRows) {
      if (r.stpPct >= 95 && r.sampled >= 3 && r.errorPct === 0 && cfg.samplePct > 5) {
        out.push({
          id: `sample-${r.tag}`,
          title: `${r.tag} mails: ${r.stpPct}% STP, 0 sampled errors in ${r.sampled} audits`,
          detail: `Consider lowering audit sample from ${cfg.samplePct}% → ${Math.max(5, cfg.samplePct - 5)}% to free Checker time.`,
          focus: "samplePct",
          tone: "info",
        });
      }
    }
    // Rule 2: overall sample-error rate > 2% → raise T_auto.
    if (stats.sampleErrorPct > 2) {
      out.push({
        id: "raise-tauto",
        title: `Sample error rate ${stats.sampleErrorPct}% is above 2% target`,
        detail: `Raise T_auto from ${cfg.tAuto.toFixed(2)} → ${Math.min(0.99, cfg.tAuto + 0.03).toFixed(2)} to tighten straight-through.`,
        focus: "tAuto",
        tone: "warn",
      });
    }
    // Rule 3: AI acceptance below 75% → review extraction prompt.
    if (stats.aiAcceptancePct > 0 && stats.aiAcceptancePct < 75) {
      out.push({
        id: "acceptance-low",
        title: `AI tag suggestions accepted only ${stats.aiAcceptancePct}% of the time`,
        detail: `Review Sub Type and tag extraction prompts; raise T_maker to route more items for human review.`,
        focus: "tMaker",
        tone: "warn",
      });
    }
    // Rule 4: override rate > 10% → tighten T_auto.
    if (stats.overridePct > 10) {
      out.push({
        id: "override-high",
        title: `Auto-file override rate ${stats.overridePct}% on straight-through items`,
        detail: `Auditors are rerouting more than 1 in 10. Raise T_auto to ${Math.min(0.99, cfg.tAuto + 0.02).toFixed(2)}.`,
        focus: "tAuto",
        tone: "warn",
      });
    }
    // Rule 5: kill switch on → remind.
    if (cfg.killSwitch) {
      out.push({
        id: "kill-on",
        title: "Kill switch is on, everything routes to Docketer",
        detail: "STP is disabled. Turn off the kill switch to resume auto-filing once the extractor is stable.",
        focus: "killSwitch",
        tone: "warn",
      });
    }
    return out;
  }, [tagRows, stats, cfg]);

  // Deterministic 8-week sparkline series anchored on current values.
  const trend = (seed: number, base: number, spread: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < 8; i++) {
      const v = base + Math.round(Math.sin((seed + i) * 1.7) * spread + Math.cos((seed + i) * 0.9) * spread * 0.4);
      out.push(Math.max(0, v));
    }
    out[7] = base;
    return out;
  };

  const openRule = (focus: FocusKey) => {
    void navigate({ to: "/admin/rules", search: { focus } });
  };

  return (
    <div className="space-y-4">
      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Straight-through"
          value={`${stats.stpPct}%`}
          sub={`${stats.autoCount} auto-filed / ${stats.total}`}
          series={trend(1, stats.stpPct, 5)}
          tone={stats.stpPct >= 55 ? "success" : undefined}
        />
        <StatCard
          label="Maker queue"
          value={`${stats.makerPct}%`}
          sub={`${stats.makerCount} mails`}
          series={trend(2, stats.makerPct, 4)}
        />
        <StatCard
          label="Docketer triage"
          value={`${stats.dockPct}%`}
          sub={`${stats.dockCount} mails`}
          series={trend(3, stats.dockPct, 4)}
        />
        <StatCard
          label="Avg human seconds / mail"
          value={`${stats.avgSec}s`}
          sub={`Budget 13s`}
          series={trend(4, stats.avgSec, 2)}
          tone={stats.avgSec > 13 ? "warn" : "success"}
        />
        <StatCard
          label="Checker sample error"
          value={`${stats.sampleErrorPct}%`}
          sub={`${stats.wrongVerdicts} of ${stats.sampledCount} audits`}
          series={trend(5, stats.sampleErrorPct, 1)}
          tone={stats.sampleErrorPct > 2 ? "warn" : "success"}
        />
        <StatCard
          label="AI field acceptance"
          value={`${stats.aiAcceptancePct}%`}
          sub={`Tag suggestion kept by Maker`}
          series={trend(6, stats.aiAcceptancePct, 3)}
          tone={stats.aiAcceptancePct >= 80 ? "success" : stats.aiAcceptancePct < 60 ? "warn" : undefined}
        />
        <StatCard
          label="Auto-file override"
          value={`${stats.overridePct}%`}
          sub={`Rerouted after Checker audit`}
          series={trend(7, stats.overridePct, 2)}
          tone={stats.overridePct > 10 ? "warn" : undefined}
        />
        <StatCard
          label="Client alias match saves"
          value={`${stats.aliasSaves}`}
          sub={`Mails matched via alias / old name`}
          series={trend(8, stats.aliasSaves, 3)}
        />
      </div>

      {/* Per-tag breakdown */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-medium">Per-tag breakdown</div>
          <div className="text-xs text-muted-foreground">
            Volume, straight-through rate, and sampled-error rate by AI-suggested tag.
          </div>
        </div>
        <table className="w-full compact-table">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Tag</th>
              <th className="text-right px-3 py-2 font-medium">Volume</th>
              <th className="text-right px-3 py-2 font-medium">STP %</th>
              <th className="text-right px-3 py-2 font-medium">Sampled</th>
              <th className="text-right px-4 py-2 font-medium">Error %</th>
            </tr>
          </thead>
          <tbody>
            {tagRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                  No AI-tagged mail in this window.
                </td>
              </tr>
            ) : (
              tagRows.map((r) => (
                <tr key={r.tag} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2">{r.tag}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.volume}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.stpPct}%</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.sampled}</td>
                  <td className={cn(
                    "px-4 py-2 text-right font-mono text-xs",
                    r.errorPct > 2 && "text-[hsl(var(--warning))] font-medium",
                    r.errorPct > 5 && "text-[hsl(var(--danger))]",
                  )}>
                    {r.sampled ? `${r.errorPct}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Improvement queue */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
          <div>
            <div className="text-sm font-medium">Improvement queue</div>
            <div className="text-xs text-muted-foreground">
              Suggestions computed from the last week of telemetry.
              {!canManageRules && " Read-only for your role."}
            </div>
          </div>
        </div>
        {suggestions.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No tuning suggestions right now. Rules are within tolerance.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {suggestions.map((s) => (
              <li key={s.id} className="px-4 py-3 flex items-start gap-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-[10px] mt-0.5",
                    s.tone === "warn"
                      ? "border-[hsl(var(--warning))]/40 text-[hsl(var(--warning))]"
                      : "border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))]",
                  )}
                >
                  {s.tone === "warn" ? "Action" : "Tune"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={!canManageRules}
                  onClick={() => openRule(s.focus)}
                >
                  Apply in rules
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  series,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  series: number[];
  tone?: "success" | "warn";
}) {
  const stroke = getMetricColor(label, tone === "warn");
  const trending = series[series.length - 1] - series[0];
  const TrendIcon = trending >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <PinToBoardMenu
          buildReport={() => buildStatReport(label)}
          widgetTitle={label}
          size="sm"
          trigger={
            <button aria-label={`Pin ${label} to MIS board`} className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 p-1">
              <Pin className="h-3 w-3" />
            </button>
          }
        />
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <div className={cn(
          "font-mono tabular-nums text-xl",
          tone === "warn" && "text-[hsl(var(--warning))]",
          tone === "success" && "text-[hsl(var(--success))]",
        )}>
          {value}
        </div>
        <Sparkline data={series} stroke={stroke} />
      </div>
      <div className="flex items-center justify-between mt-1">
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        <TrendIcon className={cn(
          "h-3 w-3",
          trending >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--muted-foreground))]",
        )} />
      </div>
    </div>
  );
}

function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  const w = 80;
  const h = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}