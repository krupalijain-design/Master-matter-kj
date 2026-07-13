import { useEffect, useState } from "react";
import { Check, Loader2, Layers, Type, Palette, Layout, Eye, AlertCircle } from "lucide-react";

interface ThemeBranch {
  id: string;
  name: string;
  desc: string;
  typography: string;
  attentionStyle: string;
  chartStyle: string;
  bgHex: string;
  primaryHex: string;
  warningHex: string;
  surfaceHex: string;
  features: string[];
}

const THEMES: ThemeBranch[] = [
  {
    id: "master",
    name: "Classic Slate",
    desc: "Original layout with clean tech-slate colors and crisp royal blue accents.",
    typography: "Inter Sans-Serif (Modern & Professional)",
    attentionStyle: "Amber Warm Overlay with Classic Rounded Border",
    chartStyle: "Monochrome Accent (Classic Slate theme-toned bars)",
    bgHex: "#F7F5F0",
    primaryHex: "#334155",
    warningHex: "#D97706",
    surfaceHex: "#FFFFFF",
    features: ["Standard LCMS Grid", "Offline-first performance", "Standard warning borders"],
  },
  {
    id: "theme-cool-multihue",
    name: "Cool Multi-hue",
    desc: "Vibrant and functional cool-slate palette with multi-hue grouping.",
    typography: "Source Serif Headings paired with Inter Sans",
    attentionStyle: "Warm Amber Highlight Box with high contrast text",
    chartStyle: "Multi-hue palette with consistent grouping and smart color overrides",
    bgHex: "#F7F5F0",
    primaryHex: "#334155",
    warningHex: "#D97706",
    surfaceHex: "#FFFFFF",
    features: ["Serif editorial elegance", "Multi-hue chart groupings", "Needs Attention highlights"],
  },
  {
    id: "theme-editorial-blue",
    name: "Editorial Blue",
    desc: "Refined editorial typography with deep legal blue brand accents.",
    typography: "Source Serif 4 (Classic & Authoritative)",
    attentionStyle: "Classic Soft Blue warning card with dark blue icons",
    chartStyle: "Dual-tone deep legal blue and neutral slate charts",
    bgHex: "#F8FAFC",
    primaryHex: "#1E3A8A",
    warningHex: "#D97706",
    surfaceHex: "#FFFFFF",
    features: ["Highly polished editorial feel", "Deep indigo/blue styling", "Elegant negative space"],
  },
  {
    id: "theme-ink-rust",
    name: "Ink & Rust",
    desc: "High-contrast charcoal slate canvas paired with deep rust and clay accents.",
    typography: "Fira Mono + Inter Sans (Industrial & Clear)",
    attentionStyle: "High-contrast thick clay-colored highlight container",
    chartStyle: "Deep rust terracotta with high-contrast visual focus states",
    bgHex: "#F2F0EB",
    primaryHex: "#1F2937",
    warningHex: "#B45309",
    surfaceHex: "#FFFFFF",
    features: ["Deep terracotta accents", "Industrial editorial layouts", "High contrast accessibility"],
  },
  {
    id: "theme-jade-ochre",
    name: "Jade & Ochre",
    desc: "Warm editorial cream canvas with rich forest jade and gold ochre elements.",
    typography: "Source Serif Headings + Soft Sans UI",
    attentionStyle: "Ochre Warning Box with soft amber-cream backdrop",
    chartStyle: "Forest jade primary with rich gold ochre grouping accents",
    bgHex: "#FCF8F0",
    primaryHex: "#0F2E22",
    warningHex: "#B8791A",
    surfaceHex: "#FFFFFF",
    features: ["Forest green & gold ochre colors", "Cream background canvas", "Ochre attention callouts"],
  },
  {
    id: "theme-slate-amber",
    name: "Slate & Amber",
    desc: "Sleek, modern tech slate canvas with amber warning focus states.",
    typography: "JetBrains Mono + Clean Sans",
    attentionStyle: "Alert Amber Solid Frame with pale inner backing",
    chartStyle: "Tech Slate colors with vivid Amber status peaks",
    bgHex: "#F1F5F9",
    primaryHex: "#334155",
    warningHex: "#F59E0B",
    surfaceHex: "#FFFFFF",
    features: ["Vivid amber highlights", "Tech-oriented grid layouts", "High-visibility warning signals"],
  },
];

export function CompareThemesView() {
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [targetBranch, setTargetBranch] = useState<string | null>(null);

  useEffect(() => {
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
    <div className="container mx-auto px-6 py-10 max-w-7xl font-sans min-h-screen">
      {/* Page Header */}
      <div className="border-b pb-8 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Layers className="h-6 w-6 text-primary" />
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase tracking-wider">
              Workspace Desk
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">
            Interactive Theme & Branch Comparison Desk
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Compare all configured design palettes, typography styles, chart settings, and attention indicators on a single dashboard. Click <strong className="text-foreground">Activate Theme</strong> to dynamically check out the branch on the server.
          </p>
        </div>
        <div className="bg-muted/40 p-4 rounded-xl border border-border flex items-center gap-3 text-xs text-muted-foreground">
          <Eye className="h-5 w-5 text-primary flex-shrink-0" />
          <span>
            Hotswapping a branch updates all backend code and styles immediately, then reloads the preview with zero loss of data.
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {THEMES.map((t) => {
          const isActive = currentBranch === t.id;
          const isSwitchingThis = isTransitioning && targetBranch === t.id;

          return (
            <div
              id={`compare-card-${t.id}`}
              key={t.id}
              className={`rounded-2xl border bg-card transition-all flex flex-col relative overflow-hidden ${
                isActive
                  ? "border-primary ring-2 ring-primary/20 shadow-xl scale-[1.01]"
                  : "border-border/60 hover:border-border hover:shadow-lg"
              }`}
            >
              {/* Highlight bar with the primary theme color */}
              <div className="h-2.5 w-full" style={{ backgroundColor: t.primaryHex }} />

              <div className="p-6 flex-1 flex flex-col">
                {/* Theme name & Active tag */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                      {t.name}
                    </h2>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      branch: {t.id}
                    </span>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-0.5 rounded-full">
                      <Check className="h-3 w-3" /> Active Now
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-1">
                  {t.desc}
                </p>

                {/* Color Swatches */}
                <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border/40">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-3">
                    Color Swatches
                  </span>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded-full border border-border shadow-inner"
                        style={{ backgroundColor: t.primaryHex }}
                      />
                      <span className="text-muted-foreground font-mono">Primary</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded-full border border-border shadow-inner"
                        style={{ backgroundColor: t.warningHex }}
                      />
                      <span className="text-muted-foreground font-mono">Warning</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded-full border border-border shadow-inner"
                        style={{ backgroundColor: t.bgHex }}
                      />
                      <span className="text-muted-foreground font-mono">Backing</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-8 h-8 rounded-full border border-border shadow-inner"
                        style={{ backgroundColor: t.surfaceHex }}
                      />
                      <span className="text-muted-foreground font-mono">Surface</span>
                    </div>
                  </div>
                </div>

                {/* Theme Specs */}
                <div className="space-y-3.5 mb-8 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Type className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground font-medium block text-[10px] uppercase">Typography Pair</span>
                      <span className="text-foreground font-medium leading-relaxed">{t.typography}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground font-medium block text-[10px] uppercase">Needs Attention Panel</span>
                      <span className="text-foreground font-medium leading-relaxed">{t.attentionStyle}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Layout className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground font-medium block text-[10px] uppercase">Data Charts Design</span>
                      <span className="text-foreground font-medium leading-relaxed">{t.chartStyle}</span>
                    </div>
                  </div>
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 mb-8">
                  {t.features.map((f, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-md"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* Switch Action */}
                <button
                  id={`switch-btn-${t.id}`}
                  disabled={isActive || isTransitioning}
                  onClick={() => handleSwitch(t.id)}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
                      : isTransitioning
                      ? "bg-muted text-muted-foreground border border-transparent cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:opacity-90 shadow-md hover:shadow-lg border border-transparent"
                  }`}
                >
                  {isSwitchingThis ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Checking out {t.name}...</span>
                    </>
                  ) : isActive ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Theme Active</span>
                    </>
                  ) : (
                    <>
                      <Palette className="h-3.5 w-3.5" />
                      <span>Activate Theme Workspace</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4 text-center p-6 animate-in fade-in duration-200">
          <div className="bg-card p-8 rounded-2xl border border-border shadow-2xl flex flex-col items-center max-w-md">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">Hotswapping Server Branch</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Checking out the <span className="font-semibold text-foreground font-mono">{targetBranch}</span> branch and synchronizing workspace files...
            </p>
            <p className="text-xs text-muted-foreground/80 mt-4 italic">
              Vite is rebuilding stylesheets. Page will reload in a moment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
