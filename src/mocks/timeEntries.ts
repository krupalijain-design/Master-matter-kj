import type { TimeEntry } from "@/types";

const today = new Date();
const dayIso = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

function mk(id: number, userId: string, matterId: string, offset: number, hours: number, minutes: number, activityType: TimeEntry["activityType"], narrative: string, source: TimeEntry["source"] = "manual", status: TimeEntry["status"] = "Submitted"): TimeEntry {
  return { id: `te-${id}`, userId, matterId, date: dayIso(offset), hours, minutes, activityType, narrative, billable: true, source, status };
}

const seed: TimeEntry[] = [
  mk(1, "u-neha", "m-1096264", -4, 3, 30, "Draft Writing", "Drafted reply to SCN 78/CUS/2026, paras 1-14."),
  mk(2, "u-neha", "m-1096270", -4, 2, 0, "Research", "Case research on inverted duty refunds post-2022."),
  mk(3, "u-neha", "m-1096281", -1, 4, 0, "Draft Writing", "Composite works contract SCN, reply skeleton."),
  mk(4, "u-neha", "m-1096263", -1, 2, 0, "Review", "Reviewed civil appeal paper book v2."),
  mk(5, "u-neha", "m-1096290", 0, 1, 30, "Research", "CAAR precedents on EV DC chargers.", "outlook", "Draft"),
  mk(6, "u-arjun", "m-1096240", -3, 5, 0, "Draft Writing", "Consolidated SCN reply final review round."),
  mk(7, "u-arjun", "m-1096244", -3, 2, 30, "Review", "3A DRC-01 reconciliation review."),
  mk(8, "u-arjun", "m-1096281", -2, 3, 0, "Client Meeting", "Call with Orbitel legal."),
  mk(9, "u-arjun", "m-1096270", 0, 1, 0, "Client Correspondence", "Email exchange on order copy."),
  mk(10, "u-priya", "m-1096260", -4, 4, 30, "Research", "Northern Operating Systems: subsequent decisions."),
  mk(11, "u-priya", "m-1096244", -3, 3, 0, "Draft Writing", "3A DRC-01 reply, Annexure A."),
  mk(12, "u-priya", "m-1096283", -1, 2, 0, "Draft Writing", "PCA reply skeleton, paras 1-7."),
  mk(13, "u-priya", "m-1096289", 0, 1, 30, "Hearing/Appearance", "Chief Commissioner: appearance.", "manual", "Draft"),
  mk(14, "u-vikram", "m-1096256", -4, 3, 0, "Research", "Wire rod injury margin, data pack."),
  mk(15, "u-vikram", "m-1096268", -3, 5, 0, "Draft Writing", "Form II: competitive assessment."),
  mk(16, "u-vikram", "m-1096278", -2, 4, 30, "Draft Writing", "Solar CVD: submissions v1."),
  mk(17, "u-vikram", "m-1096286", -1, 2, 0, "Client Meeting", "Northarc: DG questionnaire walkthrough."),
  mk(18, "u-neha", "m-1096251", 0, 0, 45, "Client Correspondence", "Suggested from Outlook: 3 emails with Veridian.", "outlook", "Draft"),
  mk(19, "u-arjun", "m-1096251", 0, 0, 30, "Client Correspondence", "Suggested from Outlook: reply thread.", "outlook", "Draft"),
  mk(20, "u-priya", "m-1096283", 0, 0, 45, "Draft Writing", "Suggested from activity: Word editing.", "activity", "Draft"),
  mk(21, "u-vikram", "m-1096278", 0, 1, 0, "Draft Writing", "Suggested from activity: DGTR submissions.", "activity", "Draft"),
];

const fillerAssoc = ["u-neha", "u-priya", "u-vikram", "u-arjun"];
const fillerMatters = ["m-1096240", "m-1096244", "m-1096251", "m-1096260", "m-1096263", "m-1096264", "m-1096268", "m-1096270", "m-1096276", "m-1096278", "m-1096280", "m-1096281", "m-1096283", "m-1096285", "m-1096286"];
const fillerActs: TimeEntry["activityType"][] = ["Draft Writing", "Research", "Review", "Client Correspondence", "Client Meeting"];
for (let i = 22; i <= 90; i++) {
  const offset = -((i % 15) + 1);
  seed.push(mk(i, fillerAssoc[i % fillerAssoc.length]!, fillerMatters[i % fillerMatters.length]!, offset, (i % 4) + 1, (i * 15) % 60, fillerActs[i % fillerActs.length]!, "Continued work as per file notes."));
}

export const timeEntries: TimeEntry[] = seed;