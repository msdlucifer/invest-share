import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuotes, type Quote, type AssetType } from "@/lib/market.functions";
import { findCommodityPreset, FX_USD_INR_SYMBOL } from "@/lib/commodities";
import { inr, num, pct, assetLabel, assetBadgeClass } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AssetDialog, type AssetRow } from "@/components/asset-dialog";
import { AlertCircle, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabKey = "all" | AssetType;

type QuoteKey = string; // `${symbol}|${exchange ?? ""}`
const qkey = (s: string, e?: string | null): QuoteKey => `${s}|${e ?? ""}`;

export function PortfolioView({
  userId,
  readOnly = false,
  title,
  subtitle,
}: {
  userId: string;
  readOnly?: boolean;
  title: string;
  subtitle?: string;
}) {
  const qc = useQueryClient();
  const quotesFn = useServerFn(getQuotes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | undefined>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<Quote | null>(null);

  const assetsQ = useQuery({
    queryKey: ["assets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id,asset_type,asset_name,symbol,exchange,currency,buy_price,quantity,buy_date,current_price,unit,issuer,maturity_date",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetRow[];
    },
  });

  // Build quote requests: equities (symbol+exchange), commodities (apiSymbol),
  // plus USD/INR if any commodity needs FX conversion.
  const quoteRequests = useMemo(() => {
    const reqs: { symbol: string; exchange: string | null }[] = [];
    const seen = new Set<string>();
    let needsFx = false;
    for (const a of assetsQ.data ?? []) {
      if (a.asset_type === "equity" && a.symbol) {
        const k = qkey(a.symbol, a.exchange);
        if (!seen.has(k)) {
          seen.add(k);
          reqs.push({ symbol: a.symbol, exchange: a.exchange ?? null });
        }
      } else if (a.asset_type === "commodity" && a.symbol) {
        const preset = findCommodityPreset(a.symbol);
        const apiSymbol = preset?.apiSymbol ?? a.symbol;
        const k = qkey(apiSymbol, null);
        if (!seen.has(k)) {
          seen.add(k);
          reqs.push({ symbol: apiSymbol, exchange: null });
        }
        if (preset && preset.apiCurrency !== preset.displayCurrency) needsFx = true;
      }
    }
    if (needsFx) {
      const k = qkey(FX_USD_INR_SYMBOL, null);
      if (!seen.has(k)) reqs.push({ symbol: FX_USD_INR_SYMBOL, exchange: null });
    }
    return reqs;
  }, [assetsQ.data]);

  const quotesQ = useQuery<Record<string, Quote>>({
    queryKey: ["quotes", quoteRequests.map((r) => qkey(r.symbol, r.exchange)).join(",")],
    queryFn: async () =>
      quoteRequests.length ? await quotesFn({ data: { requests: quoteRequests } }) : {},
    enabled: assetsQ.isSuccess && quoteRequests.length > 0,
    refetchInterval: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (quotesQ.data && quotesQ.dataUpdatedAt > 0) setLastUpdated(quotesQ.dataUpdatedAt);
  }, [quotesQ.data, quotesQ.dataUpdatedAt]);

  const usdInr = quotesQ.data?.[qkey(FX_USD_INR_SYMBOL, null)]?.price ?? null;

  type Enriched = {
    a: AssetRow;
    cmp: number | null; // in display currency, per display unit
    cmpUnit: string | null;
    invested: number;
    current: number | null;
    pnl: number | null;
    ret: number | null;
    quote: Quote | null;
  };

  const enriched: Enriched[] = useMemo(() => {
    return (assetsQ.data ?? []).map((a) => {
      let cmp: number | null = null;
      let cmpUnit: string | null = null;
      let quote: Quote | null = null;

      if (a.asset_type === "bond") {
        cmp = a.current_price ?? null;
      } else if (a.asset_type === "equity" && a.symbol) {
        quote = quotesQ.data?.[qkey(a.symbol, a.exchange)] ?? null;
        cmp = quote?.price ?? a.current_price ?? null;
      } else if (a.asset_type === "commodity" && a.symbol) {
        const preset = findCommodityPreset(a.symbol);
        const apiSymbol = preset?.apiSymbol ?? a.symbol;
        quote = quotesQ.data?.[qkey(apiSymbol, null)] ?? null;
        cmpUnit = a.unit ?? preset?.displayUnit ?? null;
        if (quote?.price != null && preset) {
          let price = quote.price * preset.unitFactor;
          if (preset.apiCurrency !== preset.displayCurrency) {
            if (usdInr != null) price = price * usdInr;
            else price = NaN; // FX missing
          }
          cmp = Number.isFinite(price) ? price : null;
        } else {
          cmp = a.current_price ?? null;
        }
      }

      const invested = a.buy_price * a.quantity;
      const current = cmp != null ? cmp * a.quantity : null;
      const pnl = current != null ? current - invested : null;
      const ret = current != null && invested > 0 ? (pnl! / invested) * 100 : null;
      return { a, cmp, cmpUnit, invested, current, pnl, ret, quote };
    });
  }, [assetsQ.data, quotesQ.data, usdInr]);

  const rows = useMemo(() => {
    const filter = query.trim().toLowerCase();
    return enriched.filter(({ a }) => {
      if (tab !== "all" && a.asset_type !== tab) return false;
      if (!filter) return true;
      return (
        a.asset_name.toLowerCase().includes(filter) ||
        (a.symbol ?? "").toLowerCase().includes(filter) ||
        (a.issuer ?? "").toLowerCase().includes(filter)
      );
    });
  }, [enriched, query, tab]);

  // Allocation totals across ALL assets (not filtered).
  // Partial-failure friendly: for a row whose live CMP failed, fall back to
  // its invested amount so totals stay meaningful. This mirrors what the UI
  // already shows per-row (Invested is always visible) and keeps the summary
  // cards populated even if one symbol errors out.
  const allocation = useMemo(() => {
    const byType: Record<AssetType, { invested: number; current: number; any: boolean; allLive: boolean }> = {
      equity: { invested: 0, current: 0, any: false, allLive: true },
      bond: { invested: 0, current: 0, any: false, allLive: true },
      commodity: { invested: 0, current: 0, any: false, allLive: true },
    };
    let totalInvested = 0;
    let totalCurrent = 0;
    let anyRow = false;
    let allLive = enriched.length > 0;

    for (const r of enriched) {
      const t = r.a.asset_type;
      byType[t].any = true;
      byType[t].invested += r.invested;
      totalInvested += r.invested;
      anyRow = true;
      if (r.current != null) {
        byType[t].current += r.current;
        totalCurrent += r.current;
      } else {
        // Fallback: use invested amount so partial failure never blanks totals.
        byType[t].current += r.invested;
        totalCurrent += r.invested;
        byType[t].allLive = false;
        allLive = false;
      }
    }

    const totalCurrentSafe = anyRow ? totalCurrent : null;
    const totalPnl = anyRow ? totalCurrent - totalInvested : null;
    const totalRet =
      anyRow && totalInvested > 0 && allLive ? (totalPnl! / totalInvested) * 100 : null;
    const pctOf = (v: number) => (totalCurrent > 0 ? (v / totalCurrent) * 100 : null);

    return {
      totalInvested,
      totalCurrent: totalCurrentSafe,
      totalPnl,
      totalRet,
      equity: { ...byType.equity, pct: byType.equity.any ? pctOf(byType.equity.current) : null },
      bond: { ...byType.bond, pct: byType.bond.any ? pctOf(byType.bond.current) : null },
      commodity: {
        ...byType.commodity,
        pct: byType.commodity.any ? pctOf(byType.commodity.current) : null,
      },
    };
  }, [enriched]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["assets", userId] });
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["quotes"] });

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, equity: 0, bond: 0, commodity: 0 };
    for (const a of assetsQ.data ?? []) {
      c.all++;
      c[a.asset_type]++;
    }
    return c;
  }, [assetsQ.data]);

  const failedQuotes = useMemo(
    () => enriched.filter((r) => r.quote && r.quote.error != null).map((r) => r.quote!),
    [enriched],
  );

  // Totals: monetary tone for current value & P&L
  const totalTone = totalCurrentTone(allocation.totalCurrent, allocation.totalInvested);
  const pnlTone = totalCurrentTone(allocation.totalCurrent, allocation.totalInvested);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={quotesQ.isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", quotesQ.isFetching && "animate-spin")} />
            Refresh C.M.P
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add asset
            </Button>
          )}
        </div>
      </div>

      {/* Allocation cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Portfolio Value"
          value={
            <CurrencyWithDelta
              value={allocation.totalCurrent}
              invested={allocation.totalInvested}
              showPct
            />
          }
          tone={totalTone}
        />
        <AllocationCard label="Equity" value={allocation.equity.current} pct={allocation.equity.pct} hasAny={counts.equity > 0} />
        <AllocationCard label="Bonds" value={allocation.bond.current} pct={allocation.bond.pct} hasAny={counts.bond > 0} />
        <AllocationCard label="Commodities" value={allocation.commodity.current} pct={allocation.commodity.pct} hasAny={counts.commodity > 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Invested" value={inr(allocation.totalInvested)} />
        <StatCard
          label="Current Value"
          value={<CurrencyWithDelta value={allocation.totalCurrent} invested={allocation.totalInvested} showPct />}
          tone={totalTone}
        />
        <StatCard
          label="Profit / Loss"
          value={
            <span>
              {pnlPrimary(allocation.totalPnl)}
              {allocation.totalRet != null && (
                <span className="ml-1.5 text-sm font-normal opacity-80">
                  ({pct(allocation.totalRet)})
                </span>
              )}
            </span>
          }
          tone={pnlTone}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-3 border-b flex items-center gap-2 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="equity">Equity ({counts.equity})</TabsTrigger>
              <TabsTrigger value="bond">Bonds ({counts.bond})</TabsTrigger>
              <TabsTrigger value="commodity">Commodities ({counts.commodity})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-xs">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search assets…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {quotesQ.isFetching ? "Refreshing…" : "C.M.P"}
            {lastUpdated && <> · updated {new Date(lastUpdated).toLocaleTimeString()}</>}
          </div>
        </div>

        {failedQuotes.length > 0 && (
          <div className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Couldn't fetch C.M.P for {failedQuotes.length} symbol{failedQuotes.length === 1 ? "" : "s"}.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => setErrorDetail(failedQuotes[0])}
            >
              View error details
            </button>
          </div>
        )}

        {assetsQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-muted-foreground text-sm">
              {counts.all === 0 ? "No assets yet." : "No assets match this filter."}
            </div>
            {!readOnly && counts.all === 0 && (
              <Button className="mt-4" size="sm" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add your first asset
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Asset</th>
                  <th className="text-left font-medium px-3 py-2.5">Type</th>
                  <th className="text-right font-medium px-3 py-2.5">Qty</th>
                  <th className="text-right font-medium px-3 py-2.5">Buy</th>
                  <th className="text-right font-medium px-3 py-2.5">C.M.P</th>
                  <th className="text-right font-medium px-3 py-2.5">Invested</th>
                  <th className="text-right font-medium px-3 py-2.5">Current Value</th>
                  <th className="text-right font-medium px-3 py-2.5">P&amp;L</th>
                  {!readOnly && <th className="px-3 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, cmp, cmpUnit, invested, current, pnl, ret, quote }) => {
                  const cvTone = totalCurrentTone(current, invested);
                  return (
                    <tr key={a.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{a.asset_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.symbol ? `${a.symbol}${a.exchange ? ` · ${a.exchange}` : ""} · ` : ""}
                          {a.asset_type === "bond" && a.maturity_date
                            ? `matures ${a.maturity_date}`
                            : a.buy_date}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", assetBadgeClass(a.asset_type))}>
                          {assetLabel(a.asset_type)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{num(a.quantity, 4)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(a.buy_price)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {cmp != null ? (
                          <span>
                            {inr(cmp)}
                            {cmpUnit && <span className="text-xs text-muted-foreground"> / {cmpUnit}</span>}
                          </span>
                        ) : a.asset_type !== "bond" && quotesQ.isFetching ? (
                          <span className="text-muted-foreground">Updating…</span>
                        ) : quote?.error ? (
                          <button
                            type="button"
                            className="text-amber-700 dark:text-amber-300 underline underline-offset-2"
                            onClick={() => setErrorDetail(quote)}
                          >
                            <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                            Error
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{inr(invested)}</td>
                      <td className={cn("px-3 py-3 text-right tabular-nums font-medium", toneClass(cvTone))}>
                        {current != null ? (
                          <span>
                            {inr(current)}
                            {ret != null && (
                              <span className="ml-1 text-xs opacity-90">({pct(ret)})</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums font-medium", toneClass(cvTone))}>
                        {pnl != null ? (
                          <span>
                            {pnlPrimary(pnl)}
                            {ret != null && (
                              <span className="ml-1 text-xs opacity-90">({pct(ret)})</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(a.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!readOnly && (
        <AssetDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={userId}
          existing={editing}
          defaultType={tab === "all" ? "equity" : (tab as AssetType)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["assets", userId] })}
        />
      )}

      <Dialog open={errorDetail != null} onOpenChange={(v) => !v && setErrorDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>C.M.P fetch failed</DialogTitle>
            <DialogDescription>
              Diagnostic details from the market data provider.
            </DialogDescription>
          </DialogHeader>
          {errorDetail && (
            <div className="space-y-2 text-sm">
              <Row k="Requested symbol" v={errorDetail.symbol} />
              {errorDetail.exchange && <Row k="Exchange" v={errorDetail.exchange} />}
              <Row k="HTTP status" v={errorDetail.status != null ? String(errorDetail.status) : "—"} />
              <Row k="API error" v={errorDetail.error ?? "—"} />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Raw response
                </div>
                <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-60">
                  {errorDetail.raw ?? "(empty)"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{k}</span>
      <span className="font-medium break-all">{v}</span>
    </div>
  );
}

type Tone = "default" | "profit" | "loss";
function totalCurrentTone(current: number | null, invested: number): Tone {
  if (current == null) return "default";
  if (current > invested) return "profit";
  if (current < invested) return "loss";
  return "default";
}
function toneClass(t: Tone) {
  return t === "profit" ? "text-profit" : t === "loss" ? "text-loss" : "";
}
function pnlPrimary(n: number | null) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${inr(Math.abs(n))}`;
}

function CurrencyWithDelta({
  value,
  invested,
  showPct,
}: {
  value: number | null;
  invested: number;
  showPct?: boolean;
}) {
  if (value == null) return <span>—</span>;
  const diff = value - invested;
  const ret = invested > 0 ? (diff / invested) * 100 : null;
  return (
    <span>
      {inr(value)}
      {showPct && ret != null && (
        <span className="ml-1.5 text-sm font-normal opacity-80">({pct(ret)})</span>
      )}
    </span>
  );
}

function AllocationCard({
  label,
  value,
  pct: pctVal,
  hasAny,
}: {
  label: string;
  value: number | null;
  pct: number | null;
  hasAny: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{hasAny ? inr(value) : "—"}</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {hasAny && pctVal != null ? `${pctVal.toFixed(1)}% of portfolio` : hasAny ? "—" : "No holdings"}
      </div>
    </div>
  );
}
