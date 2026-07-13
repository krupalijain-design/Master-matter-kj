import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, GripVertical, Lock, Plus, Save, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/app-store";
import { useUsers } from "@/hooks/use-data";
import { DATASETS, datasetMeta, fieldMeta, canGrantVisibility } from "@/lib/report-engine";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { useRunContext } from "@/components/reports/useRunContext";
import { defaultReport } from "@/lib/report-engine";
import { firmTemplates } from "@/mocks/reports";
import type { AggregateFn, ReportAggregate, ReportDataset, ReportDef, ReportFilter, ReportFilterOp, ReportViz, ReportVisibility } from "@/types";

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Data", "Shape", "Save & share"] as const;
  return (
    <div className="flex items-center gap-3">
      {items.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className={
              "flex items-center gap-2 text-sm " +
              (active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60")
            }>
              <span className={
                "w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-medium " +
                (active ? "border-accent bg-accent text-accent-foreground" : done ? "border-muted-foreground/40 bg-muted text-foreground" : "border-muted-foreground/30")
              }>{done ? <Check className="h-3.5 w-3.5" /> : n}</span>
              <span className="font-display">{label}</span>
            </div>
            {i < items.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

export function ReportBuilder({ existingId }: { existingId?: string }) {
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const userId = useAppStore((s) => s.currentUserId);
  const user = users.find((u) => u.id === userId) ?? users[0];
  const reports = useAppStore((s) => s.reports);
  const addReport = useAppStore((s) => s.addReport);
  const updateReport = useAppStore((s) => s.updateReport);
  const templateOverrides = useAppStore((s) => s.templateOverrides);
  const saveTemplateOverride = useAppStore((s) => s.saveTemplateOverride);

  const templateBase = existingId ? firmTemplates.find((r) => r.id === existingId) : undefined;
  const isEditingTemplate = !!templateBase;
  const existing = existingId
    ? reports.find((r) => r.id === existingId) ?? (isEditingTemplate ? (templateOverrides[existingId] ?? templateBase) : undefined)
    : undefined;

  const [def, setDef] = useState<ReportDef>(() => existing ?? (user ? defaultReport(user, "matters") : ({} as ReportDef)));
  const [step, setStep] = useState<1 | 2 | 3>(existing ? 2 : 1);
  const [confirmTplOpen, setConfirmTplOpen] = useState(false);
  const [pendingGoRun, setPendingGoRun] = useState(false);
  const ctx = useRunContext();

  const templateUsageCount = useMemo(
    () => (isEditingTemplate && existingId ? reports.filter((r) => r.sourceTemplateId === existingId).length : 0),
    [reports, isEditingTemplate, existingId],
  );

  useEffect(() => {
    if (existing && def.id !== existing.id) setDef(existing);
  }, [existing, def.id]);

  if (!user) return null;

  const ds = datasetMeta(def.dataset);
  const patch = (p: Partial<ReportDef>) => setDef((d) => ({ ...d, ...p }));

  const commitSave = (goRun: boolean) => {
    if (isEditingTemplate) {
      const next: ReportDef = { ...def, isTemplate: true, visibility: "Firm-template", version: (def.version ?? 1) + 1 };
      saveTemplateOverride(next);
      setDef(next);
      toast.success(`Template "${next.name}" saved as v${next.version}. Existing copies are unaffected.`);
    } else if (existing) {
      updateReport(def.id, def);
      toast.success(`Saved "${def.name || "Untitled report"}"`);
    } else {
      addReport(def);
      toast.success(`Saved "${def.name || "Untitled report"}"`);
    }
    navigate({ to: goRun ? "/reports/$id" : "/reports", params: goRun ? { id: def.id } : (undefined as never) });
  };

  const save = (goRun: boolean) => {
    if (isEditingTemplate) {
      setPendingGoRun(goRun);
      setConfirmTplOpen(true);
      return;
    }
    commitSave(goRun);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <PageHeader
        title={existing ? `${isEditingTemplate ? "Edit template" : "Edit"}: ${existing.name}` : "New report"}
        subtitle={isEditingTemplate ? `Firm template · v${def.version} · used by ${templateUsageCount} ${templateUsageCount === 1 ? "person" : "people"} (copies are snapshots and stay on their version).` : "Build it once, run it forever."}
        actions={
          <div className="flex items-center gap-2">
            {step > 1 && <Button variant="outline" size="sm" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}><ArrowLeft className="h-3.5 w-3.5 mr-1" />Back</Button>}
            {step < 3 && <Button size="sm" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>Next<ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>}
            {step === 3 && (
              <>
                <Button variant="outline" size="sm" onClick={() => save(false)}><Save className="h-3.5 w-3.5 mr-1" />Save</Button>
                <Button size="sm" onClick={() => save(true)}>Save & run</Button>
              </>
            )}
          </div>
        }
      />
      <Stepper step={step} />

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DATASETS.map((d) => {
            const gated = d.gated?.(user);
            const selected = def.dataset === d.key;
            return (
              <button
                key={d.key}
                disabled={gated}
                onClick={() => {
                  const fresh = defaultReport(user, d.key, def.name || "Untitled report");
                  setDef({ ...fresh, id: def.id, ownerId: user.id });
                }}
                className={
                  "text-left bg-surface border rounded-xl p-5 transition-all " +
                  (gated ? "opacity-60 cursor-not-allowed" : "hover:shadow-sm ") +
                  (selected ? "border-accent ring-1 ring-accent/40" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-[18px]">{d.label}</div>
                  {gated && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{gated ? d.gateReason : d.description}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {d.fields.slice(0, 6).map((f) => {
                    const isGated = f.gated?.(user);
                    return (
                      <Badge key={f.key} variant="outline" className={"text-[10px] " + (isGated ? "opacity-60 line-through" : "")}>
                        {isGated && <Lock className="h-2.5 w-2.5 mr-1" />}
                        {f.label}
                      </Badge>
                    );
                  })}
                  {d.fields.length > 6 && <span className="text-[10px] text-muted-foreground self-center">+{d.fields.length - 6} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-5">
          <div className="space-y-5">
            <SectionCard title="Columns">
              <ColumnPicker def={def} onChange={patch} />
            </SectionCard>
            <SectionCard title="Filters">
              <FilterList def={def} onChange={patch} />
            </SectionCard>
            <SectionCard title="Group & aggregate">
              <GroupAgg def={def} onChange={patch} />
            </SectionCard>
            <SectionCard title="Sort & limit">
              <SortLimit def={def} onChange={patch} />
            </SectionCard>
            <SectionCard title="Visualisation & format">
              <VizFormat def={def} onChange={patch} />
            </SectionCard>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Live preview</div>
            <ReportPreview def={def} ctx={ctx} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-[440px,1fr] gap-5">
          <div className="space-y-4">
            <SectionCard title="Name & description">
              <Input placeholder="Name" value={def.name} onChange={(e) => patch({ name: e.target.value })} />
              <Textarea placeholder="What does this report answer?" value={def.description ?? ""} onChange={(e) => patch({ description: e.target.value })} className="mt-2 min-h-[80px]" />
            </SectionCard>
            <SectionCard title="Visibility">
              <VisibilityPicker def={def} onChange={patch} />
            </SectionCard>
            <SectionCard title="Schedule (optional)">
              <SchedulePicker def={def} onChange={patch} />
            </SectionCard>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Final preview</div>
            <ReportPreview def={def} ctx={ctx} />
          </div>
        </div>
      )}

      <AlertDialog open={confirmTplOpen} onOpenChange={setConfirmTplOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish template v{(def.version ?? 1) + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              This template is currently used by {templateUsageCount} {templateUsageCount === 1 ? "person" : "people"}. Their existing copies are snapshots and will not change. New "Use as template" clicks will pick up v{(def.version ?? 1) + 1}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmTplOpen(false); commitSave(pendingGoRun); }}>Publish v{(def.version ?? 1) + 1}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}

function ColumnPicker({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const { data: users } = useUsers();
  const userId = useAppStore((s) => s.currentUserId);
  const user = users.find((u) => u.id === userId) ?? users[0];
  const ds = datasetMeta(def.dataset);
  const toggle = (k: string) => {
    const has = def.columns.includes(k);
    onChange({ columns: has ? def.columns.filter((x) => x !== k) : [...def.columns, k] });
  };
  const move = (k: string, dir: -1 | 1) => {
    const i = def.columns.indexOf(k);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= def.columns.length) return;
    const arr = [...def.columns];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange({ columns: arr });
  };
  const relabel = (k: string, label: string) => onChange({ columnLabels: { ...def.columnLabels, [k]: label } });
  return (
    <TooltipProvider>
      <div className="space-y-1.5">
        {ds.fields.map((f) => {
          const gated = user && f.gated?.(user);
          const selected = def.columns.includes(f.key);
          const order = def.columns.indexOf(f.key);
          return (
            <div key={f.key} className="flex items-center gap-2 text-sm">
              {gated ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 opacity-60 flex-1">
                      <Lock className="h-3.5 w-3.5" />
                      <span className="line-through">{f.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{f.gateReason ?? "Restricted"}</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <Checkbox checked={selected} onCheckedChange={() => toggle(f.key)} />
                  {selected ? (
                    <Input value={def.columnLabels[f.key] ?? f.label} onChange={(e) => relabel(f.key, e.target.value)} className="h-7 text-xs flex-1" />
                  ) : (
                    <span className="flex-1">{f.label}</span>
                  )}
                  {selected && (
                    <div className="flex items-center gap-0.5">
                      <button className="p-0.5 hover:bg-muted rounded" onClick={() => move(f.key, -1)} disabled={order === 0}><ChevronUp className="h-3 w-3" /></button>
                      <button className="p-0.5 hover:bg-muted rounded" onClick={() => move(f.key, 1)} disabled={order === def.columns.length - 1}><ChevronDown className="h-3 w-3" /></button>
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function FilterList({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const ds = datasetMeta(def.dataset);
  const usable = ds.fields.filter((f) => !f.gated);
  const add = () => {
    const first = usable[0];
    if (!first) return;
    const f: ReportFilter = { id: `f-${Date.now().toString(36)}`, field: first.key, op: "eq", value: "" };
    onChange({ filters: [...def.filters, f] });
  };
  const update = (id: string, p: Partial<ReportFilter>) =>
    onChange({ filters: def.filters.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  const remove = (id: string) => onChange({ filters: def.filters.filter((f) => f.id !== id) });

  return (
    <div className="space-y-2">
      {def.filters.length === 0 && <div className="text-xs text-muted-foreground">No filters. Every row will show.</div>}
      {def.filters.map((f) => {
        const meta = fieldMeta(def.dataset, f.field);
        const ops: ReportFilterOp[] = meta?.type === "date"
          ? ["between", "relative", "eq"]
          : meta?.type === "number" || meta?.type === "currency"
            ? ["eq", "gte", "lte"]
            : meta?.type === "enum"
              ? ["eq", "neq", "in"]
              : ["eq", "neq", "contains"];
        return (
          <div key={f.id} className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-1">
            <Select value={f.field} onValueChange={(v) => update(f.id, { field: v, op: "eq", value: "" })}>
              <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{usable.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.op} onValueChange={(v) => update(f.id, { op: v as ReportFilterOp, value: "" })}>
              <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>{ops.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
            <FilterValueInput filter={f} meta={meta} onChange={(v) => update(f.id, { value: v })} />
            <button className="p-1 hover:bg-muted rounded" onClick={() => remove(f.id)}><X className="h-3.5 w-3.5" /></button>
          </div>
        );
      })}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add filter</Button>
        <Button variant="ghost" size="sm" onClick={() => onChange({ filters: [...def.filters, { id: `f-${Date.now()}`, field: "_smart", op: "smart", value: "my_matters" }] })}>
          + My matters
        </Button>
      </div>
    </div>
  );
}

function FilterValueInput({ filter, meta, onChange }: { filter: ReportFilter; meta?: ReturnType<typeof fieldMeta>; onChange: (v: ReportFilter["value"]) => void }) {
  if (filter.op === "smart") return <span className="text-xs text-accent px-1">{String(filter.value)}</span>;
  if (filter.op === "relative") {
    return (
      <Select value={String(filter.value ?? "this_fy")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="this_fy">This FY</SelectItem>
          <SelectItem value="this_month">This month</SelectItem>
          <SelectItem value="last_30d">Last 30 days</SelectItem>
          <SelectItem value="last_7d">Last 7 days</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (filter.op === "between") {
    const b = (filter.value ?? {}) as { from?: string; to?: string };
    return (
      <div className="flex items-center gap-1">
        <Input type="date" className="h-7 text-xs w-[130px]" value={b.from ?? ""} onChange={(e) => onChange({ ...b, from: e.target.value })} />
        <Input type="date" className="h-7 text-xs w-[130px]" value={b.to ?? ""} onChange={(e) => onChange({ ...b, to: e.target.value })} />
      </div>
    );
  }
  if (filter.op === "in") {
    const arr = Array.isArray(filter.value) ? (filter.value as string[]) : [];
    if (meta?.type === "enum" && meta.enumValues) {
      return (
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {meta.enumValues.map((v) => {
            const active = arr.includes(v);
            return (
              <button
                key={v}
                className={"text-[10px] px-1.5 py-0.5 rounded border " + (active ? "bg-accent/10 border-accent text-accent" : "border-border text-muted-foreground")}
                onClick={() => onChange(active ? arr.filter((x) => x !== v) : [...arr, v])}
              >{v}</button>
            );
          })}
        </div>
      );
    }
    return <Input className="h-7 text-xs w-[180px]" placeholder="comma separated" value={arr.join(",")} onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />;
  }
  if (meta?.type === "enum" && meta.enumValues) {
    return (
      <Select value={String(filter.value ?? "")} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue placeholder="value" /></SelectTrigger>
        <SelectContent>{meta.enumValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  const inputType = meta?.type === "date" ? "date" : (meta?.type === "number" || meta?.type === "currency") ? "number" : "text";
  return <Input type={inputType} className="h-7 text-xs w-[180px]" value={String(filter.value ?? "")} onChange={(e) => onChange(inputType === "number" ? Number(e.target.value) : e.target.value)} />;
}

function GroupAgg({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const ds = datasetMeta(def.dataset);
  const usable = ds.fields.filter((f) => !f.gated);
  const setGroup = (idx: 0 | 1, v: string) => {
    const gb = [...def.groupBy];
    if (v === "__none__") { gb.splice(idx, 1); }
    else { gb[idx] = v; }
    onChange({ groupBy: gb.filter(Boolean).slice(0, 2) });
  };
  const addAgg = () => {
    const numeric = usable.find((f) => f.aggregatable);
    const a: ReportAggregate = numeric ? { field: numeric.key, fn: "sum", label: `Sum ${numeric.label}` } : { field: "*", fn: "count", label: "Count" };
    onChange({ aggregates: [...def.aggregates, a] });
  };
  const updA = (i: number, p: Partial<ReportAggregate>) => onChange({ aggregates: def.aggregates.map((a, j) => (i === j ? { ...a, ...p } : a)) });
  const rmA = (i: number) => onChange({ aggregates: def.aggregates.filter((_, j) => j !== i) });

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Group by (up to 2)</div>
        <div className="flex items-center gap-2">
          {[0, 1].map((i) => (
            <Select key={i} value={def.groupBy[i] ?? "__none__"} onValueChange={(v) => setGroup(i as 0 | 1, v)}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {usable.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Aggregates</div>
        {def.aggregates.map((a, i) => (
          <div key={i} className="flex items-center gap-1 mt-1">
            <Select value={a.fn} onValueChange={(v) => updA(i, { fn: v as AggregateFn })}>
              <SelectTrigger className="h-7 text-xs w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="count">count</SelectItem>
                <SelectItem value="sum">sum</SelectItem>
                <SelectItem value="avg">avg</SelectItem>
              </SelectContent>
            </Select>
            <Select value={a.field} onValueChange={(v) => updA(i, { field: v })}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="*">rows</SelectItem>
                {usable.filter((f) => f.aggregatable).map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-7 text-xs w-[110px]" value={a.label ?? ""} placeholder="label" onChange={(e) => updA(i, { label: e.target.value })} />
            <button className="p-1 hover:bg-muted rounded" onClick={() => rmA(i)}><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="mt-2" onClick={addAgg}><Plus className="h-3.5 w-3.5 mr-1" />Add aggregate</Button>
      </div>
    </div>
  );
}

function SortLimit({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const ds = datasetMeta(def.dataset);
  const options = [...ds.fields.map((f) => ({ v: f.key, l: f.label })), ...def.aggregates.map((a) => ({ v: a.label ?? `${a.fn}_${a.field}`, l: a.label ?? `${a.fn}(${a.field})` }))];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={def.sortBy?.field ?? "__none__"} onValueChange={(v) => onChange({ sortBy: v === "__none__" ? undefined : { field: v, dir: def.sortBy?.dir ?? "desc" } })}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={def.sortBy?.dir ?? "desc"} onValueChange={(v) => def.sortBy && onChange({ sortBy: { field: def.sortBy.field, dir: v as "asc" | "desc" } })}>
          <SelectTrigger className="h-8 text-xs w-[80px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="asc">asc</SelectItem><SelectItem value="desc">desc</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">Row limit</span>
        <Input type="number" className="h-8 text-xs w-24" value={def.limit ?? ""} onChange={(e) => onChange({ limit: e.target.value ? Number(e.target.value) : undefined })} />
      </div>
    </div>
  );
}

function VizFormat({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const vizes: ReportViz[] = ["Table", "Summary", "Bar", "Line", "Funnel"];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {vizes.map((v) => (
          <button
            key={v}
            onClick={() => onChange({ viz: v })}
            className={"px-2.5 py-1 text-xs rounded-md border " + (def.viz === v ? "bg-accent/10 border-accent text-accent" : "border-border text-muted-foreground hover:text-foreground")}
          >{v}</button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground w-16">Density</span>
        <button className={"px-2 py-1 rounded border " + (def.format.density === "editorial" ? "bg-accent/10 border-accent text-accent" : "border-border")} onClick={() => onChange({ format: { ...def.format, density: "editorial" } })}>Editorial</button>
        <button className={"px-2 py-1 rounded border " + (def.format.density === "compact" ? "bg-accent/10 border-accent text-accent" : "border-border")} onClick={() => onChange({ format: { ...def.format, density: "compact" } })}>Compact</button>
      </div>
    </div>
  );
}

function VisibilityPicker({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const { data: users } = useUsers();
  const userId = useAppStore((s) => s.currentUserId);
  const user = users.find((u) => u.id === userId) ?? users[0];
  const options: ReportVisibility[] = ["Private", "Team", "Practice", "Firm-template"];
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((v) => {
        const allowed = user ? canGrantVisibility(user, v) : false;
        if (!allowed) return null;
        return (
          <button
            key={v}
            onClick={() => onChange({ visibility: v })}
            className={"px-2.5 py-1 text-xs rounded-md border " + (def.visibility === v ? "bg-accent/10 border-accent text-accent" : "border-border text-muted-foreground hover:text-foreground")}
          >{v}</button>
        );
      })}
    </div>
  );
}

function SchedulePicker({ def, onChange }: { def: ReportDef; onChange: (p: Partial<ReportDef>) => void }) {
  const sched = def.schedule;
  if (!sched) return (
    <Button variant="outline" size="sm" onClick={() => onChange({ schedule: { cadence: "weekly", channel: "email", recipients: [], time: "08:00" } })}>Add schedule</Button>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={sched.cadence} onValueChange={(v) => onChange({ schedule: { ...sched, cadence: v as "daily" | "weekly" | "monthly" } })}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
        </Select>
        <Select value={sched.channel} onValueChange={(v) => onChange({ schedule: { ...sched, channel: v as "email" | "in-app" | "teams" } })}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="in-app">In-app</SelectItem><SelectItem value="teams">Teams</SelectItem></SelectContent>
        </Select>
        <Input type="time" className="h-8 text-xs w-[100px]" value={sched.time} onChange={(e) => onChange({ schedule: { ...sched, time: e.target.value } })} />
        <Button variant="ghost" size="sm" onClick={() => onChange({ schedule: undefined })}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <Input placeholder="Recipient user IDs (comma separated)" className="h-8 text-xs" value={sched.recipients.join(",")} onChange={(e) => onChange({ schedule: { ...sched, recipients: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} />
      <div className="text-[11px] text-muted-foreground">Recipients see rows trimmed to their own scope. Two people can receive the same report and see different numbers.</div>
    </div>
  );
}