import type { Hearing } from "@/types";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

export const hearings: Hearing[] = [
  { id: "h-1", matterId: "m-1096263", forum: "CESTAT Delhi", bench: "Bench-A", causeListItemNo: "12", date: day(1), source: "Clerk email", readiness: "Ready" },
  { id: "h-2", matterId: "m-1096267", forum: "Delhi High Court", bench: "Court No. 8", causeListItemNo: "47", date: day(1), source: "Court sync", readiness: "Prep pending" },
  { id: "h-3", matterId: "m-1096270", forum: "GSTAT", causeListItemNo: "9", date: day(2), source: "Manual", readiness: "Ready" },
  { id: "h-4", matterId: "m-1096289", forum: "Commissioner (Appeals)", date: day(3), source: "Manual", readiness: "Prep pending" },
  { id: "h-5", matterId: "m-1096240", forum: "CESTAT Delhi", bench: "Bench-B", causeListItemNo: "22", date: day(5), source: "Clerk email", readiness: "Ready" },
  { id: "h-6", matterId: "m-1096286", forum: "Delhi High Court", bench: "Court No. 4", date: day(7), source: "Court sync", readiness: "Ready" },
  { id: "h-7", matterId: "m-1096281", forum: "GSTAT", date: day(9), source: "Manual", readiness: "Ready" },
  { id: "h-8", matterId: "m-1096264", forum: "CESTAT Delhi", date: day(11), source: "Clerk email", readiness: "Ready" },
  { id: "h-9", matterId: "m-1096267", forum: "Supreme Court", causeListItemNo: "3", date: day(13), source: "Manual", readiness: "Ready", result: "Order Reserved" },
  { id: "h-10", matterId: "m-1096272", forum: "Commissioner (Appeals)", date: day(14), source: "Manual", readiness: "Prep pending" },
];