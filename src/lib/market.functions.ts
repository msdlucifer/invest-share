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
  raw: string | null;
}

export interface QuoteRequest {
  symbol: string;
  exchange?: string | null;
}

// Yahoo Finance — free, no API key required.
const YF_QUOTE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";

// A browser-ish UA — Yahoo's public endpoints reject empty/curl UAs with 401.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

// -----------------------------------------------------------------------------
// Symbol normalization
// -----------------------------------------------------------------------------
// Map user- or legacy-stored symbols to the format Yahoo accepts.
//   RELIANCE          -> RELIANCE.NS   (default Indian equities to NSE)
//   RELIANCE.BL       -> RELIANCE.BO   (`.BL` is not a Yahoo suffix; BSE is `.BO`)
//   RELIANCE.NS/.BO   -> unchanged
//   AAPL              -> unchanged     (US)
export function normalizeIndianSymbol(symbol: string, exchange?: string | null): string {
  const s = symbol.trim().toUpperCase();
  if (!s) return s;
  if (s.endsWith(".BL")) return s.slice(0, -3) + ".BO";
  if (s.endsWith(".NS") || s.endsWith(".BO")) return s;
  const ex = (exchange ?? "").toUpperCase();
  if (ex === "NSE") return `${s}.NS`;
  if (ex === "BSE") return `${s}.BO`;
  return s;
}

function looksIndian(symbol: string, exchange?: string | null): boolean {
  const s = symbol.toUpperCase();
  const ex = (exchange ?? "").toUpperCase();
  return s.endsWith(".NS") || s.endsWith(".BO") || s.endsWith(".BL") || ex === "NSE" || ex === "BSE";
}

// -----------------------------------------------------------------------------
// Symbol search (Yahoo)
// -----------------------------------------------------------------------------
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
      const url = `${YF_SEARCH}?q=${encodeURIComponent(data.q)}&quotesCount=15&newsCount=0`;
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        quotes?: Array<{
          symbol?: string;
          shortname?: string;
          longname?: string;
          exchange?: string;
          exchDisp?: string;
          quoteType?: string;
          typeDisp?: string;
        }>;
      };
      const items = json.quotes ?? [];
      const wantEquity = data.assetType === "equity";
      const filtered = items.filter((i) => {
        const t = String(i.quoteType ?? "").toUpperCase();
        return wantEquity ? t === "EQUITY" : t === "FUTURE" || t === "COMMODITY" || t === "ETF";
      });
      const pool = filtered.length > 0 ? filtered : items;
      return pool.slice(0, 12).map((i) => {
        const sym = String(i.symbol ?? "");
        // Currency isn't in the search payload; infer from suffix.
        const currency = sym.endsWith(".NS") || sym.endsWith(".BO") ? "INR" : "";
        return {
          symbol: sym,
          name: String(i.longname ?? i.shortname ?? sym),
          exchange: String(i.exchDisp ?? i.exchange ?? ""),
          type: String(i.typeDisp ?? i.quoteType ?? ""),
          currency,
        };
      });
    } catch (e) {
      console.error("searchSymbols failed", e);
      return [];
    }
  });

// -----------------------------------------------------------------------------
// Quotes (Yahoo chart endpoint)
// -----------------------------------------------------------------------------
// Provider-per-asset-type dispatch: everything currently routes through Yahoo,
// which supports Indian equities (.NS/.BO), US equities, FX (INR=X), and
// commodity futures (GC=F, SI=F, CL=F, NG=F, HG=F).
async function fetchYahooQuote(req: QuoteRequest): Promise<Quote> {
  const normalized = looksIndian(req.symbol, req.exchange)
    ? normalizeIndianSymbol(req.symbol, req.exchange)
    : req.symbol.trim();

  const url = `${YF_QUOTE}/${encodeURIComponent(normalized)}?interval=1d&range=1d`;

  let status: number | null = null;
  let raw: string | null = null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    status = res.status;
    const text = await res.text();
    raw = text.length > 2000 ? text.slice(0, 2000) + "…" : text;

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

    let parsed: {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            currency?: string;
          };
        }> | null;
        error?: { code?: string; description?: string } | null;
      };
    } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        symbol: req.symbol,
        exchange: req.exchange ?? null,
        price: null,
        currency: null,
        error: "Invalid JSON from provider",
        status,
        raw,
      };
    }

    if (parsed?.chart?.error) {
      return {
        symbol: req.symbol,
        exchange: req.exchange ?? null,
        price: null,
        currency: null,
        error: parsed.chart.error.description ?? String(parsed.chart.error.code ?? "Provider error"),
        status,
        raw,
      };
    }

    const meta = parsed?.chart?.result?.[0]?.meta;
    const priceRaw =
      meta?.regularMarketPrice ?? meta?.chartPreviousClose ?? meta?.previousClose;
    const price = priceRaw != null ? Number(priceRaw) : NaN;
    if (!Number.isFinite(price)) {
      return {
        symbol: req.symbol,
        exchange: req.exchange ?? null,
        price: null,
        currency: meta?.currency ?? null,
        error: "No price in response",
        status,
        raw,
      };
    }

    return {
      symbol: req.symbol,
      exchange: req.exchange ?? null,
      price,
      currency: meta?.currency ?? null,
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

// Public dispatchers — one per asset category. Currently all route to Yahoo,
// but the seam is here for future providers (e.g. a paid US data feed).
export const getEquityPrice = (req: QuoteRequest) => fetchYahooQuote(req);
export const getUSStockPrice = (req: QuoteRequest) => fetchYahooQuote(req);
export const getCommodityPrice = (req: QuoteRequest) => fetchYahooQuote(req);
export const getFxPrice = (req: QuoteRequest) => fetchYahooQuote(req);

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
    // De-duplicate by `${symbol}|${exchange ?? ""}` — same key the UI uses.
    const seen = new Map<string, QuoteRequest>();
    for (const r of data.requests) {
      const key = `${r.symbol}|${r.exchange ?? ""}`;
      if (!seen.has(key)) seen.set(key, { symbol: r.symbol, exchange: r.exchange ?? null });
    }

    // Isolate every request: one failing symbol must never abort the batch.
    const settled = await Promise.allSettled(
      Array.from(seen.entries()).map(async ([key, req]) => {
        const q = await fetchYahooQuote(req);
        return [key, q] as const;
      }),
    );

    const out: Record<string, Quote> = {};
    let i = 0;
    for (const [key, req] of seen.entries()) {
      const s = settled[i++];
      if (s.status === "fulfilled") {
        out[key] = s.value[1];
      } else {
        out[key] = {
          symbol: req.symbol,
          exchange: req.exchange ?? null,
          price: null,
          currency: null,
          error: s.reason instanceof Error ? s.reason.message : "Unknown error",
          status: null,
          raw: null,
        };
      }
    }
    return out;
  });
