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
    const out: Record<string, Quote> = {};
    await Promise.all(
      unique.map(async (sym) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
          const res = await fetch(url, { headers: YAHOO_HEADERS });
          if (!res.ok) {
            out[sym] = { symbol: sym, price: null, currency: null, name: null };
            return;
          }
          const json = (await res.json()) as {
            chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
          };
          const meta = json.chart?.result?.[0]?.meta;
          if (!meta) {
            out[sym] = { symbol: sym, price: null, currency: null, name: null };
            return;
          }
          out[sym] = {
            symbol: sym,
            price: typeof meta.regularMarketPrice === "number" ? (meta.regularMarketPrice as number) : null,
            currency: (meta.currency as string) ?? null,
            name: (meta.longName as string) ?? (meta.shortName as string) ?? null,
          };
        } catch (e) {
          console.error("getQuotes failed for", sym, e);
          out[sym] = { symbol: sym, price: null, currency: null, name: null };
        }
      }),
    );
    return out;
  });
