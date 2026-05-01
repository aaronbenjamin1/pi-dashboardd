export type Row = {
  id: string;
  url: string | null;
  title: string | null;
  publisher_domain: string | null;
  people: string[] | null;
  severity: string | null;
  case_type: string | null;
  lead_score: number | null;
  triage_reasons: string[] | null;
  triaged_at: string | null;
  ingested_at: string | null;
  status: string | null;
};

export const SEVERITIES = ["all", "fatal", "serious_injury", "injury", "unknown"] as const;
export const CASE_TYPES = ["all", "truck", "pedestrian", "auto", "motorcycle", "unknown"] as const;
export const STATUSES = ["all", "new", "reviewing", "contacted", "done", "closed", "ignore"] as const;
export const STATUS_OPTIONS = ["new", "reviewing", "contacted", "done", "closed", "ignore"] as const;

export const PAGE_SIZE = 50;
export const SELECT_COLS =
  "id,url,title,publisher_domain,people,severity,case_type,lead_score,triage_reasons,triaged_at,ingested_at,status";

export type SortKey = "triaged_at" | "lead_score";
export type SortDir = "asc" | "desc";
