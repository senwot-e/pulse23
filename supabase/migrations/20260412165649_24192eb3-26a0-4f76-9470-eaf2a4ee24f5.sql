
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"likes":true,"comments":true,"followers":true,"dms":true}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_online_status boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_ai_suggestions boolean DEFAULT true;
