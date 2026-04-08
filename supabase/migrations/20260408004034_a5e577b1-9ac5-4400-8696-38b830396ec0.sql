-- Add pulse_count to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pulse_count integer NOT NULL DEFAULT 0;

-- Remove content length CHECK constraint on posts
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_content_check;

-- Allow post owners to update their posts (needed for troll mode revert)
CREATE POLICY "Own update" ON public.posts FOR UPDATE USING (auth.uid() = user_id);

-- Badges table
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  detail text,
  color text NOT NULL DEFAULT '#3B82F6',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admin insert" ON public.badges FOR INSERT WITH CHECK (true);

-- User badges junction table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Admin insert" ON public.user_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete" ON public.user_badges FOR DELETE USING (true);

-- Admin events table (rainbow flash, troll mode, etc.)
CREATE TABLE public.admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  active_until timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.admin_events FOR SELECT USING (true);
CREATE POLICY "Admin insert" ON public.admin_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin update" ON public.admin_events FOR UPDATE USING (true);

-- Enable realtime on admin_events so all clients react
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.badges;