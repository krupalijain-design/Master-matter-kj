// Automated docketing engine (mocked).
// Produces per-mail routing decisions consumed by the pipeline UI.
import type { MailItem, MailTag } from "@/types";

export type AutoRoute = "auto-file" | "maker" | "docketer";

export interface AutodocketDecision {
  mailId: string;
  acsNo: string;
  route: AutoRoute;
  confidence: number;
  suggestedTag?: MailItem["aiSuggestedTag"];
  targetMatterId?: string;
  reason: string;
  policyFlags: string[];
}

export interface AutodocketConfig {
  tAuto: number; // straight-through threshold
  tMaker: number; // below this ⇒ docketer triage
  samplePct: number; // % of auto-filed items cloned into Checker audit queue
  killSwitch: boolean; // route 100% to Docketer triage
  perTagEnabled?: Partial<Record<MailTag, boolean>>;
  excludedDomains?: string[];
  excludedSenders?: string[];
  excludedSubjectPatterns?: string[];
}

export const DEFAULT_AUTODOCKET_CONFIG: AutodocketConfig = {
  tAuto: 0.9,
  tMaker: 0.6,
  samplePct: 20,
  killSwitch: false,
  perTagEnabled: {
    "New Matter": true,
    "Existing Matter": true,
    "Query": true,
    "Reminder": true,
    "Payment": true,
    "Expense Voucher": true,
    "Feedback": true,
    "Appreciation": true,
    "Complaint": true,
  },
  excludedDomains: [],
  excludedSenders: [],
  excludedSubjectPatterns: [],
};

const PERSONAL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com"];

function isPersonalDomain(from: string): boolean {
  const at = from.lastIndexOf("@");
  if (at < 0) return false;
  return PERSONAL_DOMAINS.some((d) => from.slice(at + 1).toLowerCase().includes(d));
}

function policyFlagsFor(mail: MailItem): string[] {
  const flags: string[] = [];
  if (isPersonalDomain(mail.from)) flags.push("personal-domain");
  if ((!mail.bodyPreview || mail.bodyPreview.length < 20) && mail.attachments.length >= 3)
    flags.push("empty-body-multi-attachment");
  if (!mail.subject) flags.push("no-subject");
  return flags;
}

/** Deterministic decision for one mail. */
export function decide(mail: MailItem, cfg: AutodocketConfig): AutodocketDecision {
  const acsNo = mail.acsNo ?? "ACS-UNKNOWN";
  const confidence = mail.aiConfidence ?? 0;
  const tag = mail.aiSuggestedTag;
  const bestCandidate = [...mail.matchCandidates].sort((a, b) => b.confidence - a.confidence)[0];
  const policyFlags = policyFlagsFor(mail);

  // Kill switch: 100% → docketer.
  if (cfg.killSwitch) {
    return { mailId: mail.id, acsNo, route: "docketer", confidence, suggestedTag: tag, reason: "Kill switch active", policyFlags };
  }

  // Already resolved (Tagged/Discarded/Flagged) — leave untouched.
  if (mail.state !== "Pending") {
    return { mailId: mail.id, acsNo, route: "docketer", confidence, suggestedTag: tag, reason: `state=${mail.state}`, policyFlags };
  }

  // Per-tag disabled → force human triage.
  if (tag && cfg.perTagEnabled && cfg.perTagEnabled[tag] === false) {
    return { mailId: mail.id, acsNo, route: "docketer", confidence, suggestedTag: tag, reason: `Tag "${tag}" disabled for automation`, policyFlags };
  }

  // Policy flags force human triage.
  if (policyFlags.length > 0) {
    return { mailId: mail.id, acsNo, route: "docketer", confidence, suggestedTag: tag, reason: `Policy: ${policyFlags.join(", ")}`, policyFlags };
  }

  // Straight-through: existing matter, high confidence, strong candidate.
  if (tag === "Existing Matter" && confidence >= cfg.tAuto && bestCandidate && bestCandidate.confidence >= cfg.tAuto) {
    return {
      mailId: mail.id,
      acsNo,
      route: "auto-file",
      confidence: bestCandidate.confidence,
      suggestedTag: tag,
      targetMatterId: bestCandidate.matterId,
      reason: `Existing-matter match ≥ ${Math.round(cfg.tAuto * 100)}%`,
      policyFlags,
    };
  }

  // Maker queue: New Matter (any confidence) or mid-band Existing.
  if (tag === "New Matter" || (tag && confidence >= cfg.tMaker)) {
    return {
      mailId: mail.id,
      acsNo,
      route: "maker",
      confidence,
      suggestedTag: tag,
      targetMatterId: bestCandidate?.matterId,
      reason: tag === "New Matter" ? "New Matter — human create" : "Mid-band existing match",
      policyFlags,
    };
  }

  // Fallback: docketer triage.
  return { mailId: mail.id, acsNo, route: "docketer", confidence, suggestedTag: tag, reason: "Low confidence / no candidates", policyFlags };
}

export function decideAll(mails: MailItem[], cfg: AutodocketConfig): AutodocketDecision[] {
  return mails.map((m) => decide(m, cfg));
}

/** Deterministic pseudo-random sampler so seeded items land in the audit queue predictably. */
export function isSampled(mailId: string, samplePct: number): boolean {
  if (samplePct <= 0) return false;
  if (samplePct >= 100) return true;
  let h = 0;
  for (let i = 0; i < mailId.length; i++) h = (h * 31 + mailId.charCodeAt(i)) >>> 0;
  return h % 100 < samplePct;
}