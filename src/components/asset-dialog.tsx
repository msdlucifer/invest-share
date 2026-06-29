import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchSymbols, type SymbolSearchResult, type AssetType } from "@/lib/market.functions";
import { COMMODITY_PRESETS, findCommodityPreset } from "@/lib/commodities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";

export type AssetRow = {
  id: string;
  asset_type: AssetType;
  asset_name: string;
  symbol: string | null;
  exchange: string | null;
  currency: string | null;
  buy_price: number;
  quantity: number;
  buy_date: string;
  current_price: number | null;
  unit: string | null;
  issuer: string | null;
  maturity_date: string | null;
};

export function AssetDialog({
  open,
  onOpenChange,
  userId,
  existing,
  defaultType = "equity",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  existing?: AssetRow;
  defaultType?: AssetType;
  onSaved: () => void;
}) {
  const [assetType, setAssetType] = useState<AssetType>(existing?.asset_type ?? defaultType);
  const [assetName, setAssetName] = useState(existing?.asset_name ?? "");
  const [symbol, setSymbol] = useState(existing?.symbol ?? "");
  const [exchange, setExchange] = useState(existing?.exchange ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? "");
  const [buyPrice, setBuyPrice] = useState<string>(existing ? String(existing.buy_price) : "");
  const [qty, setQty] = useState<string>(existing ? String(existing.quantity) : "");
  const [date, setDate] = useState(existing?.buy_date ?? new Date().toISOString().slice(0, 10));
  const [currentPrice, setCurrentPrice] = useState<string>(
    existing?.current_price != null ? String(existing.current_price) : "",
  );
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [issuer, setIssuer] = useState(existing?.issuer ?? "");
  const [maturityDate, setMaturityDate] = useState(existing?.maturity_date ?? "");
  const [saving, setSaving] = useState(false);

  // search
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchFn = useServerFn(searchSymbols);

  useEffect(() => {
    if (!query.trim() || assetType !== "equity") {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchFn({ data: { q: query.trim(), assetType: "equity" } });
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, searchFn, assetType]);

  useEffect(() => {
    if (open) {
      setAssetType(existing?.asset_type ?? defaultType);
      setAssetName(existing?.asset_name ?? "");
      setSymbol(existing?.symbol ?? "");
      setExchange(existing?.exchange ?? "");
      setCurrency(existing?.currency ?? "");
      setBuyPrice(existing ? String(existing.buy_price) : "");
      setQty(existing ? String(existing.quantity) : "");
      setDate(existing?.buy_date ?? new Date().toISOString().slice(0, 10));
      setCurrentPrice(existing?.current_price != null ? String(existing.current_price) : "");
      setUnit(existing?.unit ?? "");
      setIssuer(existing?.issuer ?? "");
      setMaturityDate(existing?.maturity_date ?? "");
    }
  }, [open, existing, defaultType]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assetName.trim()) {
      toast.error("Asset name is required");
      return;
    }
    const bp = Number(buyPrice);
    const q = Number(qty);
    if (Number.isNaN(bp) || bp < 0 || Number.isNaN(q) || q <= 0) {
      toast.error("Enter valid price and quantity");
      return;
    }
    if (assetType === "equity" && !symbol.trim()) {
      toast.error("Pick a stock from search");
      return;
    }
    if (assetType === "bond" && !maturityDate) {
      toast.error("Maturity date is required");
      return;
    }
    if (assetType === "commodity") {
      if (!symbol.trim()) {
        toast.error("Pick a commodity");
        return;
      }
      if (!unit.trim()) {
        toast.error("Unit is required");
        return;
      }
    }

    const payload = {
      user_id: userId,
      asset_type: assetType,
      asset_name: assetName.trim(),
      symbol: symbol.trim() || null,
      exchange: exchange.trim() || null,
      currency: currency.trim() || (assetType === "commodity" ? "INR" : null),
      buy_price: bp,
      quantity: q,
      buy_date: date,
      current_price:
        currentPrice.trim() && !Number.isNaN(Number(currentPrice)) ? Number(currentPrice) : null,
      unit: assetType === "commodity" ? unit.trim() || null : null,
      issuer: assetType === "bond" ? issuer.trim() || null : null,
      maturity_date: assetType === "bond" ? maturityDate || null : null,
    };

    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.from("assets").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Asset updated");
      } else {
        const { error } = await supabase.from("assets").insert(payload);
        if (error) throw error;
        toast.success("Asset added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit asset" : "Add asset"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!existing && (
            <div className="space-y-1.5">
              <Label>Asset type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="bond">Bond</SelectItem>
                  <SelectItem value="commodity">Commodity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {assetType === "equity" && (
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start font-normal h-auto py-2">
                    <Search className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                    {symbol ? (
                      <span className="text-left">
                        <span className="font-medium block">{assetName}</span>
                        <span className="text-xs text-muted-foreground">
                          {symbol}{exchange ? ` · ${exchange}` : ""}{currency ? ` · ${currency}` : ""}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Search company e.g. Reliance, TCS, Infosys…</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search company name…" value={query} onValueChange={setQuery} />
                    <CommandList>
                      {searching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
                      {!searching && query && results.length === 0 && <CommandEmpty>No matches.</CommandEmpty>}
                      <CommandGroup>
                        {results.map((r) => (
                          <CommandItem
                            key={`${r.symbol}-${r.exchange}`}
                            value={`${r.symbol}-${r.exchange}`}
                            onSelect={() => {
                              setSymbol(r.symbol);
                              setAssetName(r.name);
                              setExchange(r.exchange);
                              setCurrency(r.currency);
                              setSearchOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{r.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {r.symbol} · {r.exchange}{r.currency ? ` · ${r.currency}` : ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Picks the official symbol &amp; exchange from Twelve Data automatically.
              </p>
            </div>
          )}

          {assetType === "commodity" && (
            <>
              <div className="space-y-1.5">
                <Label>Commodity</Label>
                <Select
                  value={symbol}
                  onValueChange={(v) => {
                    const p = findCommodityPreset(v);
                    if (p) {
                      setSymbol(p.apiSymbol);
                      setAssetName(p.name);
                      setUnit(p.displayUnit);
                      setCurrency(p.displayCurrency);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a commodity" /></SelectTrigger>
                  <SelectContent>
                    {COMMODITY_PRESETS.map((c) => (
                      <SelectItem key={c.apiSymbol} value={c.apiSymbol}>
                        {c.name} — {c.displayCurrency} / {c.displayUnit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Prices auto-convert into ₹ per {unit || "unit"}.
                </p>
              </div>
            </>
          )}

          {assetType === "bond" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bname">Bond name</Label>
                <Input id="bname" required value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="10Y G-Sec 2034" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iss">Issuer</Label>
                <Input id="iss" value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Government of India" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bp">
                {assetType === "commodity"
                  ? `Buy price (₹ / ${unit || "unit"})`
                  : assetType === "bond"
                    ? "Purchase price (₹)"
                    : "Buy price (₹)"}
              </Label>
              <Input id="bp" type="number" step="0.01" min="0" required value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity {assetType === "commodity" && unit ? `(${unit})` : ""}</Label>
              <Input id="qty" type="number" step="0.0001" min="0" required value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          {assetType === "bond" ? (
            <div className="space-y-1.5">
              <Label htmlFor="mat">Maturity date</Label>
              <Input id="mat" type="date" required value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="date">Buy date</Label>
              <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          {assetType === "bond" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cp">Current price (₹)</Label>
                <Input id="cp" type="number" step="0.01" min="0" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bdate">Purchase date</Label>
                <Input id="bdate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : existing ? "Save changes" : "Add asset"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
