-- Create admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND username = 'senwot'
  )
$$;

-- Fix badges policies
DROP POLICY IF EXISTS "Admin insert" ON public.badges;
CREATE POLICY "Admin insert" ON public.badges FOR INSERT WITH CHECK (public.is_admin());

-- Fix user_badges policies
DROP POLICY IF EXISTS "Admin insert" ON public.user_badges;
DROP POLICY IF EXISTS "Admin delete" ON public.user_badges;
CREATE POLICY "Admin insert" ON public.user_badges FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete" ON public.user_badges FOR DELETE USING (public.is_admin());

-- Fix admin_events policies
DROP POLICY IF EXISTS "Admin insert" ON public.admin_events;
DROP POLICY IF EXISTS "Admin update" ON public.admin_events;
CREATE POLICY "Admin insert" ON public.admin_events FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin update" ON public.admin_events FOR UPDATE USING (public.is_admin());