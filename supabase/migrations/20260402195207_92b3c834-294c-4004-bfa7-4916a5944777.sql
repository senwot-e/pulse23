
-- Profiles
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Own update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Own insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Posts
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 280),
  image_url text,
  likes_count int DEFAULT 0,
  comments_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Auth insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Likes
CREATE TABLE likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON likes FOR SELECT USING (true);
CREATE POLICY "Auth insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 500),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON comments FOR SELECT USING (true);
CREATE POLICY "Auth insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks
CREATE TABLE bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own read" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE TABLE follows (
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON follows FOR SELECT USING (true);
CREATE POLICY "Auth insert" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Own delete" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('like','comment','follow')),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own read" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Auth insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Own update" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- DM Conversations
CREATE TABLE dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  participant_two uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant_one, participant_two)
);
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read" ON dm_conversations FOR SELECT USING (auth.uid() = participant_one OR auth.uid() = participant_two);
CREATE POLICY "Auth insert" ON dm_conversations FOR INSERT WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

-- DM Messages
CREATE TABLE dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES dm_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  image_url text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read" ON dm_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM dm_conversations WHERE id = conversation_id AND (participant_one = auth.uid() OR participant_two = auth.uid()))
);
CREATE POLICY "Auth insert" ON dm_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Sender update" ON dm_messages FOR UPDATE USING (auth.uid() = sender_id);

-- DM Typing
CREATE TABLE dm_typing (
  conversation_id uuid REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE dm_typing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON dm_typing FOR SELECT USING (true);
CREATE POLICY "Own insert" ON dm_typing FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON dm_typing FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON dm_typing FOR DELETE USING (auth.uid() = user_id);

-- AI Conversations
CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own read" ON ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- AI Messages
CREATE TABLE ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own read" ON ai_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM ai_conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Auth insert" ON ai_messages FOR INSERT WITH CHECK (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Public read post-images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Auth upload post-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');
CREATE POLICY "Own delete post-images" ON storage.objects FOR DELETE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Own delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_typing;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
