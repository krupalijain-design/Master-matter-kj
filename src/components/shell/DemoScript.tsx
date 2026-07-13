import { useEffect, useMemo } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Check, PlayCircle, RotateCcw, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/app-store";

type Step = {
  n: number;
  title: string;
  detail: string;
  to: string;
  linkLabel: string;
  auto?: (s: ReturnType<typeof useAppStore.getState>) => boolean;
};

const DEMO_MAIL_ID = "ml-demo-001";
const DEMO_CLIENT_ID = "c-saral";

const STEPS: Step[] = [
  {
    n: 1,
    title: "Docket the seed mail",
    detail: "Open the top inbox item from Anand Suri (Saral FinServ). Confirm the AI tag New Matter with keyboard 1.",
    to: "/mails",
    linkLabel: "Go to /mails",
  },
  {
    n: 2,
    title: "Create matter from mail",
    detail: "Use Create matter from this mail. The form pre-fills; save with the client-pending tag (Saral FinServ is pending_master). Pipeline state becomes Pending.",
    to: `/matter/new?fromMail=${DEMO_MAIL_ID}`,
    linkLabel: "Open /matter/new",
  },
  {
    n: 3,
    title: "Checker approves in review",
    detail: "Switch to the Checker lens. Approve the new matter in the review Drawer. It enters the allocation queue and Kavita's needs-attention count increments.",
    to: "/mails",
    linkLabel: "Open review queue",
    auto: (s) => Object.values(s.matterPipelineOverrides).some((o) => o.pipelineState === "Approved"),
  },
  {
    n: 4,
    title: "Allocate to Neha",
    detail: "In Awaiting allocation, assign the matter to Neha. Capacity rings update; Neha's Today gains Review new matter and a notification fires.",
    to: "/matter/allocation",
    linkLabel: "Open allocation queue",
    auto: (s) => Object.keys(s.allocations).length > 0,
  },
  {
    n: 5,
    title: "Log 1:30 from Today",
    detail: "Switch to Neha. Start the timer on Review new matter, stop it, and log 1:30 as Draft Writing in Quick Time.",
    to: "/today",
    linkLabel: "Open Today",
    auto: (s) => s.timeEntriesAdded.length > 0,
  },
  {
    n: 6,
    title: "Submit week; Kavita approves",
    detail: "On /timesheet the entry appears in the grid. Submit the week; Kavita's Approvals Timesheets count increments. Switch to Kavita and approve.",
    to: "/timesheet",
    linkLabel: "Open week grid",
    auto: (s) => Object.keys(s.tsApprovalOverrides).length > 0,
  },
  {
    n: 7,
    title: "Record hearing + Order Reserved",
    detail: "On the matter, add a hearing with a next date. A prep task lands in Neha's Today with a Critical notification. Then record Order Reserved; next date hides and the matter is closable after billing.",
    to: "/matter",
    linkLabel: "Open matter list",
  },
  {
    n: 8,
    title: "RTB approval",
    detail: "Create an RTB apportioned KR 60 / MJ 40. Kavita approves from a notification; status flips to Approved and Firm Cockpit Billed updates.",
    to: "/approvals",
    linkLabel: "Open approvals",
    auto: (s) => Object.values(s.rtbApprovalOverrides).some((o) => o.status === "Approved"),
  },
  {
    n: 9,
    title: "Master Docketer clears Saral FinServ",
    detail: "In the CCM queue, approve Saral FinServ. The client-pending tag clears everywhere it was rendered.",
    to: "/client/requests",
    linkLabel: "Open CCM queue",
    auto: (s) => s.approvedPendingClientIds.includes(DEMO_CLIENT_ID),
  },
];

export function DemoScript() {
  const router = useRouter();
  const open = useAppStore((s) => s.demoOverlayOpen);
  const setOpen = useAppStore((s) => s.setDemoOverlayOpen);
  const done = useAppStore((s) => s.demoDoneSteps);
  const toggle = useAppStore((s) => s.toggleDemoStep);
  const markDemoStep = useAppStore((s) => s.markDemoStep);
  const reset = useAppStore((s) => s.resetDemoProgress);
  const state = useAppStore();

  // Auto-detect state landings.
  useEffect(() => {
    STEPS.forEach((step) => {
      if (step.auto && step.auto(state) && !done.includes(step.n)) {
        markDemoStep(step.n);
      }
    });
  }, [state, done, markDemoStep]);

  // ⌘⇧D toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen(!useAppStore.getState().demoOverlayOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const pct = useMemo(() => Math.round((done.length / STEPS.length) * 100), [done]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-4 w-4 text-accent" />
              Demo script
            </SheetTitle>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SheetDescription className="text-xs">
            Nine hops through the continuous demo path. Checkmarks land as store state changes.
          </SheetDescription>
          <div className="flex items-center gap-3 pt-1">
            <Progress value={pct} className="h-1.5 flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">{done.length}/{STEPS.length}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {STEPS.map((step) => {
            const isDone = done.includes(step.n);
            return (
              <div
                key={step.n}
                className={`rounded-md border px-3 py-2.5 transition-colors ${isDone ? "border-success/40 bg-success/5" : "border-border bg-background hover:bg-muted/40"}`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => toggle(step.n)}
                    aria-label={isDone ? "Mark not done" : "Mark done"}
                    className={`mt-0.5 h-4 w-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${isDone ? "bg-success border-success text-success-foreground" : "border-border"}`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : null}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{String(step.n).padStart(2, "0")}</span>
                      <div className={`text-[13px] font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                        {step.title}
                      </div>
                      {step.auto ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto">auto</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.detail}</p>
                    <div className="mt-1.5">
                      <Link
                        to={step.to as never}
                        onClick={() => setOpen(false)}
                        className="text-xs text-accent hover:underline"
                      >
                        {step.linkLabel} →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Toggle with ⌘⇧D</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="h-7 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                router.navigate({ to: "/mails" });
              }}
              className="h-7 text-xs"
            >
              Start at step 1
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}