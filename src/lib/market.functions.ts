import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AssetType = "equity" | "bond" | "commodity";

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency?: string;
}

export interface Quote {
  symbol: string;
  price: number | null;
  currency: string | null;
  error: string | null;
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
      return pool.slice(0, 10).map((i) => ({
        symbol: String(i.symbol ?? ""),
        name: String(i.instrument_name ?? i.symbol ?? ""),
        exchange: String(i.exchange ?? ""),
        type: String(i.instrument_type ?? ""),
        currency: i.currency ? String(i.currency) : undefined,
      }));
    } catch (e) {
      console.error("searchSymbols failed", e);
      return [];
    }
  });

// ---------- Quotes ----------
async function fetchPrices(symbols: string[]): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  if (symbols.length === 0) return out;
  try {
    const url = `${TD_BASE}/price?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Twelve Data ${res.status}`);
    const json = (await res.json()) as Record<string, unknown> | { price: string };

    // Single symbol response: { price: "123.45" } | error shape
    if (symbols.length === 1) {
      const sym = symbols[0];
      const j = json as Record<string, unknown>;
      const priceStr = j.price as string | undefined;
      out[sym] = {
        symbol: sym,
        price: priceStr ? Number(priceStr) : null,
        currency: null,
        error: priceStr ? null : String(j.message ?? "No price"),
      };
      return out;
    }

    // Multi-symbol response: { "SYM": { price: "..." } } or { "SYM": { code: 404, message: "..." } }
    const obj = json as Record<string, { price?: string; code?: number; message?: string }>;
    for (const sym of symbols) {
      const entry = obj[sym];
      if (entry && entry.price) {
        out[sym] = { symbol: sym, price: Number(entry.price), currency: null, error: null };
      } else {
        out[sym] = {
          symbol: sym,
          price: null,
          currency: null,
          error: entry?.message ?? "No price",
        };
      }
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Quote fetch failed";
    for (const sym of symbols) {
      out[sym] = { symbol: sym, price: null, currency: null, error: msg };
    }
    return out;
  }
}

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        symbols: z.array(z.string().min(1)).min(1).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Record<string, Quote>> => {
    const unique = Array.from(new Set(data.symbols));
    return fetchPrices(unique);
  });
