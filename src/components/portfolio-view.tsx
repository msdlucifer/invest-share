import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getQuotes, type Quote } from "@/lib/stocks.functions";
import { inr, num, pct, displaySymbol } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoldingDialog, type HoldingRow } from "@/components/holding-dialog";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [editing, setEditing] = useState<HoldingRow | undefined>();
  const [query, setQuery] = useState("");
  const [lastSuccessfulQuotesAt, setLastSuccessfulQuotesAt] = useState<number | null>(null);

  const holdingsQ = useQuery({
    queryKey: ["holdings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("id,stock_symbol,stock_name,buy_price,quantity,buy_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HoldingRow[];
    },
  });

  const symbols = useMemo(
    () => Array.from(new Set((holdingsQ.data ?? []).map((h) => h.stock_symbol))),
    [holdingsQ.data],
  );

  const quotesQ = useQuery<Record<string, Quote>>({
    queryKey: ["quotes", userId, symbols.join(",")],
    queryFn: async () => (symbols.length ? await quotesFn({ data: { symbols } }) : {}),
    enabled: holdingsQ.isSuccess,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** (attempt - 1), 8_000),
  });

  const { hasLivePrice, quoteFailures } = useMemo(() => {
    let hasLivePrice = false;
    const quoteFailures: string[] = [];

    for (const sym of symbols) {
      const q = quotesQ.data?.[sym];
      if (!q) {
        if (quotesQ.isSuccess) quoteFailures.push(displaySymbol(sym));
        continue;
      }
      if (q.price != null) hasLivePrice = true;
      else if (q.error != null) quoteFailures.push(displaySymbol(sym));
    }

    return { hasLivePrice, quoteFailures };
  }, [symbols, quotesQ.data, quotesQ.isSuccess]);
  const hasQuoteFailures = quoteFailures.length > 0;

  useEffect(() => {
    if (!quotesQ.data || quotesQ.dataUpdatedAt <= 0 || !hasLivePrice) return;
    setLastSuccessfulQuotesAt(quotesQ.dataUpdatedAt);
  }, [quotesQ.data, quotesQ.dataUpdatedAt, hasLivePrice]);

  const rows = useMemo(() => {
    const filter = query.trim().toLowerCase();
    return (holdingsQ.data ?? [])
      .filter((h) =>
        !filter
          ? true
          : h.stock_name.toLowerCase().includes(filter) ||
            h.stock_symbol.toLowerCase().includes(filter),
      )
      .map((h) => {
        const live = quotesQ.data?.[h.stock_symbol]?.price ?? null;
        const invested = h.buy_price * h.quantity;
        const current = live != null ? live * h.quantity : null;
        const pnl = current != null ? current - invested : null;
        const ret = current != null && invested > 0 ? (pnl! / invested) * 100 : null;
        return { h, live, invested, current, pnl, ret };
      });
  }, [holdingsQ.data, quotesQ.data, query]);

  const totals = useMemo(() => {
    let invested = 0;
    let current = 0;
    let hasAll = symbols.length > 0;
    for (const r of rows) {
      invested += r.invested;
      if (r.current != null) current += r.current;
      else hasAll = false;
    }
    const pnl = hasAll ? current - invested : null;
    const ret = hasAll && invested > 0 ? (pnl! / invested) * 100 : null;
    return { invested, current: hasAll ? current : null, pnl, ret };
  }, [rows, symbols.length]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this holding?")) return;
    const { error } = await supabase.from("holdings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["holdings", userId] });
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["quotes", userId, symbols.join(",")] });
  const quoteStatus = quotesQ.isError
    ? "Disconnected"
    : hasQuoteFailures
      ? "Degraded"
      : symbols.length > 0
        ? "Connected"
        : "Idle";

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
              <Plus className="h-4 w-4 mr-2" /> Add holding
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Invested" value={inr(totals.invested)} />
        <StatCard label="Current Value" value={inr(totals.current)} />
        <StatCard
          label="Profit / Loss"
          value={inr(totals.pnl)}
          tone={totals.pnl == null ? "default" : totals.pnl >= 0 ? "profit" : "loss"}
        />
        <StatCard
          label="Return"
          value={pct(totals.ret)}
          tone={totals.ret == null ? "default" : totals.ret >= 0 ? "profit" : "loss"}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-3 border-b flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search holdings…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {holdingsQ.data?.length ?? 0} holding{(holdingsQ.data?.length ?? 0) === 1 ? "" : "s"}
            <> · status {quoteStatus}</>
            {lastSuccessfulQuotesAt && (
              <> · last successful update {new Date(lastSuccessfulQuotesAt).toLocaleTimeString()}</>
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
                Couldn't refresh live prices for {quoteFailures.length} stock
                {quoteFailures.length === 1 ? "" : "s"} ({quoteFailures.slice(0, 5).join(", ")}
                {quoteFailures.length > 5 ? ", …" : ""}). Showing fallback values where unavailable.
              </span>
            )}
          </div>
        )}

        {holdingsQ.isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (holdingsQ.data?.length ?? 0) === 0 ? (
          <div className="p-12 text-center">
            <div className="text-muted-foreground text-sm">No holdings yet.</div>
            {!readOnly && (
              <Button className="mt-4" size="sm" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add your first holding
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Stock</th>
                  <th className="text-right font-medium px-3 py-2.5">Qty</th>
                  <th className="text-right font-medium px-3 py-2.5">Buy</th>
                  <th className="text-right font-medium px-3 py-2.5">Live</th>
                  <th className="text-right font-medium px-3 py-2.5">Invested</th>
                  <th className="text-right font-medium px-3 py-2.5">Current</th>
                  <th className="text-right font-medium px-3 py-2.5">P&L</th>
                  <th className="text-right font-medium px-3 py-2.5">Return</th>
                  {!readOnly && <th className="px-3 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ h, live, invested, current, pnl, ret }) => (
                  <tr key={h.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{h.stock_name}</div>
                      <div className="text-xs text-muted-foreground">{displaySymbol(h.stock_symbol)} · {h.buy_date}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{num(h.quantity, 4)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{inr(h.buy_price)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {live != null ? (
                        inr(live)
                      ) : quotesQ.isFetching ? (
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
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(h); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(h.id)}>
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
        <HoldingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={userId}
          existing={editing}
          onSaved={() => qc.invalidateQueries({ queryKey: ["holdings", userId] })}
        />
      )}
    </div>
  );
}
