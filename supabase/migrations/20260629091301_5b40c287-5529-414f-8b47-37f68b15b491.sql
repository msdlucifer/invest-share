ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS exchange text,
  ADD COLUMN IF NOT EXISTS currency text;