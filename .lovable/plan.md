
## Goal

Turn Folio from a stocks-only app into a generic Portfolio Management Platform that supports **Equity**, **Bonds**, and **Commodities**, with Twelve Data as the live-price provider.

## 1. Database

Create a new generic `assets` table (replaces `holdings`):

- `id`, `user_id`, `created_at`
- `asset_type` — enum: `equity` | `bond` | `commodity`
- `asset_name` (e.g. "Reliance", "Gold", "10Y G-Sec 2034")
- `symbol` (nullable — used for equity & commodity live prices)
- `buy_price`, `quantity`, `buy_date`
- `current_price` (nullable — manual price for bonds; cached/last-known price for others)
- `unit` (nullable — for commodities, e.g. "gram", "barrel")
- `issuer`, `maturity_date` (nullable — bonds)

Migrate existing `holdings` rows into `assets` as `equity`, then drop `holdings`.

RLS:
- Clients: full CRUD on own rows (`auth.uid() = user_id`).
- Managers: SELECT only on assigned clients' rows (via `manager_client_map`).
- Explicitly no INSERT/UPDATE/DELETE for managers.

## 2. Live market data — Twelve Data

- Add `TWELVE_DATA_API_KEY` as a secret (requested via add_secret).
- Rewrite `src/lib/stocks.functions.ts` → `src/lib/market.functions.ts`:
  - `searchSymbols({ q, type })` — equity & commodity search via Twelve Data `/symbol_search`.
  - `getQuotes({ items: [{ symbol, asset_type }] })` — batch quote via `/price`.
  - Equity: live prices.
  - Commodity: live prices when Twelve Data supports the symbol (XAU/USD, XAG/USD, WTI/USD, etc.); otherwise fall back to `current_price`.
  - Bonds: skip API, always use manual `current_price`.
- Provider abstraction so additional commodity sources can be added later.

## 3. UI — Client portfolio

- Rename "Shares" → "Equity" everywhere.
- `PortfolioView` gains tabs: **All Assets · Equity · Bonds · Commodities**.
- Stat cards (per client):
  - Total Portfolio Value
  - Equity Value
  - Bond Value
  - Commodity Value
  - With % allocation chips on each.
- Holdings table columns: Asset Name · Asset Type · Buy · Current · Qty · Invested · Current Value · P/L · Return % (green/red).
- Add-asset dialog becomes type-aware:
  - Equity: symbol search + name + buy price + qty + buy date.
  - Bond: bond name, issuer, purchase price, quantity, maturity date, (optional current price).
  - Commodity: commodity name (+ optional symbol search), buy price, quantity, unit, buy date.

## 4. UI — Manager dashboard

- Clients list with search (already exists, keep).
- **Remove** any combined P/L across clients.
- Opening a client shows: Total Portfolio Value, Invested, Current, Total P/L, Asset Allocation, and the holdings table — view-only (no add/edit/delete buttons).

## 5. Files touched

- `supabase/migrations/<new>.sql` — new `assets` table, enum, RLS, grants, data migration, drop `holdings`.
- `src/lib/market.functions.ts` (new) + delete `src/lib/stocks.functions.ts`.
- `src/components/portfolio-view.tsx` — tabs, allocation cards, generic rows.
- `src/components/holding-dialog.tsx` → `src/components/asset-dialog.tsx` — type-aware form.
- `src/routes/_authenticated/portfolio.tsx`, `clients.index.tsx`, `clients.$clientId.tsx` — copy + read-only enforcement.
- `src/routes/index.tsx` — landing copy ("Portfolio Management Platform", multi-asset).
- `src/lib/format.ts` — small helpers for asset-type labels.

## 6. Out of scope (MVP)

- Historical charts of portfolio value.
- Per-asset transaction history (treat each row as a position).
- Currency conversion (assume INR display; commodities priced in USD will be converted at a fixed display note "USD" until FX is added).

---

Before I start I need one thing from you: a **Twelve Data API key** (free tier works — sign up at twelvedata.com, copy the API key from the dashboard). I'll request it via the secrets prompt once you approve this plan.
