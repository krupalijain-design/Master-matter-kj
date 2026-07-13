import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, ChevronDown, ChevronUp, Check, Loader2, Monitor } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  desc: string;
  accents: string[];
}

const BRANCHES: Branch[] = [
  {
    id: "master",
    name: "Classic Slate",
    desc: "Original layout with classic dark gray and crisp blue accents.",
    accents: ["#27272a", "#3b82f6"],
  },
  {
    id: "theme-cool-multihue",
    name: "Cool Multi-hue",
    desc: "Vibrant Slate theme with multi-hue data charts and highlighted warning panels.",
    accents: ["#334155", "#06b6d4"],
  },
  {
    id: "theme-editorial-blue",
    name: "Editorial Blue",
    desc: "Refined serif typography with a classic deep blue legal accent.",
    accents: ["#1e3a8a", "#3b82f6"],
  },
  {
    id: "theme-ink-rust",
    name: "Ink & Rust",
    desc: "High-contrast charcoal slate canvas paired with deep rust terracotta.",
    accents: ["#1f2937", "#b45309"],
  },
  {
    id: "theme-jade-ochre",
    name: "Jade & Ochre",
    desc: "Warm editorial cream canvas with rich forest jade and gold ochre.",
    accents: ["#0f2e22", "#d97706"],
  },
  {
    id: "theme-slate-amber",
    name: "Slate & Amber",
    desc: "Sleek, modern tech slate canvas with amber warning focus states.",
    accents: ["#334155", "#f59e0b"],
  },
];

export function BranchSwitcher() {
  const [currentBranch, setCurrentBranch] = useState<string>("theme-cool-multihue");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [targetBranch, setTargetBranch] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the current git branch from the backend
    fetch("/api/current-branch")
      .then((res) => res.json())
      .then((data) => {
        if (data.branch) {
          setCurrentBranch(data.branch);
        }
      })
      .catch((err) => console.error("Error fetching current branch:", err));
  }, []);

  const handleSwitch = async (branchId: string) => {
    if (branchId === currentBranch || isTransitioning) return;
    setIsTransitioning(true);
    setTargetBranch(branchId);
    try {
      const response = await fetch(`/api/switch-branch?branch=${branchId}`);
      const data = await response.json();
      if (data.success) {
        // Give a tiny delay for the dev server to start processing the branch switch
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        alert("Failed to switch branch: " + (data.error || "Unknown error"));
        setIsTransitioning(false);
        setTargetBranch(null);
      }
    } catch (err: any) {
      alert("Error switching branch: " + err.message);
      setIsTransitioning(false);
      setTargetBranch(null);
    }
  };

  return (
    <div id="branch-switcher-root" className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Main floating button */}
      {!isOpen && (
        <button
          id="branch-switcher-btn"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:opacity-90 transition-all border border-border/20 cursor-pointer text-sm font-medium"
        >
          <Layers className="h-4 w-4 animate-pulse" />
          <span>Compare Theme Branches</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      )}

      {/* Selector dropdown panel */}
      {isOpen && (
        <div id="branch-switcher-panel" className="w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted border-b border-border">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Theme Branch Switcher</span>
            </div>
            <button
              id="branch-switcher-close"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Compare dashboard quick link */}
          <div className="px-4 py-2 bg-primary/5 border-b border-border/50">
            <Link
              to="/compare"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 text-xs font-semibold text-primary hover:underline"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Full Grid Screen Comparison</span>
            </Link>
          </div>

          {/* Description */}
          <div className="px-4 py-2 bg-muted/30 border-b border-border/50 text-[11px] text-muted-foreground leading-relaxed">
            Click any branch below to hot-swap the entire workspace files, layout, fonts, and styling dynamically on this screen.
          </div>

          {/* Branch List */}
          <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
            {BRANCHES.map((b) => {
              const isActive = currentBranch === b.id;
              const isSwitchingThis = isTransitioning && targetBranch === b.id;

              return (
                <button
                  id={`branch-item-${b.id}`}
                  key={b.id}
                  disabled={isTransitioning}
                  onClick={() => handleSwitch(b.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                    isActive
                      ? "bg-primary/5 border-primary"
                      : "border-transparent hover:bg-muted/50 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {b.name}
                      {isActive && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-normal">Active</span>}
                    </span>
                    <div className="flex gap-1 items-center">
                      {b.accents.map((color, idx) => (
                        <span
                          key={idx}
                          className="w-2.5 h-2.5 rounded-full border border-border/30"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      {isActive && !isTransitioning && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                      {isSwitchingThis && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin ml-1" />}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    {b.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Loading overlay if transitioning */}
          {isTransitioning && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-4 text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <span className="text-sm font-medium text-foreground">Hotswapping files to {BRANCHES.find(b => b.id === targetBranch)?.name}...</span>
              <span className="text-xs text-muted-foreground">Vite is compiling styles & templates, reloading in a moment...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
