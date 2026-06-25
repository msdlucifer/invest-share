import type { AssetType } from "@/lib/market.functions";

export const inr = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
};

export const num = (n: number | null | undefined, d = 2) => {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: d }).format(n);
};

export const pct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

export const displaySymbol = (symbol: string | null | undefined) => {
  if (!symbol) return "";
  if (symbol.endsWith(".NS")) return symbol.replace(".NS", " · NSE");
  if (symbol.endsWith(".BO")) return symbol.replace(".BO", " · BSE");
  return symbol;
};

export const assetLabel = (t: AssetType): string =>
  t === "equity" ? "Equity" : t === "bond" ? "Bond" : "Commodity";

export const assetBadgeClass = (t: AssetType): string =>
  t === "equity"
    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
    : t === "bond"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
