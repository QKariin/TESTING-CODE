-- Refined Supabase Schema to replace all Wix Velo collections

-- 1. PROFILES (Replacing 'Tasks' and 'Status')
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id TEXT UNIQUE NOT NULL, -- Email 
    name TEXT DEFAULT 'Slave',
    hierarchy TEXT DEFAULT 'Newbie',
    score INTEGER DEFAULT 0,
    wallet INTEGER DEFAULT 0,
    strike_count INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    avatar_url TEXT,
    profile_picture_url TEXT,
    routine TEXT,
    kinks TEXT,
    limits TEXT,
    notes TEXT,
    task_queue JSONB DEFAULT '[]',
    routine_history JSONB DEFAULT '[]',
    kneel_history JSONB DEFAULT '{}',
    active_reveal_map JSONB DEFAULT '[]',
    reward_vault JSONB DEFAULT '[]',
    library_progress_index INTEGER DEFAULT 1,
    parameters JSONB DEFAULT '{}'
);

-- 2. MESSAGES (Replacing 'Chat')
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id TEXT REFERENCES profiles(member_id),
    sender TEXT NOT NULL, -- 'user', 'admin', 'system'
    message TEXT,
    media_url TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SOCIAL FEED (Replacing 'QKarinonline')
CREATE TABLE IF NOT EXISTS social_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    content TEXT,
    media_url TEXT,
    external_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. DIRECTIVES LIBRARY (Replacing 'DirectivesLibrary')
CREATE TABLE IF NOT EXISTS directives_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "order" INTEGER UNIQUE NOT NULL,
    title TEXT,
    media_url TEXT,
    description TEXT
);

-- 5. DAILY TASKS (Replacing 'DailyTasks')
CREATE TABLE IF NOT EXISTS daily_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_text TEXT NOT NULL,
    category TEXT,
    min_rank TEXT
);

-- 6. WISHLIST (Replacing 'Wishlist')
CREATE TABLE IF NOT EXISTS wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    price INTEGER DEFAULT 0,
    image_url TEXT,
    external_link TEXT
);

-- 7. RULES (Replacing 'RULES')
CREATE TABLE IF NOT EXISTS system_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_key TEXT UNIQUE NOT NULL,
    rule_value TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
