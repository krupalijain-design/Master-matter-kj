import { formatDistanceToNowStrict } from "date-fns";

// Indian numbering system grouping (e.g., 12,34,567)
export function formatINR(amount: number, opts: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = opts;
  const negative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const s = abs.toString();
  const lastThree = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  return `${negative ? "-" : ""}${withSymbol ? "₹" : ""}${grouped}`;
}

export function timeAgo(iso: string): string {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}