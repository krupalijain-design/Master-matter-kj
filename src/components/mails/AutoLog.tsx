import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Download, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMails, useMatters, useClients } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { decideAll, isSampled } from "@/lib/autodocket";
import { formatDistanceToNow } from "date-fns";

export function AutoLog() {
  const { data: mails } = useMails();
  const { data: matters } = useMatters();
  const { data: clients } = useClients();
  const cfg = useAppStore((s) => s.autodocketConfig);
  const verdicts = useAppStore((s) => s.auditVerdicts);
  const overrides = useAppStore((s) => s.autoFileOverrides);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const decisions = decideAll(mails, cfg).filter((d) => d.route === "auto-file");
    return decisions.map((d) => {
      const mail = mails.find((m) => m.id === d.mailId)!;
      const overridden = overrides[d.mailId];
      const targetId = overridden === null ? undefined : overridden?.matterId ?? d.targetMatterId;
      const matter = targetId ? matters.find((m) => m.id === targetId) : undefined;
      const client = matter ? clients.find((c) => c.id === matter.clientId) : undefined;
      const sampled = isSampled(d.mailId, cfg.samplePct);
      const verdict = verdicts[d.mailId];
      return { d, mail, matter, client, sampled, verdict, rerouted: overridden === null };
    });
  }, [mails, cfg, matters, clients, verdicts, overrides]);

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.d.acsNo.toLowerCase().includes(search.toLowerCase()) ||
      r.mail.subject.toLowerCase().includes(search.toLowerCase()) ||
      (r.matter?.title.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  const total = rows.length;
  const sampledCount = rows.filter((r) => r.sampled).length;
  const wrongCount = rows.filter((r) => r.verdict?.verdict === "wrong").length;
  const overrideCount = rows.filter((r) => r.rerouted).length;
  const stpRate = mails.filter((m) => m.state === "Pending").length > 0 ? Math.round((total / mails.filter((m) => m.state === "Pending" || m.state === "Tagged").length) * 100) : 100;
  const sampleErrorRate = sampledCount ? Math.round((wrongCount / sampledCount) * 100) : 0;
  const overrideRate = total ? Math.round((overrideCount / total) * 100) : 0;

  const exportCsv = () => {
    const header = "ACS,Subject,Confidence,Matter,Sampled,Verdict,At\n";
    const body = filtered
      .map((r) =>
        [r.d.acsNo, JSON.stringify(r.mail.subject), r.d.confidence, r.matter?.matterId ?? "", r.sampled, r.verdict?.verdict ?? "", r.mail.receivedAt].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auto-docket-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-medium">Auto-docketing log</h1>
        <p className="text-sm text-muted-foreground">
          Straight-through processed mails, sampled and reversible.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="STP rate" value={`${stpRate}%`} />
        <Stat label="Sampled" value={`${sampledCount} / ${total}`} sub={`${cfg.samplePct}% policy`} />
        <Stat label="Sample error rate" value={`${sampleErrorRate}%`} accent={sampleErrorRate > 2 ? "warn" : undefined} />
        <Stat label="Override rate" value={`${overrideRate}%`} />
      </div>

      {sampleErrorRate > 2 && (
        <Alert variant="default" className="border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
          <AlertTitle>Sample error rate above 2%</AlertTitle>
          <AlertDescription>
            Consider raising T_auto in{" "}
            <Link to="/admin/rules" className="underline">automation rules</Link>.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <Input placeholder="Search ACS, subject, matter…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 max-w-sm text-sm" />
        <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full compact-table">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">ACS</th>
              <th className="text-left px-3 py-2 font-medium">Subject</th>
              <th className="text-left px-3 py-2 font-medium">Filed to</th>
              <th className="text-left px-3 py-2 font-medium">Confidence</th>
              <th className="text-left px-3 py-2 font-medium">Sampled</th>
              <th className="text-left px-3 py-2 font-medium">Verdict</th>
              <th className="text-left px-3 py-2 font-medium">At</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-muted-foreground">No auto-filed mails.</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.d.mailId} className={cn("border-t border-border", r.rerouted && "bg-[hsl(var(--danger))]/5")}>
                  <td className="px-3 py-2 font-mono text-[11px]">{r.d.acsNo}</td>
                  <td className="px-3 py-2 truncate max-w-[280px]">{r.mail.subject || "(no subject)"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.matter ? (
                      <Link to="/matter/$id" params={{ id: r.matter.id }} className="hover:underline">
                        <span className="font-mono text-xs mr-1">{r.matter.matterId}</span>
                        {r.matter.title}
                      </Link>
                    ) : (
                      <span className="italic">rerouted</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      {Math.round(r.d.confidence * 100)}%
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.sampled ? "Yes" : "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.verdict ? (
                      <Badge variant="outline" className={cn("font-mono text-[10px]", r.verdict.verdict === "wrong" ? "border-[hsl(var(--danger))]/40 text-[hsl(var(--danger))]" : "border-[hsl(var(--success))]/40 text-[hsl(var(--success))]")}>
                        {r.verdict.verdict}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.mail.receivedAt), { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "warn" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono tabular-nums text-xl mt-1",
          accent === "warn" && "text-[hsl(var(--warning))]",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}