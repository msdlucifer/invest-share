import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AssetType = "equity" | "bond" | "commodity";

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
}

export interface Quote {
  symbol: string;
  exchange: string | null;
  price: number | null;
  currency: string | null;
  // Diagnostics surfaced to the UI when a quote can't be fetched
  error: string | null;
  status: number | null;
  raw: unknown;
}

export interface QuoteRequest {
  symbol: string;
  exchange?: string | null;
}

const TD_BASE = "https://api.twelvedata.com";

function apiKey(): string {
  const k = process.env.TWELVE_DATA_API_KEY;
  if (!k) throw new Error("TWELVE_DATA_API_KEY not configured");
  return k;
}

// ---------- Symbol search ----------
export const searchSymbols = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().min(1).max(40),
        assetType: z.enum(["equity", "commodity"]).default("equity"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<SymbolSearchResult[]> => {
    try {
      const url = `${TD_BASE}/symbol_search?symbol=${encodeURIComponent(data.q)}&apikey=${apiKey()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
      const items = json.data ?? [];
      const filtered =
        data.assetType === "commodity"
          ? items.filter((i) => {
              const t = String(i.instrument_type ?? "").toLowerCase();
              return t.includes("commodity") || t.includes("etf") || t.includes("forex");
            })
          : items.filter((i) => {
              const t = String(i.instrument_type ?? "").toLowerCase();
              return t.includes("stock") || t.includes("equity") || t === "common stock";
            });
      const pool = filtered.length > 0 ? filtered : items;
      return pool.slice(0, 12).map((i) => ({
        symbol: String(i.symbol ?? ""),
        name: String(i.instrument_name ?? i.symbol ?? ""),
        exchange: String(i.exchange ?? ""),
        type: String(i.instrument_type ?? ""),
        currency: String(i.currency ?? ""),
      }));
    } catch (e) {
      console.error("searchSymbols failed", e);
      return [];
    }
  });

// ---------- Quotes ----------
async function fetchOne(req: QuoteRequest): Promise<Quote> {
  const params = new URLSearchParams({ symbol: req.symbol, apikey: apiKey() });
  if (req.exchange) params.set("exchange", req.exchange);
  const url = `${TD_BASE}/quote?${params.toString()}`;

  let status: number | null = null;
  let raw: unknown = null;
  try {
    const res = await fetch(url);
    status = res.status;
    const text = await res.text();
    try {
      raw = JSON.parse(text);
    } catch {
      raw = text;
    }
    if (!res.ok) {
      return {
        symbol: req.symbol,
        exchange: req.exchange ?? null,
        price: null,
        currency: null,
        error: `HTTP ${res.status}`,
        status,
        raw,
      };
    }
    const j = raw as Record<string, unknown>;
    // Twelve Data error shape: { code, message, status: "error" }
    if (j && (j.status === "error" || j.code)) {
      return {
        symbol: req.symbol,
        exchange: req.exchange ?? null,
        price: null,
        currency: null,
        error: String(j.message ?? "API error"),
        status,
        raw,
      };
    }
    const priceStr = (j.close ?? j.price) as string | number | undefined;
    const price = priceStr != null ? Number(priceStr) : NaN;
    if (!Number.isFinite(price)) {
      return {
        symbol: req.symbol,
        exchange: req.exchange ?? null,
        price: null,
        currency: (j.currency as string) ?? null,
        error: "No price in response",
        status,
        raw,
      };
    }
    return {
      symbol: req.symbol,
      exchange: req.exchange ?? null,
      price,
      currency: (j.currency as string) ?? null,
      error: null,
      status,
      raw,
    };
  } catch (e) {
    return {
      symbol: req.symbol,
      exchange: req.exchange ?? null,
      price: null,
      currency: null,
      error: e instanceof Error ? e.message : "Network error",
      status,
      raw,
    };
  }
}

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        requests: z
          .array(
            z.object({
              symbol: z.string().min(1),
              exchange: z.string().nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Record<string, Quote>> => {
    // De-duplicate by `${symbol}|${exchange ?? ""}`
    const seen = new Map<string, QuoteRequest>();
    for (const r of data.requests) {
      const key = `${r.symbol}|${r.exchange ?? ""}`;
      if (!seen.has(key)) seen.set(key, { symbol: r.symbol, exchange: r.exchange ?? null });
    }
    const entries = await Promise.all(
      Array.from(seen.entries()).map(async ([key, req]) => [key, await fetchOne(req)] as const),
    );
    return Object.fromEntries(entries);
  });
