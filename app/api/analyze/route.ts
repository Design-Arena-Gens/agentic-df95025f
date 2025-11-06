import { NextRequest } from "next/server";

export const runtime = "nodejs";

export type Account = {
  handle: string;
  name: string | null;
  followers: number | null;
  averageViews: number | null;
  category: string | null;
  engagementRate: number | null;
  location: string | null;
  error?: string | null;
};

function parseCount(text: string): number | null {
  const t = text.trim().toLowerCase();
  const match = t.match(/([0-9]+(?:[\.,][0-9]+)?)\s*([km])?/i);
  if (!match) return null;
  let num = parseFloat(match[1].replace(",", "."));
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k") num *= 1_000;
  if (suffix === "m") num *= 1_000_000;
  return Math.round(num);
}

function extractFromMeta(html: string): {
  followers: number | null;
  name: string | null;
} {
  const metaDesc = html.match(/<meta[^>]+property=\"og:description\"[^>]+content=\"([^\"]+)\"/i);
  const metaTitle = html.match(/<meta[^>]+property=\"og:title\"[^>]+content=\"([^\"]+)\"/i);

  let followers: number | null = null;
  if (metaDesc) {
    const content = metaDesc[1];
    // Example: "689M Followers, 123 Following, 7,123 Posts - See Instagram photos and videos from Instagram (@instagram)"
    const folMatch = content.match(/([0-9][0-9\.,]*\s*[kKmM]?)\s+Followers/i);
    if (folMatch) {
      followers = parseCount(folMatch[1]);
    }
  }

  let name: string | null = null;
  if (metaTitle) {
    // Example: "Instagram (@instagram) ? Instagram photos and videos"
    const title = metaTitle[1];
    const nm = title.match(/^(.+?)\s*\(@/);
    if (nm) name = nm[1].trim();
  }

  return { followers, name };
}

async function fetchProfile(handle: string): Promise<Account> {
  const url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  try {
    const res = await fetch(url, {
      headers: {
        // Try to look like a regular browser to increase chance of 200 response
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return {
        handle,
        name: null,
        followers: null,
        averageViews: null,
        category: null,
        engagementRate: null,
        location: null,
        error: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();
    const { followers, name } = extractFromMeta(html);

    // Heuristic fallbacks
    let engagementRate: number | null = null;
    if (followers != null) {
      // Very rough heuristic: smaller accounts often have higher ER
      if (followers < 10_000) engagementRate = 0.05;
      else if (followers < 100_000) engagementRate = 0.035;
      else if (followers < 1_000_000) engagementRate = 0.02;
      else engagementRate = 0.0125;
    }

    return {
      handle,
      name: name ?? null,
      followers: followers ?? null,
      averageViews: null,
      category: null,
      engagementRate,
      location: null,
    };
  } catch (e: any) {
    return {
      handle,
      name: null,
      followers: null,
      averageViews: null,
      category: null,
      engagementRate: null,
      location: null,
      error: e?.message || "fetch error",
    };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const handles: string[] = Array.isArray(body?.handles)
    ? (body.handles as string[])
    : [];

  const uniq = Array.from(
    new Set(
      handles
        .map((h) => String(h).trim().replace(/^@/, ""))
        .filter((h) => h.length > 0)
    )
  ).slice(0, 25); // guardrail

  const results = await Promise.all(
    uniq.map((h) => fetchProfile(h))
  );

  return new Response(JSON.stringify({ accounts: results }), {
    headers: { "Content-Type": "application/json" },
  });
}
