import { getSupabase } from "./supabaseClient";
import type { Row, SortKey, SortDir } from "./types";
import { PAGE_SIZE, SELECT_COLS } from "./types";

export type FetchParams = {
  minScore: number;
  severity: string;
  caseType: string;
  status: string[];
  search: string;
  sortKey: SortKey;
  sortDir: SortDir;
  page: number;
};

export type FetchResult = {
  data: Row[];
  count: number;
  source: "v_triage_live" | "articles";
};

function applyFilters(q: any, params: FetchParams) {
  const { minScore, severity, caseType, status, search, sortKey, sortDir, page } = params;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (minScore > 0) q = q.gte("lead_score", minScore);
  if (severity !== "all") q = q.eq("severity", severity);
  if (caseType !== "all") q = q.eq("case_type", caseType);
  if (status.length > 0) q = q.in("status", status);
  if (search.trim()) {
    const s = search.trim();
    q = q.or(`title.ilike.%${s}%,publisher_domain.ilike.%${s}%`);
  }

  q = q.order(sortKey, { ascending: sortDir === "asc" }).range(from, to);
  return q;
}

export async function fetchLeads(params: FetchParams): Promise<FetchResult> {
  const supabase = getSupabase();
  if (!supabase) return { data: [], count: 0, source: "v_triage_live" };

  let q = supabase.from("v_triage_live").select(SELECT_COLS, { count: "exact" });
  q = applyFilters(q, params);
  const r1 = await q;

  if (!r1.error) {
    return { data: (r1.data as Row[]) ?? [], count: r1.count ?? 0, source: "v_triage_live" };
  }

  // fallback to articles table
  let q2 = supabase.from("articles").select(SELECT_COLS, { count: "exact" }).not("triaged_at", "is", null);
  q2 = applyFilters(q2, params);
  const r2 = await q2;

  if (r2.error) throw new Error(`View: ${r1.error.message} | Articles: ${r2.error.message}`);
  return { data: (r2.data as Row[]) ?? [], count: r2.count ?? 0, source: "articles" };
}

export type Stats = { total: number; fatal: number; highPriority: number; newLeads: number; };

export async function fetchStats(): Promise<Stats> {
  const supabase = getSupabase();
  if (!supabase) return { total: 0, fatal: 0, highPriority: 0, newLeads: 0 };

  const active = () => supabase.from("articles")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("closed","ignore")');

  const [total, fatal, highPriority, newLeads] = await Promise.all([
    active(),
    active().eq("severity", "fatal"),
    active().gte("lead_score", 85),
    active().eq("status", "new"),
  ]);

  return {
    total: total.count ?? 0,
    fatal: fatal.count ?? 0,
    highPriority: highPriority.count ?? 0,
    newLeads: newLeads.count ?? 0,
  };
}

export async function deleteArticle(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not initialized");

  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateStatus(id: string, status: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not initialized");

  // try view first, then articles
  const { error: e1 } = await supabase.from("v_triage_live").update({ status }).eq("id", id);
  if (!e1) return;

  const { error: e2 } = await supabase.from("articles").update({ status }).eq("id", id);
  if (e2) throw new Error(e2.message);
}
