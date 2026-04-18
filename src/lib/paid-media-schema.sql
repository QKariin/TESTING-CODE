-- Paid Media: tracks media sent by chatters/queen with a price,
-- unlockable by subs who pay from their wallet (Capital).

CREATE TABLE IF NOT EXISTS paid_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uploader_email TEXT NOT NULL,
    member_id TEXT NOT NULL,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'photo',
    thumbnail_url TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    is_unlocked BOOLEAN DEFAULT false,
    unlocked_at TIMESTAMPTZ,
    chat_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: all access via service role key in API routes
ALTER TABLE paid_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on paid_media"
    ON paid_media FOR ALL USING (true) WITH CHECK (true);

-- Index for lookups by conversation
CREATE INDEX idx_paid_media_member ON paid_media(member_id);

-- ─────────────────────────────────────────────────────────
-- Media Vault: persistent gallery of reusable media assets.
-- Organized by category for quick access by chatters/queen.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_vault (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'photo',  -- 'photo' or 'video'
    thumbnail_url TEXT,
    category TEXT NOT NULL DEFAULT 'uncategorized',
    uploader_email TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE media_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on media_vault"
    ON media_vault FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_media_vault_category ON media_vault(category);
CREATE INDEX idx_media_vault_created ON media_vault(created_at DESC);
