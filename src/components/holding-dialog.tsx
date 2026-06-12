import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchStocks, type StockSearchResult } from "@/lib/stocks.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";

export type HoldingRow = {
  id: string;
  stock_symbol: string;
  stock_name: string;
  buy_price: number;
  quantity: number;
  buy_date: string;
};

export function HoldingDialog({
  open,
  onOpenChange,
  userId,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  existing?: HoldingRow;
  onSaved: () => void;
}) {
  const [symbol, setSymbol] = useState(existing?.stock_symbol ?? "");
  const [name, setName] = useState(existing?.stock_name ?? "");
  const [buyPrice, setBuyPrice] = useState<string>(existing ? String(existing.buy_price) : "");
  const [qty, setQty] = useState<string>(existing ? String(existing.quantity) : "");
  const [date, setDate] = useState(existing?.buy_date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // search
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchFn = useServerFn(searchStocks);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchFn({ data: { q: query.trim() } });
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, searchFn]);

  useEffect(() => {
    if (open) {
      setSymbol(existing?.stock_symbol ?? "");
      setName(existing?.stock_name ?? "");
      setBuyPrice(existing ? String(existing.buy_price) : "");
      setQty(existing ? String(existing.quantity) : "");
      setDate(existing?.buy_date ?? new Date().toISOString().slice(0, 10));
    }
  }, [open, existing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !name) {
      toast.error("Pick a stock from search");
      return;
    }
    const payload = {
      user_id: userId,
      stock_symbol: symbol,
      stock_name: name,
      buy_price: Number(buyPrice),
      quantity: Number(qty),
      buy_date: date,
    };
    if (payload.buy_price < 0 || payload.quantity <= 0) {
      toast.error("Enter valid price and quantity");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.from("holdings").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Holding updated");
      } else {
        const { error } = await supabase.from("holdings").insert(payload);
        if (error) throw error;
        toast.success("Holding added");
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
          <DialogTitle>{existing ? "Edit holding" : "Add holding"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Stock</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-start font-normal"
                >
                  <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                  {symbol ? (
                    <span><span className="font-medium">{name}</span> <span className="text-muted-foreground">· {symbol}</span></span>
                  ) : (
                    <span className="text-muted-foreground">Search e.g. Reliance, TCS…</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search stocks…" value={query} onValueChange={setQuery} />
                  <CommandList>
                    {searching && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
                    {!searching && query && results.length === 0 && (
                      <CommandEmpty>No matches.</CommandEmpty>
                    )}
                    <CommandGroup>
                      {results.map((r) => (
                        <CommandItem
                          key={r.symbol}
                          value={r.symbol}
                          onSelect={() => {
                            setSymbol(r.symbol);
                            setName(r.name);
                            setSearchOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.symbol} · {r.exchange}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bp">Buy price (₹)</Label>
              <Input id="bp" type="number" step="0.01" min="0" required value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity</Label>
              <Input id="qty" type="number" step="0.0001" min="0" required value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Buy date</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : existing ? "Save changes" : "Add holding"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
