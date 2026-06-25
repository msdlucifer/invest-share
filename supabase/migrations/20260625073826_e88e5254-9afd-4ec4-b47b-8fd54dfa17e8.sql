
-- Asset type enum
CREATE TYPE public.asset_type AS ENUM ('equity', 'bond', 'commodity');

-- Generic assets table
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type public.asset_type NOT NULL,
  asset_name text NOT NULL,
  symbol text,
  buy_price numeric NOT NULL,
  quantity numeric NOT NULL,
  buy_date date NOT NULL,
  current_price numeric,
  unit text,
  issuer text,
  maturity_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client manages own assets" ON public.assets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Manager views assigned client assets" ON public.assets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.manager_client_map m
    WHERE m.manager_id = auth.uid() AND m.client_id = assets.user_id
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER assets_set_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate existing holdings into assets (as equity)
INSERT INTO public.assets (user_id, asset_type, asset_name, symbol, buy_price, quantity, buy_date, created_at)
SELECT user_id, 'equity'::public.asset_type, stock_name, stock_symbol, buy_price, quantity, buy_date, created_at
FROM public.holdings;

-- Drop old holdings table
DROP TABLE public.holdings;
