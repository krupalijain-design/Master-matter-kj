export interface MatterColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
  searchable: boolean;
}

export const MATTER_COLUMNS: MatterColumnDef[] = [
  { key: "matterId", label: "Matter ID", defaultVisible: true, sortable: true, searchable: true },
  { key: "clientName", label: "Client Name", defaultVisible: true, sortable: true, searchable: true },
  { key: "title", label: "Matter Title", defaultVisible: true, sortable: true, searchable: true },
  { key: "deliverable", label: "Deliverable", defaultVisible: true, sortable: true, searchable: true },
  { key: "subType", label: "Sub Type", defaultVisible: true, sortable: true, searchable: true },
  { key: "subCategory", label: "Sub Category", defaultVisible: true, sortable: true, searchable: true },
  { key: "category", label: "Category", defaultVisible: false, sortable: true, searchable: true },
  { key: "matterType", label: "Matter Type", defaultVisible: false, sortable: true, searchable: true },
  { key: "casePartner", label: "Case Partner", defaultVisible: true, sortable: true, searchable: true },
  { key: "caseManager", label: "Case Manager", defaultVisible: true, sortable: true, searchable: true },
  { key: "caseAssociate", label: "Case Associate", defaultVisible: false, sortable: false, searchable: true },
  { key: "branch", label: "Branch", defaultVisible: true, sortable: true, searchable: true },
  { key: "createdAt", label: "Matter Creation Date", defaultVisible: true, sortable: true, searchable: false },
  { key: "status", label: "Status", defaultVisible: false, sortable: true, searchable: true },
  { key: "maker", label: "Maker", defaultVisible: false, sortable: true, searchable: true },
  { key: "docRef", label: "Doc Ref Number", defaultVisible: false, sortable: true, searchable: true },
];

export const DEFAULT_COLUMN_KEYS = MATTER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
