import type { WriteOffRequest } from "@/types";

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

export const writeOffRequests: WriteOffRequest[] = [
  { id: "wo-1", rtbId: "r-6", matterId: "m-1096263", amount: 120000, agingDays: 92, reason: "Client dispute on hearing count, negotiated write-down.", requestedById: "u-arjun", requestedByName: "Arjun Iyer", requestedAt: iso(2) },
  { id: "wo-2", rtbId: "r-13", matterId: "m-1096285", amount: 25000, agingDays: 47, reason: "Time-barred fee, partner concession.", requestedById: "u-priya", requestedByName: "Priya Nair", requestedAt: iso(1) },
];
