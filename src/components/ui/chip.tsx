import type { ReactNode } from "react";
import { Check, Clock, Info, AlertTriangle, Ban, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipTone = "success" | "pending" | "info" | "danger" | "neutral" | "accent";
export type ChipSize = "sm" | "md";

const TONE_CLASSES: Record<ChipTone, string> = {
  success: "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]",
  pending: "bg-[var(--chip-pending-bg)] text-[var(--chip-pending-fg)]",
  info: "bg-[var(--chip-info-bg)] text-[var(--chip-info-fg)]",
  danger: "bg-[var(--chip-danger-bg)] text-[var(--chip-danger-fg)]",
  neutral: "bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]",
  accent: "bg-[var(--chip-accent-bg)] text-[var(--chip-accent-fg)]",
};

const DEFAULT_ICON: Record<ChipTone, typeof Check | null> = {
  success: CircleCheck,
  pending: Clock,
  info: Info,
  danger: AlertTriangle,
  neutral: null,
  accent: null,
};

export function Chip({
  tone = "neutral",
  size = "sm",
  icon,
  hideIcon,
  strikethrough,
  className,
  title,
  children,
  as,
  onClick,
}: {
  tone?: ChipTone;
  size?: ChipSize;
  icon?: ReactNode;
  hideIcon?: boolean;
  strikethrough?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
  as?: "span" | "button";
  onClick?: () => void;
}) {
  const Tag = (as ?? (onClick ? "button" : "span")) as "span" | "button";
  const DefaultIcon = DEFAULT_ICON[tone];
  const iconEl = hideIcon
    ? null
    : icon !== undefined
    ? icon
    : DefaultIcon
    ? <DefaultIcon className="h-3 w-3 shrink-0" />
    : null;
  return (
    <Tag
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap max-w-[220px]",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-[12px]",
        TONE_CLASSES[tone],
        strikethrough && "line-through opacity-70",
        onClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        className,
      )}
    >
      {iconEl}
      <span className="truncate">{children}</span>
    </Tag>
  );
}

// Category color coding — 11 practices, each a soft tone paired with the label.
export type CategoryKey =
  | "Tax - Indirect"
  | "Tax - Direct"
  | "Corporate and M&A"
  | "Corporate"
  | "International Trade"
  | "Commercial Dispute Resolution"
  | "Technology Law"
  | "Data Protection"
  | "Food Safety Law"
  | "Transaction Tax"
  | "IPR"
  | "Criminal Law";

const CATEGORY_STYLES: Record<CategoryKey, { bg: string; fg: string }> = {
  "Tax - Indirect":               { bg: "hsl(174 42% 91%)", fg: "hsl(174 48% 24%)" }, // teal
  "Tax - Direct":                 { bg: "hsl(190 55% 91%)", fg: "hsl(190 55% 26%)" }, // cyan
  "Corporate and M&A":            { bg: "hsl(232 50% 93%)", fg: "hsl(232 45% 34%)" }, // indigo
  "Corporate":                    { bg: "hsl(232 50% 93%)", fg: "hsl(232 45% 34%)" },
  "International Trade":          { bg: "hsl(140 44% 91%)", fg: "hsl(140 44% 24%)" }, // green
  "Commercial Dispute Resolution":{ bg: "hsl(345 62% 93%)", fg: "hsl(345 50% 34%)" }, // rose
  "Technology Law":               { bg: "hsl(265 48% 93%)", fg: "hsl(265 42% 36%)" }, // violet
  "Data Protection":              { bg: "hsl(205 60% 92%)", fg: "hsl(205 55% 30%)" }, // sky
  "Food Safety Law":              { bg: "hsl(85 42% 90%)",  fg: "hsl(85 48% 24%)"  }, // lime
  "Transaction Tax":              { bg: "hsl(158 44% 91%)", fg: "hsl(158 48% 24%)" }, // emerald
  "IPR":                          { bg: "hsl(295 42% 93%)", fg: "hsl(295 38% 34%)" }, // plum
  "Criminal Law":                 { bg: "hsl(12 55% 92%)",  fg: "hsl(12 55% 32%)"  }, // brick
};

export function categoryStyle(category: string): { bg: string; fg: string } {
  return CATEGORY_STYLES[category as CategoryKey] ?? { bg: "var(--chip-neutral-bg)", fg: "var(--chip-neutral-fg)" };
}

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  const s = categoryStyle(category);
  return (
    <span
      title={category}
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium whitespace-nowrap max-w-[200px]",
        className,
      )}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="truncate">{category}</span>
    </span>
  );
}

// Overflow helper: shows first N chips + a "+M" neutral chip with a hover list.
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ChipList({
  items,
  max = 2,
  render,
}: {
  items: string[];
  max?: number;
  render: (label: string) => ReactNode;
}) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  return (
    <div className="inline-flex items-center gap-1 flex-nowrap">
      {shown.map((it) => (
        <span key={it}>{render(it)}</span>
      ))}
      {rest.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium whitespace-nowrap bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)] hover:brightness-95">
              +{rest.length}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              {rest.length} more
            </div>
            <div className="flex flex-wrap gap-1">
              {rest.map((it) => (
                <span key={it}>{render(it)}</span>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}