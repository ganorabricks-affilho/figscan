import "server-only";
import { createHmac } from "crypto";
import type { MinifigRecord } from "@/lib/catalog/types";

type BrickLinkItem = {
  no: string;
  name: string;
  type: string;
  year_released?: number;
};

/**
 * Optional BrickLink Catalog API enrichment.
 * Uses OAuth 1.0a consumer/token credentials when BRICKLINK_* env vars are set.
 * Never scrapes — official API only.
 */
export function hasBrickLinkCredentials(): boolean {
  return Boolean(
    process.env.BRICKLINK_CONSUMER_KEY &&
      process.env.BRICKLINK_CONSUMER_SECRET &&
      process.env.BRICKLINK_TOKEN_VALUE &&
      process.env.BRICKLINK_TOKEN_SECRET,
  );
}

export async function enrichFromBrickLink(
  figs: MinifigRecord[],
): Promise<{ figs: MinifigRecord[]; enriched: boolean }> {
  if (!hasBrickLinkCredentials()) {
    return { figs, enriched: false };
  }

  const enriched: MinifigRecord[] = [];
  for (const fig of figs) {
    try {
      const item = await brickLinkGet<BrickLinkItem>(
        `/items/MINIFIG/${encodeURIComponent(fig.id)}`,
      );
      const price = await fetchAvgPrice(fig.id);
      enriched.push({
        ...fig,
        name: item.name || fig.name,
        year: item.year_released ?? fig.year,
        priceUsd: price ?? fig.priceUsd,
        bricklinkUrl: `https://www.bricklink.com/v2/catalog/catalogitem.page?M=${fig.id}`,
      });
    } catch (error) {
      console.warn(`BrickLink enrich failed for ${fig.id}:`, error);
      enriched.push(fig);
    }
  }

  return { figs: enriched, enriched: true };
}

async function fetchAvgPrice(id: string): Promise<number | null> {
  try {
    const guide = await brickLinkGet<{
      avg_price?: string;
      qty_avg_price?: string;
    }>(
      `/items/MINIFIG/${encodeURIComponent(id)}/price?guide_type=stock&new_or_used=U&currency_code=USD`,
    );
    const raw = guide.qty_avg_price ?? guide.avg_price;
    if (!raw) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function brickLinkGet<T>(path: string): Promise<T> {
  const base = "https://api.bricklink.com/api/store/v1";
  const url = new URL(base + path);
  const auth = buildOAuthHeader("GET", url.toString());

  const res = await fetch(url, {
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`BrickLink ${path} → ${res.status}`);
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

function buildOAuthHeader(method: string, url: string): string {
  const consumerKey = process.env.BRICKLINK_CONSUMER_KEY!;
  const consumerSecret = process.env.BRICKLINK_CONSUMER_SECRET!;
  const token = process.env.BRICKLINK_TOKEN_VALUE!;
  const tokenSecret = process.env.BRICKLINK_TOKEN_SECRET!;

  const oauth: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: `${Date.now()}${Math.random().toString(36).slice(2)}`,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const parsed = new URL(url);
  const params: Record<string, string> = { ...oauth };
  parsed.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    enc(`${parsed.origin}${parsed.pathname}`),
    enc(paramString),
  ].join("&");

  const signingKey = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");
  oauth.oauth_signature = signature;

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${enc(k)}="${enc(oauth[k])}"`)
      .join(", ")
  );
}

function enc(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
