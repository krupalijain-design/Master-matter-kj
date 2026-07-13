import type { Task } from "@/types";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

function t(id: number, matterId: string | undefined, taskType: Task["taskType"], subject: string, assigneeId: string, dueOffset: number, priority: Task["priority"] = "Normal", source: Task["source"] = "Manual", status: Task["status"] = "Open"): Task {
  return { id: `t-${id}`, matterId, taskType, subject, assigneeId, dueDate: day(dueOffset), status, priority, source, createdAt: day(-3), completedAt: status === "Completed" ? day(-1) : undefined, assignedById: "u-kavita" };
}

export const tasks: Task[] = [
  t(1, "m-1096264", "Drafting", "Complete SCN reply v1 for partner review", "u-neha", 2, "High"),
  t(2, "m-1096240", "Filing", "File compilation of documents at CESTAT registry", "u-anita", 4, "High"),
  t(3, "m-1096272", "Complete matter details", "Fill missing office, deliverable, fee quote", "u-ravi", 1, "High", "partial-details"),
  t(4, "m-1096283", "Complete matter details", "Add reference date, docRefNumber, associates", "u-sameer", 2, "High", "partial-details"),
  t(5, "m-1096287", "Complete matter details", "Conflict review pending; capture other party", "u-ravi", 3, "High", "partial-details"),
  t(6, "m-1096270", "Research", "Precedents on rejection of inverted refund on cap goods", "u-neha", 3, "Normal"),
  t(7, "m-1096267", "Drafting", "Prepare Sec 34 rejoinder", "u-vikram", 5, "Normal"),
  t(8, "m-1096244", "Review", "Review DRC-01 reply Annexure A", "u-arjun", 1, "High"),
  t(9, "m-1096251", "Opinion", "Draft opinion on GST on capex reversal", "u-neha", 6, "Normal"),
  t(10, "m-1096281", "Drafting", "Composite works contract reply v2", "u-neha", 4, "High"),
  t(11, "m-1096289", "Filing", "File vakalatnama and appearance memo", "u-priya", 2, "High"),
  t(12, "m-1096286", "Research", "Cartel: economic evidence review", "u-vikram", 7, "Normal"),
  t(13, "m-1096256", "Drafting", "DGTR injury margin submissions v2", "u-vikram", 6, "Normal"),
  t(14, "m-1096290", "Opinion", "Draft CAAR application", "u-neha", 8, "Normal"),
  t(15, "m-1096263", "Filing", "File written submissions at CESTAT", "u-anita", 2, "High", "Hearing"),
  t(16, "m-1096268", "Drafting", "Form II competitive assessment", "u-vikram", 9, "Normal"),
  t(17, "m-1096260", "Opinion", "Cross-charge opinion v2", "u-priya", 3, "Normal"),
  t(18, "m-1096285", "Opinion", "Guarantees opinion final", "u-vikram", 4, "Normal"),
  t(19, undefined, "Review", "Weekly review, Indirect Tax pipeline", "u-arjun", 1, "Normal", "Assigned"),
  t(20, "m-1096276", "Opinion", "PIR advisory draft", "u-neha", 5, "Normal"),
  t(21, "m-1096278", "Drafting", "Solar CVD questionnaire response", "u-vikram", 6, "Normal"),
  t(22, "m-1096244", "Filing", "File DRC-01 reply on portal", "u-priya", 5, "High"),
  t(23, "m-1096240", "Review", "Partner review SCN reply v3", "u-kavita", 2, "High"),
  t(24, "m-1096264", "Research", "Classification precedents CTH 8517", "u-neha", 4, "Normal", "Mail"),
  t(25, "m-1096283", "Drafting", "PCA reply consolidate 14 BEs", "u-priya", 5, "Normal"),
  t(26, "m-1096251", "Drafting", "Monthly advisory note August", "u-neha", 3, "Normal", "Assigned", "Completed"),
  t(27, "m-1096270", "Drafting", "GSTAT appeal grounds v1", "u-neha", -1, "High", "Manual", "Completed"),
  t(28, "m-1096290", "Research", "Chargers HS classification", "u-neha", -2, "Normal", "Manual", "Completed"),
  t(29, "m-1096289", "Research", "CB license precedents", "u-priya", -3, "Normal", "Manual", "Completed"),
  t(30, "m-1096268", "Review", "Form II internal QC", "u-arjun", 8, "Normal"),
];