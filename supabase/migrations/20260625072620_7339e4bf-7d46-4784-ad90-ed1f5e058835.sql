
DROP POLICY IF EXISTS "Public read managers for invite lookup" ON public.managers;

CREATE POLICY "Manager reads own row" ON public.managers
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.lookup_invite(_code text)
RETURNS TABLE (manager_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name
  FROM public.managers m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.invite_code = upper(trim(_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invite(text) TO anon, authenticated;
