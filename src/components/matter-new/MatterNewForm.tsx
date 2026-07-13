import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useClients, useMails, useMatters, useUsers } from "@/hooks/use-data";
import { useAppStore } from "@/store/app-store";
import { BackLink } from "@/components/common/BackLink";
import type { Branch, MatterCategory, MatterDeliverable, MatterSubCategory } from "@/types";

type Engagement = "T&M" | "Fixed Fee" | "Per Appearance";
type MatterType = "Litigation" | "Consulting";
type SubType = "Hearing" | "Opinion" | "Projects" | "Projects (Retainership)";

interface FormState {
  clientId: string;
  title: string;
  matterType: MatterType | "";
  subType: SubType | "";
  category: MatterCategory | "";
  subCategory: MatterSubCategory | "";
  deliverable: MatterDeliverable | "";
  branch: Branch | "";
  issueInBrief: string;
  docRefNumber: string;
  referenceDate: string;
  otherParties: string[];
  relatedMatterId: string;
  billingCycle: "Monthly" | "Quarterly" | "";
  cycleDate: string;
  contractStart: string;
  contractEnd: string;
  casePartnerId: string;
  caseManagerId: string;
  associateIds: string[];
  paralegalId: string;
  engagement: Engagement | "";
  feeQuote: string;
  clientRequestPending: boolean;
  conflictAcknowledged: boolean;
  aiTouched: Record<string, boolean>;
  aiOriginal: Record<string, boolean>;
}

const emptyForm: FormState = {
  clientId: "",
  title: "",
  matterType: "",
  subType: "",
  category: "",
  subCategory: "",
  deliverable: "",
  branch: "",
  issueInBrief: "",
  docRefNumber: "",
  referenceDate: "",
  otherParties: [],
  relatedMatterId: "",
  billingCycle: "",
  cycleDate: "",
  contractStart: "",
  contractEnd: "",
  casePartnerId: "",
  caseManagerId: "",
  associateIds: [],
  paralegalId: "",
  engagement: "",
  feeQuote: "",
  clientRequestPending: false,
  conflictAcknowledged: false,
  aiTouched: {},
  aiOriginal: {},
};

const DRAFT_KEY = "snowfig.matter-new.draft.v1";
const SECTIONS = [
  { id: "sec-client", label: "Client" },
  { id: "sec-matter", label: "Matter" },
  { id: "sec-team", label: "Team" },
  { id: "sec-financials", label: "Financials" },
] as const;

const CATEGORIES: MatterCategory[] = [
  "Tax - Indirect",
  "Tax - Direct",
  "International Trade",
  "Corporate",
];
const SUB_CATEGORIES: MatterSubCategory[] = [
  "Customs",
  "GST",
  "Mixed - Corporate",
  "Arbitration and Conciliation",
  "Competition Law/MRTP",
];
const DELIVERABLES: MatterDeliverable[] = [
  "Retainership",
  "Legal Opinion",
  "Appearance",
  "Civil Appeal",
  "Reply to SCN",
];
const BRANCHES: Branch[] = ["New Delhi", "Mumbai", "Nagpur", "Bengaluru"];
const SUB_TYPES: SubType[] = ["Hearing", "Opinion", "Projects", "Projects (Retainership)"];

function validateGstin(v: string): boolean {
  if (!v) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.toUpperCase());
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface Props {
  fromMailId?: string;
}

export function MatterNewForm({ fromMailId }: Props) {
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const { data: users } = useUsers();
  const { data: matters } = useMatters();
  const { data: mails } = useMails();

  const sourceMail = fromMailId ? mails.find((m) => m.id === fromMailId) : undefined;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [restoreOffered, setRestoreOffered] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<string>("sec-client");
  const [createdMatter, setCreatedMatter] = useState<{ id: number; tags: string[] } | null>(null);
  const [includedAttachments, setIncludedAttachments] = useState<Record<string, boolean>>({});
  const scrollRoot = useRef<HTMLDivElement>(null);

  // Prefill from mail (AI)
  useEffect(() => {
    if (!sourceMail || restored) return;
    const guessedClient = clients.find((c) =>
      sourceMail.from.toLowerCase().includes(c.name.split(" ")[0].toLowerCase()),
    );
    const cand = sourceMail.matchCandidates[0];
    setForm((f) => ({
      ...f,
      clientId: guessedClient?.id ?? f.clientId,
      title: sourceMail.subject.replace(/^(kindly|please|re:)/i, "").trim().slice(0, 140),
      matterType: "Litigation",
      subType: "Hearing",
      category: "Tax - Indirect",
      subCategory: "Customs",
      deliverable: "Reply to SCN",
      branch: "New Delhi",
      issueInBrief: sourceMail.attachments[0]?.aiSummary ?? sourceMail.bodyPreview,
      docRefNumber: cand?.refNoHit ?? "",
      aiTouched: {
        clientId: !!guessedClient,
        title: true,
        matterType: true,
        subType: true,
        category: true,
        subCategory: true,
        deliverable: true,
        branch: true,
        issueInBrief: true,
        docRefNumber: !!cand?.refNoHit,
      },
      aiOriginal: {
        clientId: !!guessedClient,
        title: true,
        matterType: true,
        subType: true,
        category: true,
        subCategory: true,
        deliverable: true,
        branch: true,
        issueInBrief: true,
        docRefNumber: !!cand?.refNoHit,
      },
    }));
    setIncludedAttachments(
      Object.fromEntries(sourceMail.attachments.map((a) => [a.name, true])),
    );
  }, [sourceMail, clients, restored]);

  // Draft restore
  useEffect(() => {
    if (sourceMail) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { form: FormState; at: string } | null;
        if (parsed && parsed.form && Object.values(parsed.form).some((v) => v && v !== "")) {
          setRestoreOffered(true);
        }
      }
    } catch {
      /* ignore */
    }
     
  }, []);

  // Autosave
  useEffect(() => {
    const t = setInterval(() => {
      const hasContent =
        form.clientId || form.title || form.docRefNumber || form.issueInBrief;
      if (!hasContent) return;
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ form, at: new Date().toISOString() }),
        );
        setSavedAt(new Date());
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [form]);

  // Esc to exit — draft autosaves, so we can exit immediately without a confirm.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      navigate({ to: sourceMail ? "/mails" : "/matter" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, sourceMail]);

  // Scroll spy
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [createdMatter]);

  const client = clients.find((c) => c.id === form.clientId);
  const clientHasSOF = useMemo(
    () =>
      client
        ? matters.some((m) => m.clientId === client.id && m.tags.includes("SOF-exists"))
        : false,
    [client, matters],
  );

  // Conflict check (party fields settle)
  const [conflictState, setConflictState] = useState<
    "idle" | "checking" | "clear" | "hits"
  >("idle");
  useEffect(() => {
    if (!form.clientId && form.otherParties.length === 0) {
      setConflictState("idle");
      return;
    }
    setConflictState("checking");
    const t = setTimeout(() => {
      // seed: Copperline triggers a hit
      if (client?.id === "c-copperline") setConflictState("hits");
      else setConflictState("clear");
    }, 800);
    return () => clearTimeout(t);
  }, [form.clientId, form.otherParties, client]);

  // Duplicate guard
  const duplicate = useMemo(() => {
    if (!form.clientId || !form.docRefNumber || form.docRefNumber.length < 4) return null;
    const needle = form.docRefNumber.toLowerCase().replace(/\s+/g, "");
    return matters.find(
      (m) =>
        m.clientId === form.clientId &&
        m.docRefNumber &&
        m.docRefNumber.toLowerCase().replace(/\s+/g, "").includes(needle.slice(0, 6)),
    );
  }, [form.clientId, form.docRefNumber, matters]);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);

  // Related matter search
  const clientMatters = matters.filter((m) => m.clientId === form.clientId);
  const relatedMatter = matters.find((m) => m.id === form.relatedMatterId);

  // Helpers
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({
      ...f,
      [key]: value,
      aiTouched: { ...f.aiTouched, [key]: false },
    }));
  }
  const isAI = (k: keyof FormState) => Boolean(sourceMail && form.aiTouched[k]);
  const wasAI = (k: keyof FormState) => Boolean(sourceMail && form.aiOriginal[k]);
  const isEdited = (k: keyof FormState) => wasAI(k) && !form.aiTouched[k];
  // Field wrapper: violet left-tint for AI-populated fields, muted for edited-after-AI.
  // Uses a transparent left border by default so the layout never shifts when the
  // AI/edited state changes; padding stays inside the card and never clips.
  const aiWrap = (k: keyof FormState, node: React.ReactNode) => (
    <div
      className={cn(
        "rounded-md border-l-2 border-l-transparent pl-2 transition-colors",
        isAI(k) && "border-l-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5",
        isEdited(k) && "border-l-border",
      )}
    >
      {node}
    </div>
  );

  // Label with right-aligned AI / edited marker. Use in place of raw <Label> for AI-capable fields.
  const FieldLabel = ({
    children,
    required,
    aiKey,
    right,
  }: {
    children: React.ReactNode;
    required?: boolean;
    aiKey?: keyof FormState;
    right?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[20px]">
      <Label className="m-0">
        {children}
        {required && <span className="text-[hsl(var(--danger))]">*</span>}
      </Label>
      <div className="flex items-center gap-2">
        {aiKey && isAI(aiKey) && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/30 inline-flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" /> AI · 92%
          </span>
        )}
        {aiKey && isEdited(aiKey) && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
            edited
          </span>
        )}
        {right}
      </div>
    </div>
  );

  function acceptAllInSection(keys: (keyof FormState)[]) {
    setForm((f) => ({
      ...f,
      aiTouched: {
        ...f.aiTouched,
        ...Object.fromEntries(keys.map((k) => [k, false])),
      },
    }));
    toast.success("AI values accepted");
  }

  const requiredMissing = !(
    form.clientId &&
    form.title &&
    form.matterType &&
    form.subType &&
    form.category &&
    form.deliverable &&
    form.branch &&
    form.casePartnerId &&
    form.engagement
  );

  const partialDetails = !form.subCategory || !form.issueInBrief || !form.caseManagerId;
  const partner = users.find((u) => u.id === form.casePartnerId);

  function handleCreate(openAnother: boolean) {
    if (requiredMissing) {
      toast.error("Fill required fields marked with *");
      return;
    }
    const nextId = 1096300 + Math.floor(Math.random() * 700);
    const tags: string[] = [];
    if (partialDetails) tags.push("partial-details");
    if (form.clientRequestPending) tags.push("client-pending");
    if (conflictState === "hits" && form.conflictAcknowledged) tags.push("conflict-review");
    setCreatedMatter({ id: nextId, tags });
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    if (openAnother) {
      // reset after briefly showing
      setTimeout(() => {
        setForm(emptyForm);
        setCreatedMatter(null);
        window.scrollTo({ top: 0 });
      }, 1400);
    }
  }

  if (createdMatter) {
    return (
      <SuccessScreen
        matterId={createdMatter.id}
        tags={createdMatter.tags}
        partnerName={partner?.fullName ?? "the assigned partner"}
        onOpen={() =>
          navigate({ to: "/matter/$id", params: { id: `m-${createdMatter.id}` } })
        }
        onBack={() => navigate({ to: "/matter" })}
      />
    );
  }

  const formPane = (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-6 pb-32">
      <div className="mb-3 flex items-center justify-between">
        <BackLink fallbackTo="/matter" label={sourceMail ? "Back to Inbox" : "Back to Matters"} />
        <div className="text-[11px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 font-mono">Esc</kbd> to exit
        </div>
      </div>
      <ProgressRail active={activeSection} />
      {restoreOffered && !restored && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-3 py-2 text-sm">
          <span>A draft from your last session is available.</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                setRestoreOffered(false);
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => {
                try {
                  const raw = localStorage.getItem(DRAFT_KEY);
                  if (raw) {
                    const parsed = JSON.parse(raw) as { form: FormState };
                    setForm(parsed.form);
                    setRestored(true);
                    setRestoreOffered(false);
                  }
                } catch {
                  setRestoreOffered(false);
                }
              }}
            >
              Restore draft
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 1 — CLIENT */}
      <section id="sec-client" className="scroll-mt-24 mb-10">
        <SectionHeader index={1} label="Client" />
        <Card className="p-4 space-y-4">
          <div>
            <FieldLabel required aiKey="clientId">Client</FieldLabel>
            {aiWrap(
              "clientId",
              <ClientCombobox
                value={form.clientId}
                onChange={(id) => update("clientId", id)}
                clients={clients}
              />,
            )}
          </div>

          {client && (
            <ClientMatchCard
              name={client.name}
              sector={client.sector}
              city={client.city}
              activeMatters={client.activeMatters}
              realization={client.realizationRate}
              sofExists={clientHasSOF}
            />
          )}

          <RequestClientExpander
            active={form.clientRequestPending}
            onSubmit={() => {
              update("clientRequestPending", true);
              toast.success("Request sent to Dev Anand", {
                description: "Matter can proceed; billing unlocks on approval.",
              });
            }}
          />

          <ConflictChip state={conflictState} onProceed={() => update("conflictAcknowledged", true)} />
        </Card>
      </section>

      {/* SECTION 2 — MATTER */}
      <section id="sec-matter" className="scroll-mt-24 mb-10">
        <SectionHeader
          index={2}
          label="Matter"
          right={
            sourceMail && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  acceptAllInSection([
                    "title",
                    "matterType",
                    "subType",
                    "category",
                    "subCategory",
                    "deliverable",
                    "branch",
                    "issueInBrief",
                    "docRefNumber",
                  ])
                }
              >
                Accept all
              </Button>
            )
          }
        />
        <Card className="p-4 space-y-4">
          <div>
            <FieldLabel required aiKey="title">Matter Title</FieldLabel>
            {aiWrap(
              "title",
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. SCN, Customs valuation of copper tube imports"
              />,
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required aiKey="matterType">Matter Type</FieldLabel>
              {aiWrap(
                "matterType",
                <Select
                  value={form.matterType}
                  onValueChange={(v) => update("matterType", v as MatterType)}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Litigation">Litigation</SelectItem>
                    <SelectItem value="Consulting">Consulting</SelectItem>
                  </SelectContent>
                </Select>,
              )}
            </div>
            <div>
              <FieldLabel required aiKey="subType">Sub Type</FieldLabel>
              {aiWrap(
                "subType",
                <Select value={form.subType} onValueChange={(v) => update("subType", v as SubType)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {SUB_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
            </div>
            <div>
              <FieldLabel required aiKey="category">Category</FieldLabel>
              {aiWrap(
                "category",
                <Select value={form.category} onValueChange={(v) => update("category", v as MatterCategory)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
            </div>
            <div>
              <FieldLabel aiKey="subCategory">Sub Category</FieldLabel>
              {aiWrap(
                "subCategory",
                <Select value={form.subCategory} onValueChange={(v) => update("subCategory", v as MatterSubCategory)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {SUB_CATEGORIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
            </div>
            <div>
              <FieldLabel required aiKey="deliverable">Deliverable</FieldLabel>
              {aiWrap(
                "deliverable",
                <Select value={form.deliverable} onValueChange={(v) => update("deliverable", v as MatterDeliverable)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
            </div>
            <div>
              <FieldLabel required aiKey="branch">Branch</FieldLabel>
              {aiWrap(
                "branch",
                <Select value={form.branch} onValueChange={(v) => update("branch", v as Branch)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
            </div>
          </div>

          <div>
            <FieldLabel
              aiKey="issueInBrief"
              right={<span className="text-xs text-muted-foreground">{form.issueInBrief.length}/500</span>}
            >
              Issue in Brief
            </FieldLabel>
            {aiWrap(
              "issueInBrief",
              <Textarea
                value={form.issueInBrief}
                onChange={(e) => update("issueInBrief", e.target.value.slice(0, 500))}
                rows={3}
              />,
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel aiKey="docRefNumber">Doc Ref Number</FieldLabel>
              {aiWrap(
                "docRefNumber",
                <Input
                  className="font-mono"
                  value={form.docRefNumber}
                  onChange={(e) => {
                    update("docRefNumber", e.target.value);
                    setDuplicateDismissed(false);
                  }}
                  placeholder="OIO No. 205/2026"
                />,
              )}
            </div>
            <div>
              <Label>Reference Date</Label>
              <Input
                type="date"
                value={form.referenceDate}
                onChange={(e) => update("referenceDate", e.target.value)}
              />
            </div>
          </div>

          {duplicate && !duplicateDismissed && (
            <div className="flex items-start gap-2 rounded-md border border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/5 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-[hsl(var(--warning))]" />
              <div className="flex-1">
                <div>
                  Possible duplicate:{" "}
                  <span className="font-mono">{duplicate.matterId}</span>{" "}
                  <span className="text-muted-foreground">"{duplicate.title.slice(0, 60)}..."</span>
                  <span className="text-muted-foreground"> (same client + Doc Ref)</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/matter/$id" params={{ id: duplicate.id }}>Open</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDuplicateDismissed(true);
                  toast.message("Logged: dismissed duplicate suggestion");
                }}
              >
                Not the same
              </Button>
            </div>
          )}

          <div>
            <Label>Other Parties</Label>
            <ChipInput
              values={form.otherParties}
              onChange={(v) => update("otherParties", v)}
              placeholder="Type and press Enter"
            />
          </div>

          <div>
            <Label>Related Matter</Label>
            <RelatedMatterPicker
              disabled={!form.clientId}
              matters={clientMatters}
              value={form.relatedMatterId}
              onChange={(id) => update("relatedMatterId", id)}
            />
            {relatedMatter && (
              <div className="mt-2 text-xs text-muted-foreground font-mono">
                {relatedMatter.deliverable} {relatedMatter.matterId} → this matter
              </div>
            )}
          </div>

          {form.deliverable === "Retainership" && (
            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Retainership terms
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Billing Cycle</Label>
                  <Select
                    value={form.billingCycle}
                    onValueChange={(v) => update("billingCycle", v as "Monthly" | "Quarterly")}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cycle date</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.cycleDate}
                    onChange={(e) => update("cycleDate", e.target.value)}
                    placeholder="Day of month"
                  />
                </div>
                <div>
                  <Label>Contract start</Label>
                  <Input type="date" value={form.contractStart} onChange={(e) => update("contractStart", e.target.value)} />
                </div>
                <div>
                  <Label>Contract end</Label>
                  <Input type="date" value={form.contractEnd} onChange={(e) => update("contractEnd", e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* SECTION 3 — TEAM */}
      <section id="sec-team" className="scroll-mt-24 mb-10">
        <SectionHeader index={3} label="Team" />
        <Card className="p-4 space-y-4">
          <div>
            <Label>Case Partner<span className="text-[hsl(var(--danger))]">*</span></Label>
            <UserSelect
              users={users.filter((u) => u.roles.includes("Case Partner"))}
              value={form.casePartnerId}
              onChange={(id) => update("casePartnerId", id)}
            />
          </div>
          <div>
            <Label>Case Manager</Label>
            <UserSelect
              users={users.filter((u) => u.roles.includes("Case Manager"))}
              value={form.caseManagerId}
              onChange={(id) => update("caseManagerId", id)}
            />
          </div>
          <div>
            <Label>Associates</Label>
            <MultiUserSelect
              users={users.filter((u) => u.roles.includes("Associate"))}
              values={form.associateIds}
              onChange={(ids) => update("associateIds", ids)}
            />
          </div>
          <div>
            <Label>Paralegal <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <UserSelect
              users={users.filter((u) => u.roles.includes("Paralegal"))}
              value={form.paralegalId}
              onChange={(id) => update("paralegalId", id)}
            />
          </div>
        </Card>
      </section>

      {/* SECTION 4 — FINANCIALS */}
      <section id="sec-financials" className="scroll-mt-24 mb-10">
        <SectionHeader index={4} label="Financials" />
        <Card className="p-4 space-y-4">
          <div>
            <Label>Engagement<span className="text-[hsl(var(--danger))]">*</span></Label>
            <RadioGroup
              value={form.engagement}
              onValueChange={(v) => update("engagement", v as Engagement)}
              className="flex gap-6 pt-1"
            >
              {(["T&M", "Fixed Fee", "Per Appearance"] as Engagement[]).map((eg) => (
                <div key={eg} className="flex items-center gap-2">
                  <RadioGroupItem id={`eg-${eg}`} value={eg} />
                  <Label htmlFor={`eg-${eg}`} className="font-normal">{eg}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label>Fee Quote (₹)</Label>
            <Input
              type="number"
              className="font-mono"
              value={form.feeQuote}
              onChange={(e) => update("feeQuote", e.target.value)}
              placeholder="e.g. 850000"
            />
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SOF</div>
            {clientHasSOF ? (
              <div className="text-sm flex items-center justify-between">
                <span>Attach SOF (restricted to Case Partner)</span>
                <Button variant="outline" size="sm">Attach SOF</Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                SOF exists — contact Dev Anand
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Fee approval status:</span>
            {form.feeQuote && Number(form.feeQuote) > 500000 ? (
              <Badge variant="outline" className="text-[hsl(var(--warning))] border-[hsl(var(--warning))]/40">
                Pending with {partner?.fullName ?? "Case Partner"}
              </Badge>
            ) : (
              <Badge variant="outline">Not required</Badge>
            )}
          </div>
        </Card>
      </section>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background" ref={scrollRoot}>
      {sourceMail ? (
        <div className="grid grid-cols-[minmax(360px,1fr)_minmax(0,2fr)]">
          <MailPane
            mail={sourceMail}
            included={includedAttachments}
            onToggle={(name) =>
              setIncludedAttachments((s) => ({ ...s, [name]: !s[name] }))
            }
            onChangeTag={() => {
              toast.message("Mail returned to Docketer queue");
              navigate({ to: "/mails" });
            }}
          />
          <div className="border-l border-border">
            {formPane}
          </div>
        </div>
      ) : (
        formPane
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur z-30">
        <div className="mx-auto max-w-[880px] flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {savedAt ? (
              <span>Draft saved {formatTime(savedAt)} <Check className="inline h-3 w-3 text-[hsl(var(--success))]" /></span>
            ) : (
              <span>Autosave every 5s</span>
            )}
            {requiredMissing && (
              <span className="ml-3 text-muted-foreground">* required to create — everything else can follow</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleCreate(true)} disabled={requiredMissing}>
              Create &amp; open another
            </Button>
            <Button onClick={() => handleCreate(false)} disabled={requiredMissing}>
              Create matter <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ index, label, right }: { index: number; label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold">
        <span className="text-muted-foreground font-mono mr-2">0{index}</span>
        {label}
      </h2>
      {right}
    </div>
  );
}

function ProgressRail({ active }: { active: string }) {
  const activeIdx = SECTIONS.findIndex((x) => x.id === active);
  return (
    <nav
      aria-label="Form sections"
      className="sticky top-0 z-10 -mx-6 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-background/95 px-6 py-2 backdrop-blur"
    >
      {SECTIONS.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              "flex items-center gap-1.5 text-[12px] whitespace-nowrap",
              isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-mono tabular-nums",
                isActive
                  ? "bg-[hsl(var(--accent))] border-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                  : isDone
                    ? "bg-[hsl(var(--success))] border-[hsl(var(--success))] text-white"
                    : "border-border text-muted-foreground",
              )}
            >
              {isDone ? "✓" : i + 1}
            </span>
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}

function ClientCombobox({
  value,
  onChange,
  clients,
}: {
  value: string;
  onChange: (id: string) => void;
  clients: ReturnType<typeof useClients>["data"];
}) {
  const [open, setOpen] = useState(false);
  const current = clients.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {current ? current.name : "Select client…"}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]">
        <Command>
          <CommandInput placeholder="Search clients…" />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex-1">
                    <div className="text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.sector} · {c.city}
                    </div>
                  </div>
                  {c.status === "pending_master" && (
                    <Badge variant="outline" className="text-xs">pending</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ClientMatchCard({
  name, sector, city, activeMatters, realization, sofExists,
}: { name: string; sector: string; city: string; activeMatters: number; realization: number; sofExists: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{sector} · {city}</div>
        </div>
        <div className="flex items-center gap-2">
          {sofExists && <Badge variant="outline" className="text-xs">SOF exists 🔒</Badge>}
          <Badge variant="outline" className="text-xs font-mono">{realization}% realization</Badge>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {activeMatters} active matters — <button className="text-[hsl(var(--accent))] hover:underline">view</button>
      </div>
    </div>
  );
}

function RequestClientExpander({ active, onSubmit }: { active: boolean; onSubmit: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [sub, setSub] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [gstin, setGstin] = useState("");
  const [contact, setContact] = useState("");
  const gstOk = validateGstin(gstin);

  if (active) {
    return (
      <div className="rounded-md border border-[hsl(var(--pending))]/40 bg-[hsl(var(--pending))]/5 px-3 py-2 text-sm">
        <Badge variant="outline" className="text-xs mr-2">client-pending</Badge>
        Request sent to Dev Anand — matter can proceed; billing unlocks on approval.
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        className="text-sm text-[hsl(var(--accent))] hover:underline"
        onClick={() => setOpen((o) => !o)}
      >
        ＋ Request Master Docketer to create client
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-border p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name*</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Group/Parent</Label><Input /></div>
            <div><Label>Sector*</Label><Input value={sector} onChange={(e) => setSector(e.target.value)} /></div>
            <div><Label>Sub-sector*</Label><Input value={sub} onChange={(e) => setSub(e.target.value)} /></div>
            <div><Label>City*</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><Label>State*</Label><Input value={state} onChange={(e) => setState(e.target.value)} /></div>
            <div>
              <Label>GSTIN</Label>
              <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className="font-mono" />
              {!gstOk && <div className="text-xs text-[hsl(var(--danger))] mt-1">Invalid GSTIN checksum format</div>}
            </div>
            <div><Label>Key contact</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!name || !sector || !sub || !city || !state || !gstOk}
              onClick={() => { onSubmit(); setOpen(false); }}
            >
              Send request
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConflictChip({ state, onProceed }: { state: "idle" | "checking" | "clear" | "hits"; onProceed: () => void }) {
  if (state === "idle") return null;
  if (state === "checking") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> checking conflicts…
      </div>
    );
  }
  if (state === "clear") {
    return (
      <div className="inline-flex flex-col gap-1">
        <div className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--success))]">
          <Check className="h-3 w-3" /> No conflicts found in your visibility
        </div>
        <OutOfScopeHint />
      </div>
    );
  }
  return (
    <div className="inline-flex flex-col gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--warning))]">
            <AlertTriangle className="h-3 w-3" /> 2 potential hits [Review]
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm space-y-2">
          <div className="font-medium">Potential conflicts (participant-scoped)</div>
          <ul className="space-y-1 text-xs">
            <li>• <span className="font-mono">1096240</span> — opposing party in Meridian SCN</li>
            <li>• <span className="font-mono">1096272</span> — advisor to counter-party group</li>
          </ul>
          <Button size="sm" variant="outline" className="w-full" onClick={onProceed}>
            Proceed with conflict-review tag
          </Button>
        </PopoverContent>
      </Popover>
      <OutOfScopeHint />
    </div>
  );
}

function OutOfScopeHint() {
  const addConflictReferral = useAppStore((s) => s.addConflictReferral);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const { data: users } = useUsers();
  const me = users.find((u) => u.id === currentUserId);
  const [referred, setReferred] = useState(false);
  const refer = () => {
    if (referred || !me) return;
    addConflictReferral({ matterTitle: "New matter intake", byUserId: me.id, byUserName: me.fullName });
    setReferred(true);
    toast.success("Referred to General Counsel", { description: "Action-needed notification filed with the Checker-of-conflicts." });
  };
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <AlertTriangle className="h-3 w-3" />
      <span>1 potential conflict exists outside your visibility.</span>
      <button className="underline decoration-dotted underline-offset-2 hover:text-foreground disabled:opacity-60" onClick={refer} disabled={referred}>
        {referred ? "Referred" : "Refer to General Counsel"}
      </button>
    </div>
  );
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input px-2 py-1.5 min-h-[38px]">
      {values.map((v, i) => (
        <Badge key={i} variant="secondary" className="gap-1">
          {v}
          <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-[hsl(var(--danger))]">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            e.preventDefault();
            onChange([...values, draft.trim()]);
            setDraft("");
          }
        }}
      />
    </div>
  );
}

function RelatedMatterPicker({
  disabled, matters, value, onChange,
}: { disabled: boolean; matters: ReturnType<typeof useMatters>["data"]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = matters.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className="w-full justify-between font-normal">
          {selected ? <span className="font-mono">{selected.matterId} — {selected.title.slice(0, 40)}…</span> : "Search within this client…"}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0">
        <Command>
          <CommandInput placeholder="Search matters…" />
          <CommandList>
            <CommandEmpty>No matter for this client.</CommandEmpty>
            <CommandGroup>
              {matters.map((m) => (
                <CommandItem key={m.id} value={`${m.matterId} ${m.title}`} onSelect={() => { onChange(m.id); setOpen(false); }}>
                  <div className="flex-1">
                    <div className="text-sm font-mono">{m.matterId}</div>
                    <div className="text-xs text-muted-foreground">{m.title}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{m.deliverable}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UserSelect({ users, value, onChange }: { users: ReturnType<typeof useUsers>["data"]; value: string; onChange: (id: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            <span className="flex items-center gap-2">
              {u.fullName}
              <span className="text-xs text-muted-foreground font-mono">{u.capacityPct}%</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiUserSelect({ users, values, onChange }: { users: ReturnType<typeof useUsers>["data"]; values: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="rounded-md border border-input p-2 space-y-1.5 max-h-56 overflow-auto">
      {users.map((u) => {
        const checked = values.includes(u.id);
        const capColor =
          u.capacityPct > 90 ? "text-[hsl(var(--danger))]" :
          u.capacityPct > 80 ? "text-[hsl(var(--warning))]" :
          "text-[hsl(var(--success))]";
        return (
          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) =>
                onChange(c ? [...values, u.id] : values.filter((x) => x !== u.id))
              }
            />
            <span className="flex-1">{u.fullName}</span>
            <span className={cn("text-xs font-mono", capColor)}>{u.capacityPct}%</span>
            <span className="text-xs text-muted-foreground">{u.branch}</span>
          </label>
        );
      })}
    </div>
  );
}

function MailPane({
  mail, included, onToggle, onChangeTag,
}: {
  mail: NonNullable<ReturnType<typeof useMails>["data"][number]>;
  included: Record<string, boolean>;
  onToggle: (name: string) => void;
  onChangeTag: () => void;
}) {
  return (
    <aside className="sticky top-0 h-screen overflow-y-auto p-6 bg-muted/20">
      <div className="flex items-center justify-between mb-3">
        <Badge variant="outline" className="text-xs">Source mail</Badge>
        <button className="text-xs text-[hsl(var(--accent))] hover:underline" onClick={onChangeTag}>
          Change tag
        </button>
      </div>
      <div className="text-xs text-muted-foreground mb-1">From {mail.from}</div>
      <h3 className="text-sm font-medium mb-2">{mail.subject}</h3>
      <Separator className="my-3" />
      <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: mail.bodyHtml }} />
      {mail.attachments.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Attachments → Documents
          </div>
          <div className="space-y-1.5">
            {mail.attachments.map((a) => (
              <label key={a.name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!included[a.name]}
                  onCheckedChange={() => onToggle(a.name)}
                />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.type.split("/").pop()}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

function SuccessScreen({
  matterId, tags, partnerName, onOpen, onBack,
}: { matterId: number; tags: string[]; partnerName: string; onOpen: () => void; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const idStr = String(matterId);
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center space-y-4">
      <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
        <Check className="h-5 w-5" />
      </div>
      <h1 className="font-display text-[26px] font-normal">Matter created</h1>
      <div className="flex items-center justify-center gap-2">
        <span className="text-2xl font-mono">{idStr}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(idStr);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex justify-center gap-1.5">
          {tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        → appears in {partnerName}'s Allocation queue
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Button variant="outline" onClick={onBack}>Back to list</Button>
        <Button onClick={onOpen}>Open matter</Button>
      </div>
    </div>
  );
}