// Commodity presets — user picks one; we store the API symbol used by the
// pricing provider (Yahoo Finance) and convert the API response into the
// user's display unit/currency (INR / gram, INR / barrel, etc.).
//
// Yahoo futures symbols quote metals in USD per troy ounce, so metals need
// two conversions:
//   1) unit:   troy ounce -> gram   (1/31.1034768)
//   2) fx:     USD        -> INR    (via INR=X spot)

export type CommodityPreset = {
  name: string;
  apiSymbol: string;
  apiCurrency: "INR" | "USD";
  apiUnit: "oz" | "barrel" | "MMBtu" | "lb";
  displayUnit: string;
  displayCurrency: "INR";
  // Multiply API price by this factor to convert apiUnit -> displayUnit.
  // FX (apiCurrency -> displayCurrency) is applied separately.
  unitFactor: number;
};

const OZ_TO_GRAM = 1 / 31.1034768;

export const COMMODITY_PRESETS: CommodityPreset[] = [
  {
    name: "Gold",
    apiSymbol: "GC=F", // Yahoo: Gold Futures, USD/oz
    apiCurrency: "USD",
    apiUnit: "oz",
    displayUnit: "gram",
    displayCurrency: "INR",
    unitFactor: OZ_TO_GRAM,
  },
  {
    name: "Silver",
    apiSymbol: "SI=F", // Yahoo: Silver Futures, USD/oz
    apiCurrency: "USD",
    apiUnit: "oz",
    displayUnit: "gram",
    displayCurrency: "INR",
    unitFactor: OZ_TO_GRAM,
  },
  {
    name: "Crude Oil (WTI)",
    apiSymbol: "CL=F", // Yahoo: WTI Crude Futures, USD/barrel
    apiCurrency: "USD",
    apiUnit: "barrel",
    displayUnit: "barrel",
    displayCurrency: "INR",
    unitFactor: 1,
  },
  {
    name: "Natural Gas",
    apiSymbol: "NG=F",
    apiCurrency: "USD",
    apiUnit: "MMBtu",
    displayUnit: "MMBtu",
    displayCurrency: "INR",
    unitFactor: 1,
  },
  {
    name: "Copper",
    apiSymbol: "HG=F", // Yahoo: Copper Futures, USD/lb
    apiCurrency: "USD",
    apiUnit: "lb",
    displayUnit: "lb",
    displayCurrency: "INR",
    unitFactor: 1,
  },
];

export function findCommodityPreset(symbol: string | null | undefined): CommodityPreset | null {
  if (!symbol) return null;
  // Accept legacy Twelve-Data symbols by mapping to the new Yahoo symbol.
  const legacyMap: Record<string, string> = {
    "XAU/INR": "GC=F",
    "XAG/INR": "SI=F",
    "XAU/USD": "GC=F",
    "XAG/USD": "SI=F",
    "WTI/USD": "CL=F",
    "NG/USD": "NG=F",
    "COPPER/USD": "HG=F",
  };
  const resolved = legacyMap[symbol] ?? symbol;
  return COMMODITY_PRESETS.find((p) => p.apiSymbol === resolved) ?? null;
}

// Yahoo Finance FX symbol for USD -> INR spot rate.
export const FX_USD_INR_SYMBOL = "INR=X";
