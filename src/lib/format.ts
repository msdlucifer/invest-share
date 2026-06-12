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

export const displaySymbol = (symbol: string) => {
  // Yahoo: RELIANCE.NS -> RELIANCE (NSE); .BO -> BSE
  if (symbol.endsWith(".NS")) return symbol.replace(".NS", " · NSE");
  if (symbol.endsWith(".BO")) return symbol.replace(".BO", " · BSE");
  return symbol;
};
