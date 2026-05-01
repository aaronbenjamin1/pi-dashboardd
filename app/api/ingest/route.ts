import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

type Article = {
  url: string;
  title: string;
  publisher_domain: string;
  people: string[];
  severity: string;
  case_type: string;
  lead_score: number;
  triage_reasons: string[];
  status: string;
  ingested_at: string;
  triaged_at: string;
};

// ── RSS parser ────────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  const m = xml.match(re);
  return (m ? (m[1] ?? m[2] ?? "") : "").replace(/<[^>]+>/g, "").trim();
}

function parseRss(xml: string) {
  const items: { title: string; link: string; description: string; pubDate: string }[] = [];
  for (const m of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)) {
    const raw = m[1];
    // <link> in RSS is sometimes a text node after the tag, not wrapped
    const linkMatch = raw.match(/<link>([^<]*)<\/link>/) ?? raw.match(/<link\s[^>]*href="([^"]+)"/);
    items.push({
      title: extractTag(raw, "title"),
      link: (linkMatch?.[1] ?? extractTag(raw, "link")).trim(),
      description: extractTag(raw, "description"),
      pubDate: extractTag(raw, "pubDate"),
    });
  }
  return items;
}

// ── PI classifier ─────────────────────────────────────────────────────────────

const PI_TRIGGERS = [
  "accident", "collision", "crash", "struck", "hit and run",
  "injured", "injuries", "killed", "fatal", "fatality", "death", "died",
  "victim", "hospital", "emergency", "ambulance",
];

const CASE_KEYWORDS: Record<string, string[]> = {
  motorcycle: ["motorcycle", "motorcyclist", "motorbike", "moped", "scooter"],
  truck: ["truck", "semi-truck", "semi truck", "18-wheeler", "big rig", "tractor-trailer", "commercial vehicle", "freight truck"],
  pedestrian: ["pedestrian", "on foot", "crosswalk", "jaywalking", "sidewalk"],
  auto: ["car accident", "car crash", "vehicle", "DUI", "drunk driving", "drunk driver", "road rage"],
};

const SEVERITY_KEYWORDS: Record<string, string[]> = {
  fatal: ["killed", "dead", "fatal", "fatality", "death", "died", "homicide", "murder"],
  serious_injury: ["critically injured", "critical condition", "serious injuries", "hospitalized", "airlifted", "life-threatening", "ICU", "intensive care"],
  injury: ["injured", "hurt", "transported to hospital", "taken to hospital", "treated for injuries", "collision", "crash"],
};

const CA_KEYWORDS = [
  "california", " ca ", "los angeles", "san francisco", "san diego", "fresno",
  "sacramento", "san jose", "bakersfield", "stockton", "riverside", "anaheim",
  "freeway", "highway", "interstate",
];

const NAME_PATTERNS = [
  /identified as ([A-Z][a-z]+ [A-Z][a-z]+)/g,
  /victim[,\s]+([A-Z][a-z]+ [A-Z][a-z]+)/g,
  /([A-Z][a-z]+ [A-Z][a-z]+),?\s+\d{1,2},/g,
  /driver[,\s]+([A-Z][a-z]+ [A-Z][a-z]+)/g,
];

function classify(title: string, description: string): Article | null {
  const text = `${title} ${description}`.toLowerCase();

  // Must mention at least one PI trigger
  const hasTrigger = PI_TRIGGERS.some(k => text.includes(k));
  if (!hasTrigger) return null;

  // Must mention California
  const hasCA = CA_KEYWORDS.some(k => text.includes(k));
  if (!hasCA) return null;

  // Severity
  let severity = "unknown";
  const reasons: string[] = [];
  for (const [level, words] of Object.entries(SEVERITY_KEYWORDS)) {
    const matched = words.filter(w => text.includes(w));
    if (matched.length) {
      severity = level;
      reasons.push(...matched);
      break;
    }
  }

  // Case type
  let case_type = "unknown";
  for (const [type, words] of Object.entries(CASE_KEYWORDS)) {
    const matched = words.filter(w => text.includes(w));
    if (matched.length) {
      case_type = type;
      reasons.push(...matched);
      break;
    }
  }
  if (case_type === "unknown" && hasTrigger) case_type = "auto";

  // Lead score
  const base: Record<string, number> = { fatal: 88, serious_injury: 73, injury: 55, unknown: 32 };
  let score = base[severity] ?? 32;
  if (case_type === "truck") score += 7;
  if (case_type === "motorcycle") score += 4;
  const caBonus = CA_KEYWORDS.filter(k => text.includes(k)).length;
  score = Math.min(99, score + Math.min(caBonus * 2, 8));

  // People
  const fullText = `${title} ${description}`;
  const people = new Set<string>();
  for (const re of NAME_PATTERNS) {
    for (const m of fullText.matchAll(re)) {
      const name = m[1]?.trim();
      if (name && name.split(" ").length === 2) people.add(name);
    }
  }

  return {
    url: "",
    title,
    publisher_domain: "",
    people: [...people],
    severity,
    case_type,
    lead_score: score,
    triage_reasons: [...new Set(reasons)],
    status: "new",
    ingested_at: new Date().toISOString(),
    triaged_at: new Date().toISOString(),
  };
}

// ── Shared ingest logic ───────────────────────────────────────────────────────

async function runIngest() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase service key not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const feeds = (process.env.RSS_FEEDS ?? "").split(",").map(f => f.trim()).filter(Boolean);
  if (!feeds.length) return NextResponse.json({ error: "No RSS_FEEDS configured" }, { status: 400 });

  const inserted: string[] = [];
  const errors: string[] = [];

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { errors.push(`${feedUrl}: HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const items = parseRss(xml);
      let domain = "";
      try { domain = new URL(feedUrl).hostname.replace("www.", ""); } catch {}

      const articles: Article[] = [];
      for (const item of items) {
        if (!item.link) continue;
        const classified = classify(item.title, item.description);
        if (!classified) continue;
        articles.push({ ...classified, url: item.link, publisher_domain: domain });
      }
      if (!articles.length) continue;

      const { error } = await supabase
        .from("articles")
        .upsert(articles, { onConflict: "url", ignoreDuplicates: true });

      if (error) errors.push(`${domain}: ${error.message}`);
      else inserted.push(`${domain} (${articles.length})`);
    } catch (e: any) {
      errors.push(`${feedUrl}: ${e.message}`);
    }
  }

  return NextResponse.json({
    inserted,
    errors,
    total_feeds: feeds.length,
    total_inserted: inserted.reduce((sum, s) => sum + parseInt(s.match(/\((\d+)\)/)?.[1] ?? "0"), 0),
  });
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  const ingestSecret = process.env.INGEST_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  return auth === `Bearer ${ingestSecret}` || auth === `Bearer ${cronSecret}`;
}

// ── Route handlers ────────────────────────────────────────────────────────────

// GET — called by Vercel cron every hour
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runIngest();
}

// POST — manual trigger
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runIngest();
}
