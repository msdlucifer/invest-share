import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuotes, type Quote, type AssetType } from "@/lib/market.functions";
import { inr, num, pct, displaySymbol, assetLabel, assetBadgeClass } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetDialog, type AssetRow } from "@/components/asset-dialog";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabKey = "all" | AssetType;

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
  const [lastSuccessfulQuotesAt, setLastSuccessfulQuotesAt] = useState<number | null>(null);

  const assetsQ = useQuery({
    queryKey: ["assets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id,asset_type,asset_name,symbol,buy_price,quantity,buy_date,current_price,unit,issuer,maturity_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetRow[];
    },
  });

  // Symbols to quote: equity + commodity that have a symbol
  const symbols = useMemo(
    () =>
      Array.from(
        new Set(
          (assetsQ.data ?? [])
            .filter((a) => (a.asset_type === "equity" || a.asset_type === "commodity") && a.symbol)
            .map((a) => a.symbol as string),
        ),
      ),
    [assetsQ.data],
  );

  const quotesQ = useQuery<Record<string, Quote>>({
    queryKey: ["quotes", symbols.join(",")],
    queryFn: async () => (symbols.length ? await quotesFn({ data: { symbols } }) : {}),
    enabled: assetsQ.isSuccess,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** (attempt - 1), 8_000),
  });

  const { hasLivePrice, quoteFailures } = useMemo(() => {
    let live = false;
    const fails: string[] = [];
    for (const sym of symbols) {
      const q = quotesQ.data?.[sym];
      if (!q) {
        if (quotesQ.isSuccess) fails.push(displaySymbol(sym));
        continue;
      }
      if (q.price != null) live = true;
      else if (q.error != null) fails.push(displaySymbol(sym));
    }
    return { hasLivePrice: live, quoteFailures: fails };
  }, [symbols, quotesQ.data, quotesQ.isSuccess]);
  const hasQuoteFailures = quoteFailures.length > 0;

  useEffect(() => {
    if (!quotesQ.data || quotesQ.dataUpdatedAt <= 0 || !hasLivePrice) return;
    setLastSuccessfulQuotesAt(quotesQ.dataUpdatedAt);
  }, [quotesQ.data, quotesQ.dataUpdatedAt, hasLivePrice]);

  // Resolve live price for an asset (or fallback to manual current_price)
  const livePriceFor = (a: AssetRow): number | null => {
    if (a.asset_type === "bond") return a.current_price ?? null;
    if (a.symbol) {
      const live = quotesQ.data?.[a.symbol]?.price;
      if (live != null) return live;
    }
    return a.current_price ?? null;
  };

  const enriched = useMemo(
    () =>
      (assetsQ.data ?? []).map((a) => {
        const live = livePriceFor(a);
        const invested = a.buy_price * a.quantity;
        const current = live != null ? live * a.quantity : null;
        const pnl = current != null ? current - invested : null;
        const ret = current != null && invested > 0 ? (pnl! / invested) * 100 : null;
        return { a, live, invested, current, pnl, ret };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assetsQ.data, quotesQ.data],
  );

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

  // Allocation totals across ALL assets (not filtered)
  const allocation = useMemo(() => {
    const byType: Record<AssetType, { invested: number; current: number; hasAll: boolean }> = {
      equity: { invested: 0, current: 0, hasAll: true },
      bond: { invested: 0, current: 0, hasAll: true },
      commodity: { invested: 0, current: 0, hasAll: true },
    };
    let totalInvested = 0;
    let totalCurrent = 0;
    let totalHasAll = enriched.length > 0;

    for (const r of enriched) {
      const t = r.a.asset_type;
      byType[t].invested += r.invested;
      totalInvested += r.invested;
      if (r.current != null) {
        byType[t].current += r.current;
        totalCurrent += r.current;
      } else {
        byType[t].hasAll = false;
        totalHasAll = false;
      }
    }
    const totalPnl = totalHasAll ? totalCurrent - totalInvested : null;
    const totalRet = totalHasAll && totalInvested > 0 ? (totalPnl! / totalInvested) * 100 : null;
    const pctOf = (v: number) => (totalCurrent > 0 ? (v / totalCurrent) * 100 : null);

    return {
      totalInvested,
      totalCurrent: totalHasAll ? totalCurrent : null,
      totalPnl,
      totalRet,
      equity: { ...byType.equity, pct: byType.equity.hasAll ? pctOf(byType.equity.current) : null },
      bond: { ...byType.bond, pct: byType.bond.hasAll ? pctOf(byType.bond.current) : null },
      commodity: {
        ...byType.commodity,
        pct: byType.commodity.hasAll ? pctOf(byType.commodity.current) : null,
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

  const refresh = () => qc.invalidateQueries({ queryKey: ["quotes", symbols.join(",")] });
  const quoteStatus = quotesQ.isError
    ? "Disconnected"
    : hasQuoteFailures
      ? "Degraded"
      : symbols.length > 0
        ? "Connected"
        : "Idle";

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, equity: 0, bond: 0, commodity: 0 };
    for (const a of assetsQ.data ?? []) {
      c.all++;
      c[a.asset_type]++;
    }
    return c;
  }, [assetsQ.data]);

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
            Refresh prices
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
          value={inr(allocation.totalCurrent)}
          tone={allocation.totalPnl == null ? "default" : allocation.totalPnl >= 0 ? "profit" : "loss"}
        />
        <AllocationCard label="Equity" value={allocation.equity.current} pct={allocation.equity.pct} hasAny={counts.equity > 0} />
        <AllocationCard label="Bonds" value={allocation.bond.current} pct={allocation.bond.pct} hasAny={counts.bond > 0} />
        <AllocationCard label="Commodities" value={allocation.commodity.current} pct={allocation.commodity.pct} hasAny={counts.commodity > 0} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Invested" value={inr(allocation.totalInvested)} />
        <StatCard label="Current Value" value={inr(allocation.totalCurrent)} />
        <StatCard
          label="Profit / Loss"
          value={inr(allocation.totalPnl)}
          tone={allocation.totalPnl == null ? "default" : allocation.totalPnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Return"
          value={pct(allocation.totalRet)}
          tone={allocation.totalRet == null ? "default" : allocation.totalRet >= 0 ? "profit" : "loss"}
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
            status {quoteStatus}
            {lastSuccessfulQuotesAt && (
              <> · last update {new Date(lastSuccessfulQuotesAt).toLocaleTimeString()}</>
            )}
          </div>
        </div>

        {(quotesQ.isError || hasQuoteFailures) && (
          <div className="mx-3 mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {quotesQ.isError ? (
              <span>
                Live prices are temporarily unavailable. Retrying automatically.{" "}
                <button className="underline underline-offset-2" onClick={refresh} type="button">
                  Retry now
                </button>
              </span>
            ) : (
              <span>
                Couldn't refresh live prices for {quoteFailures.length} symbol
                {quoteFailures.length === 1 ? "" : "s"} ({quoteFailures.slice(0, 5).join(", ")}
                {quoteFailures.length > 5 ? ", …" : ""}). Showing manual / fallback values where set.
              </span>
            )}
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
                  <th className="text-right font-medium px-3 py-2.5">Current</th>
                  <th className="text-right font-medium px-3 py-2.5">Invested</th>
                  <th className="text-right font-medium px-3 py-2.5">Value</th>
                  <th className="text-right font-medium px-3 py-2.5">P&L</th>
                  <th className="text-right font-medium px-3 py-2.5">Return</th>
                  {!readOnly && <th className="px-3 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, live, invested, current, pnl, ret }) => (
                  <tr key={a.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.asset_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.symbol ? `${displaySymbol(a.symbol)} · ` : ""}
                        {a.asset_type === "bond" && a.maturity_date
                          ? `matures ${a.maturity_date}`
                          : a.buy_date}
                        {a.unit ? ` · per ${a.unit}` : ""}
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
                      {live != null ? (
                        inr(live)
                      ) : quotesQ.isFetching && a.asset_type !== "bond" ? (
                        <span className="text-muted-foreground">Updating…</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Unavailable</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(invested)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(current)}</td>
                    <td className={cn("px-3 py-3 text-right tabular-nums font-medium", pnl == null ? "" : pnl >= 0 ? "text-profit" : "text-loss")}>
                      {inr(pnl)}
                    </td>
                    <td className={cn("px-3 py-3 text-right tabular-nums font-medium", ret == null ? "" : ret >= 0 ? "text-profit" : "text-loss")}>
                      {pct(ret)}
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
                ))}
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
    </div>
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
