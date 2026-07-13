export function parseDuration(input: string): { hours: number; minutes: number } | null {
  const s = input.trim();
  if (!s) return null;
  // "1:30" HH:MM
  const m1 = s.match(/^(\d+):([0-5]?\d)$/);
  if (m1) return { hours: Number(m1[1]), minutes: Number(m1[2]) };
  // "90m" minutes
  const m2 = s.match(/^(\d+)\s*m$/i);
  if (m2) {
    const total = Number(m2[1]);
    return { hours: Math.floor(total / 60), minutes: total % 60 };
  }
  // "1.5" or "1.5h" decimal hours
  const m3 = s.match(/^(\d+(?:\.\d+)?)\s*h?$/i);
  if (m3) {
    const total = Number(m3[1]);
    const hours = Math.floor(total);
    const minutes = Math.round((total - hours) * 60);
    return { hours, minutes };
  }
  return null;
}

export function fmtHm(hours: number, minutes: number): string {
  const total = hours + minutes / 60;
  if (minutes === 0) return `${hours}h`;
  return `${total.toFixed(total % 1 === 0 ? 0 : 1)}h`;
}

export function toDecimal(hours: number, minutes: number): number {
  return hours + minutes / 60;
}

/** ISO Monday of the week containing d. */
export function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0..6, Sun..Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function weekKey(monday: Date): string {
  return isoDate(monday);
}

export function activityNarrativeTemplate(activity: string): string {
  switch (activity) {
    case "Client Correspondence": return "Email exchange re: ";
    case "Client Meeting": return "Call with client re: ";
    case "Draft Writing": return "Drafted ";
    case "Review": return "Reviewed ";
    case "Research": return "Research on ";
    case "Hearing/Appearance": return "Appearance before ";
    default: return "";
  }
}
