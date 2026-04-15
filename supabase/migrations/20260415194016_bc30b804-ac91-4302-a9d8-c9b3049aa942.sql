
-- Beta codes redeemed by users
CREATE TABLE public.beta_codes_redeemed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);
ALTER TABLE public.beta_codes_redeemed ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beta_codes_redeemed
    WHERE user_id = _user_id AND code = 'pulse23moderation'
  )
$$;

CREATE POLICY "Own read" ON public.beta_codes_redeemed FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON public.beta_codes_redeemed FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Bans table
CREATE TABLE public.bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  banned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unbanned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  UNIQUE(user_id)
);
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.bans FOR SELECT USING (true);
CREATE POLICY "Mod insert" ON public.bans FOR INSERT WITH CHECK (public.is_moderator(auth.uid()) OR public.is_admin());
CREATE POLICY "Mod update" ON public.bans FOR UPDATE USING (public.is_moderator(auth.uid()) OR public.is_admin());
CREATE POLICY "Mod delete" ON public.bans FOR DELETE USING (public.is_moderator(auth.uid()) OR public.is_admin());

-- Ban appeals
CREATE TABLE public.ban_appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
ALTER TABLE public.ban_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own read" ON public.ban_appeals FOR SELECT USING (auth.uid() = user_id OR public.is_moderator(auth.uid()) OR public.is_admin());
CREATE POLICY "Own insert" ON public.ban_appeals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Mod update" ON public.ban_appeals FOR UPDATE USING (public.is_moderator(auth.uid()) OR public.is_admin());

-- User reports
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own read" ON public.user_reports FOR SELECT USING (auth.uid() = reporter_id OR public.is_moderator(auth.uid()) OR public.is_admin());
CREATE POLICY "Auth insert" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Mod update" ON public.user_reports FOR UPDATE USING (public.is_moderator(auth.uid()) OR public.is_admin());

-- App settings (lockdown etc)
CREATE TABLE public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID DEFAULT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Mod upsert" ON public.app_settings FOR INSERT WITH CHECK (public.is_moderator(auth.uid()) OR public.is_admin());
CREATE POLICY "Mod update" ON public.app_settings FOR UPDATE USING (public.is_moderator(auth.uid()) OR public.is_admin());

-- Insert default lockdown setting
INSERT INTO public.app_settings (key, value) VALUES ('lockdown', '{"enabled": false}'::jsonb);
