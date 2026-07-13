// AI-extracted vs Maker-submitted diffs for mail-created Pending matters.
// Feeds the Checker Review Drawer side-by-side comparison.

export interface CheckerFieldDiff {
  field: string;
  aiExtracted?: string;
  makerSubmitted?: string;
  changed: boolean;
}

export interface CheckerReviewPayload {
  matterId: string;
  sourceMailId: string;
  aiConfidence: number;
  fields: CheckerFieldDiff[];
}

export const checkerReviewPayloads: CheckerReviewPayload[] = [
  {
    matterId: "m-1096272",
    sourceMailId: "ml-007",
    aiConfidence: 0.87,
    fields: [
      { field: "Matter Title", aiExtracted: "SVB related-party import valuation (Butibori)", makerSubmitted: "SCN, Customs valuation of related-party imports", changed: true },
      { field: "Client", aiExtracted: "Copperline Metals", makerSubmitted: "Copperline Metals", changed: false },
      { field: "Category", aiExtracted: "Tax - Indirect", makerSubmitted: "Tax - Indirect", changed: false },
      { field: "Sub Category", aiExtracted: "Customs", makerSubmitted: "Customs", changed: false },
      { field: "Deliverable", aiExtracted: "Legal Opinion", makerSubmitted: "Reply to SCN", changed: true },
      { field: "Branch", aiExtracted: "Nagpur", makerSubmitted: "Nagpur", changed: false },
      { field: "Doc Ref Number", aiExtracted: "SVB-NGP-44", makerSubmitted: "SVB/NGP/44/2026", changed: true },
      { field: "Case Partner", aiExtracted: "Kavita Rao", makerSubmitted: "Kavita Rao", changed: false },
      { field: "Issue in Brief", aiExtracted: "SVB review, related-party imports, 4 overseas suppliers.", makerSubmitted: "SVB review, related-party import valuation; SCN issued for FY19-FY23.", changed: true },
    ],
  },
  {
    matterId: "m-1096283",
    sourceMailId: "ml-015",
    aiConfidence: 0.79,
    fields: [
      { field: "Matter Title", aiExtracted: "PCA audit paras, customs post-clearance", makerSubmitted: "Reply to audit para, customs post-clearance audit", changed: true },
      { field: "Client", aiExtracted: "TrueNorth Logistics", makerSubmitted: "TrueNorth Logistics", changed: false },
      { field: "Category", aiExtracted: "Tax - Indirect", makerSubmitted: "Tax - Indirect", changed: false },
      { field: "Sub Category", aiExtracted: "Customs", makerSubmitted: "Customs", changed: false },
      { field: "Deliverable", aiExtracted: "Reply to SCN", makerSubmitted: "Reply to SCN", changed: false },
      { field: "Branch", aiExtracted: "Mumbai", makerSubmitted: "Mumbai", changed: false },
      { field: "Doc Ref Number", aiExtracted: "PCA-BOM-2026-084", makerSubmitted: "PCA/BOM/2026/084", changed: true },
      { field: "Case Partner", aiExtracted: "Suresh Patel", makerSubmitted: "Suresh Patel", changed: false },
      { field: "Issue in Brief", aiExtracted: "Audit paras across 14 BEs.", makerSubmitted: "PCA audit paras across 14 BEs; drafting consolidated reply.", changed: true },
    ],
  },
  {
    matterId: "m-1096287",
    sourceMailId: "ml-001",
    aiConfidence: 0.94,
    fields: [
      { field: "Matter Title", aiExtracted: "SCN, undervaluation, copper cathode imports", makerSubmitted: "SCN, undervaluation of copper cathode imports", changed: true },
      { field: "Client", aiExtracted: "Copperline Metals", makerSubmitted: "Copperline Metals", changed: false },
      { field: "Category", aiExtracted: "Tax - Indirect", makerSubmitted: "Tax - Indirect", changed: false },
      { field: "Sub Category", aiExtracted: "Customs", makerSubmitted: "Customs", changed: false },
      { field: "Deliverable", aiExtracted: "Reply to SCN", makerSubmitted: "Reply to SCN", changed: false },
      { field: "Branch", aiExtracted: "Nagpur", makerSubmitted: "Nagpur", changed: false },
      { field: "Doc Ref Number", aiExtracted: "SCN 44/CUS/NGP/2026", makerSubmitted: "SCN 44/CUS/NGP/2026", changed: false },
      { field: "Case Partner", aiExtracted: "Kavita Rao", makerSubmitted: "Kavita Rao", changed: false },
      { field: "Issue in Brief", aiExtracted: "SCN alleging undervaluation across 42 BEs; approx 3.1 Cr differential.", makerSubmitted: "SCN alleging undervaluation across 42 BEs; approx 3.1 Cr differential.", changed: false },
    ],
  },
];

export const getCheckerPayload = (matterId: string): CheckerReviewPayload | undefined =>
  checkerReviewPayloads.find((p) => p.matterId === matterId);