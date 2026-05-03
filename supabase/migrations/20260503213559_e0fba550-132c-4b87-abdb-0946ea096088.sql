
-- API keys for the REST API
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(token_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own read" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);

-- Shares
CREATE TABLE public.shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_post ON public.shares(post_id);
CREATE INDEX idx_shares_user ON public.shares(user_id);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.shares FOR SELECT USING (true);
CREATE POLICY "Auth insert" ON public.shares FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON public.shares FOR DELETE USING (auth.uid() = user_id);

-- Add shares_count to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0;

-- Add flagged column for moderation
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
