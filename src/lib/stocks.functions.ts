import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  Accept: "application/json",
};

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export const searchStocks = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }): Promise<StockSearchResult[]> => {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      data.q,
    )}&quotesCount=10&newsCount=0`;
    try {
      const res = await fetch(url, { headers: YAHOO_HEADERS });
      if (!res.ok) return [];
      const json = (await res.json()) as { quotes?: Array<Record<string, unknown>> };
      const quotes = json.quotes ?? [];
      return quotes
        .filter((q) => {
          const ex = String(q.exchange ?? "");
          // Prefer Indian exchanges, but include others
          return q.symbol && (q.shortname || q.longname) && ex !== "PNK";
        })
        .map((q) => ({
          symbol: String(q.symbol),
          name: String(q.longname ?? q.shortname ?? q.symbol),
          exchange: String(q.exchange ?? ""),
        }))
        .slice(0, 8);
    } catch (e) {
      console.error("searchStocks failed", e);
      return [];
    }
  });

export interface Quote {
  symbol: string;
  price: number | null;
  currency: string | null;
  name: string | null;
}

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ symbols: z.array(z.string().min(1)).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }): Promise<Record<string, Quote>> => {
    const unique = Array.from(new Set(data.symbols));
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      unique.join(","),
    )}`;
    const out: Record<string, Quote> = {};
    try {
      const res = await fetch(url, { headers: YAHOO_HEADERS });
      if (!res.ok) {
        for (const s of unique) out[s] = { symbol: s, price: null, currency: null, name: null };
        return out;
      }
      const json = (await res.json()) as {
        quoteResponse?: { result?: Array<Record<string, unknown>> };
      };
      const results = json.quoteResponse?.result ?? [];
      for (const r of results) {
        const sym = String(r.symbol);
        out[sym] = {
          symbol: sym,
          price:
            typeof r.regularMarketPrice === "number"
              ? (r.regularMarketPrice as number)
              : null,
          currency: (r.currency as string) ?? null,
          name: (r.longName as string) ?? (r.shortName as string) ?? null,
        };
      }
      for (const s of unique) {
        if (!out[s]) out[s] = { symbol: s, price: null, currency: null, name: null };
      }
      return out;
    } catch (e) {
      console.error("getQuotes failed", e);
      for (const s of unique) out[s] = { symbol: s, price: null, currency: null, name: null };
      return out;
    }
  });
