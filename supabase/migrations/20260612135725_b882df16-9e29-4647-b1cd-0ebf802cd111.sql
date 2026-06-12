
-- Enums
CREATE TYPE public.app_role AS ENUM ('client', 'manager');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Managers
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.managers TO authenticated;
GRANT ALL ON public.managers TO service_role;
-- Allow anon to look up by invite code (for invite signup pages, public name display)
GRANT SELECT ON public.managers TO anon;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- Manager <-> Client map
CREATE TABLE public.manager_client_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.manager_client_map TO authenticated;
GRANT ALL ON public.manager_client_map TO service_role;
ALTER TABLE public.manager_client_map ENABLE ROW LEVEL SECURITY;

-- Holdings
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_symbol TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  buy_price NUMERIC(18,4) NOT NULL CHECK (buy_price >= 0),
  quantity NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
  buy_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT ALL ON public.holdings TO service_role;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

-- ===== Policies =====

-- profiles: users read their own; managers read their assigned clients' profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Managers read assigned client profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.manager_client_map m
      WHERE m.manager_id = auth.uid() AND m.client_id = profiles.id
    )
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles: read own
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- managers: anyone authenticated can look up by invite code; managers read their own row
CREATE POLICY "Public read managers for invite lookup" ON public.managers
  FOR SELECT USING (true);

-- manager_client_map: managers see their links; clients see their own link
CREATE POLICY "Manager sees own links" ON public.manager_client_map
  FOR SELECT TO authenticated USING (auth.uid() = manager_id);
CREATE POLICY "Client sees own link" ON public.manager_client_map
  FOR SELECT TO authenticated USING (auth.uid() = client_id);

-- holdings: clients full CRUD on own; managers SELECT for assigned clients
CREATE POLICY "Client manages own holdings" ON public.holdings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Manager views assigned client holdings" ON public.holdings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.manager_client_map m
      WHERE m.manager_id = auth.uid() AND m.client_id = holdings.user_id
    )
  );

-- ===== Signup trigger =====
-- Generates invite code for managers, links clients via invite code in raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
  _name TEXT;
  _invite TEXT;
  _new_code TEXT;
  _manager_user_id UUID;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'client');
  _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  _invite := NEW.raw_user_meta_data->>'invite_code';

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, _name, NEW.email, _role);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);

  IF _role = 'manager' THEN
    -- Generate unique invite code
    LOOP
      _new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      BEGIN
        INSERT INTO public.managers (user_id, invite_code) VALUES (NEW.id, _new_code);
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- try again
      END;
    END LOOP;
  ELSIF _role = 'client' AND _invite IS NOT NULL AND length(trim(_invite)) > 0 THEN
    SELECT user_id INTO _manager_user_id FROM public.managers WHERE invite_code = upper(trim(_invite));
    IF _manager_user_id IS NOT NULL THEN
      INSERT INTO public.manager_client_map (manager_id, client_id)
      VALUES (_manager_user_id, NEW.id)
      ON CONFLICT (client_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
