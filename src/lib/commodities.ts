// Commodity presets — the user picks one of these; we store the API symbol
// and convert the API response into the user's display unit/currency.
// Twelve Data XAU/INR & XAG/INR return INR per TROY OUNCE.
// 1 troy oz = 31.1034768 g.

export type CommodityPreset = {
  name: string;
  apiSymbol: string;
  apiCurrency: "INR" | "USD";
  apiUnit: "oz" | "barrel" | "MMBtu" | "lb";
  displayUnit: string;
  displayCurrency: "INR";
  // Multiply API price (in apiCurrency / apiUnit) by this factor to get
  // price in (displayCurrency / displayUnit), assuming any FX is applied
  // separately when apiCurrency !== displayCurrency.
  unitFactor: number;
};

const OZ_TO_GRAM = 1 / 31.1034768;

export const COMMODITY_PRESETS: CommodityPreset[] = [
  {
    name: "Gold",
    apiSymbol: "XAU/INR",
    apiCurrency: "INR",
    apiUnit: "oz",
    displayUnit: "gram",
    displayCurrency: "INR",
    unitFactor: OZ_TO_GRAM,
  },
  {
    name: "Silver",
    apiSymbol: "XAG/INR",
    apiCurrency: "INR",
    apiUnit: "oz",
    displayUnit: "gram",
    displayCurrency: "INR",
    unitFactor: OZ_TO_GRAM,
  },
  {
    name: "Crude Oil (WTI)",
    apiSymbol: "WTI/USD",
    apiCurrency: "USD",
    apiUnit: "barrel",
    displayUnit: "barrel",
    displayCurrency: "INR",
    unitFactor: 1,
  },
  {
    name: "Natural Gas",
    apiSymbol: "NG/USD",
    apiCurrency: "USD",
    apiUnit: "MMBtu",
    displayUnit: "MMBtu",
    displayCurrency: "INR",
    unitFactor: 1,
  },
  {
    name: "Copper",
    apiSymbol: "COPPER/USD",
    apiCurrency: "USD",
    apiUnit: "lb",
    displayUnit: "lb",
    displayCurrency: "INR",
    unitFactor: 1,
  },
];

export function findCommodityPreset(symbol: string | null | undefined): CommodityPreset | null {
  if (!symbol) return null;
  return COMMODITY_PRESETS.find((p) => p.apiSymbol === symbol) ?? null;
}

export const FX_USD_INR_SYMBOL = "USD/INR";
