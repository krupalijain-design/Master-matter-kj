import type { NonBillableWork } from "@/types";

export const nonBillable: NonBillableWork[] = [
  { id: "nb-1", userId: "u-neha", kind: "Article", title: "Post-Mohit Minerals refund route: practical playbook", date: "2026-06-14", status: "Approved", approverId: "u-kavita" },
  { id: "nb-2", userId: "u-arjun", kind: "Newsletter", title: "Indirect Tax weekly, 27 June 2026", date: "2026-06-27", status: "Approved", approverId: "u-kavita" },
  { id: "nb-3", userId: "u-priya", kind: "Webinar", title: "GST 8 years on, a practitioners view", date: "2026-07-01", status: "Submitted" },
  { id: "nb-4", userId: "u-vikram", kind: "Conference", title: "DGTR conclave, panelist", date: "2026-07-10", status: "Submitted" },
  { id: "nb-5", userId: "u-kavita", kind: "Seminar", title: "AIFTA compliance, CII closed-door", date: "2026-06-05", status: "Approved", approverId: "u-suresh" },
  { id: "nb-6", userId: "u-suresh", kind: "Article", title: "Cross-charges and the missing link", date: "2026-05-30", status: "Rejected", approverId: "u-kavita" },
];