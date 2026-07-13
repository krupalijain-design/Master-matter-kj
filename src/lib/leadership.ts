import type { Matter, Role, User } from "@/types";

export type LeadershipScope = {
  label: string;
  practiceAreas?: Matter["category"][];
  groups?: ("North" | "West" | "South")[];
  branches?: Matter["branch"][];
};

/** Deterministic fee-quote status derived from matterId when not set on the mock. */
export function feeQuoteStatusOf(m: Matter): "Not sent" | "Sent" | "Accepted" | "Rejected" {
  if (m.feeQuoteStatus) return m.feeQuoteStatus;
  const n = m.matterId % 11;
  if (n === 0) return "Rejected";
  if (n < 3) return "Sent";
  if (n < 4) return "Not sent";
  return "Accepted";
}

/** Deterministic practice-group derived from branch. */
export function practiceGroupOf(m: Matter): "North" | "West" | "South" {
  if (m.practiceGroup) return m.practiceGroup;
  if (m.branch === "Mumbai" || m.branch === "Nagpur") return "West";
  if (m.branch === "Bengaluru") return "South";
  return "North";
}

export function practiceAreaOf(m: Matter): string {
  if (m.practiceArea) return m.practiceArea;
  if (m.category === "Tax - Indirect") return "Indirect Tax";
  if (m.category === "Tax - Direct") return "Direct Tax";
  return m.category;
}

/** Returns the leadership scope for the active role of a user. */
export function scopeForRole(role: Role, user: User): LeadershipScope {
  if (role === "Management" || role === "Executive Head") {
    return { label: "Firm-wide" };
  }
  if (role === "Practice Head") {
    // Practice heads are pinned to Indirect Tax in the mock (both leadership users lead that practice).
    return { label: "Indirect Tax", practiceAreas: ["Tax - Indirect"] };
  }
  if (role === "Group Head") {
    // Group heads scope to their branch group. Rohan Bhatt (Delhi) → North.
    if (user.branch === "Mumbai" || user.branch === "Nagpur")
      return { label: "Indirect Tax — West", practiceAreas: ["Tax - Indirect"], groups: ["West"] };
    if (user.branch === "Bengaluru")
      return { label: "Indirect Tax — South", practiceAreas: ["Tax - Indirect"], groups: ["South"] };
    return { label: "Indirect Tax — North", practiceAreas: ["Tax - Indirect"], groups: ["North"] };
  }
  return { label: "Team scope" };
}

export function matterInScope(m: Matter, scope: LeadershipScope): boolean {
  if (scope.practiceAreas && !scope.practiceAreas.includes(m.category)) return false;
  if (scope.groups && !scope.groups.includes(practiceGroupOf(m))) return false;
  if (scope.branches && !scope.branches.includes(m.branch)) return false;
  return true;
}

/** Days since ISO. */
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}