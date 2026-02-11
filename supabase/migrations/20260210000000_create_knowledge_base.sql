-- Knowledge Base: stores connected account info and synced content
-- Follows existing patterns from documents table and credits system

-- Track which external accounts users have connected via Composio
CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,            -- 'google_drive', 'google_docs', 'notion'
  composio_account_id TEXT,          -- Composio's connected account ID
  status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated', 'active', 'expired', 'failed'
  display_name TEXT,                 -- e.g. "rushil@gmail.com" or "My Notion Workspace"
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  UNIQUE(user_id, provider)
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connected accounts"
  ON connected_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own connected accounts"
  ON connected_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own connected accounts"
  ON connected_accounts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own connected accounts"
  ON connected_accounts FOR DELETE
  USING (user_id = auth.uid());

-- Synced knowledge base content from connected accounts
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,              -- 'google_drive', 'google_docs', 'notion'
  source_id TEXT NOT NULL,           -- external document/page ID
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',       -- extra info: mime type, last edited, URL, etc.
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, source, source_id)
);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge base"
  ON knowledge_base FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own knowledge base"
  ON knowledge_base FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own knowledge base"
  ON knowledge_base FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own knowledge base"
  ON knowledge_base FOR DELETE
  USING (user_id = auth.uid());

-- Index for fast full-text search on knowledge base content
CREATE INDEX IF NOT EXISTS idx_knowledge_base_user ON knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source ON knowledge_base(user_id, source);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base USING gin(to_tsvector('english', coalesce(title, '') || ' ' || content));
