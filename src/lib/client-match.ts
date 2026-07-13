import type { Client } from "@/types";

/** Normalise a string for fuzzy comparison. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Tokens > 2 chars. */
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 2);

/** Very light Jaccard-token similarity, returns 0–100. */
export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((t) => B.has(t) && inter++);
  const union = new Set([...A, ...B]).size;
  return Math.round((inter / union) * 100);
}

export type ClientMatch = {
  client: Client;
  matchedOn: "name" | "oldName" | "newName" | "alias" | "gstin";
  matchedValue: string;
  score: number;
};

/** Search clients on name + oldName + newName + alias + gstin, best-per-client. */
export function searchClients(clients: Client[], q: string, min = 50): ClientMatch[] {
  const query = q.trim();
  if (!query) return [];
  const out: ClientMatch[] = [];
  for (const c of clients) {
    const candidates: { key: ClientMatch["matchedOn"]; value: string }[] = [
      { key: "name", value: c.name },
    ];
    if (c.oldName) candidates.push({ key: "oldName", value: c.oldName });
    if (c.newName && c.newName !== c.name) candidates.push({ key: "newName", value: c.newName });
    (c.alias ?? []).forEach((a) => candidates.push({ key: "alias", value: a }));
    if (c.gstin) candidates.push({ key: "gstin", value: c.gstin });

    let best: ClientMatch | null = null;
    const qLower = query.toLowerCase();
    for (const cand of candidates) {
      const vLower = cand.value.toLowerCase();
      let score = 0;
      if (vLower === qLower) score = 100;
      else if (vLower.includes(qLower) || qLower.includes(vLower)) score = 90;
      else score = similarity(cand.value, query);
      if (score >= min && (!best || score > best.score)) {
        best = { client: c, matchedOn: cand.key, matchedValue: cand.value, score };
      }
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score);
}

export function matchLabel(m: ClientMatch): string | null {
  if (m.matchedOn === "name") return null;
  const labels: Record<ClientMatch["matchedOn"], string> = {
    name: "",
    oldName: "matched on former name",
    newName: "matched on new name",
    alias: "matched on alias",
    gstin: "matched on GSTIN",
  };
  return `${labels[m.matchedOn]} "${m.matchedValue}"`;
}
