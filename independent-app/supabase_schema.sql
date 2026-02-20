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
    daily_score INTEGER DEFAULT 0, -- Added for DailyScore job
    weekly_score INTEGER DEFAULT 0, -- Added for Leaderboard job
    monthly_score INTEGER DEFAULT 0, -- Added for MonthlyScore job
    yearly_score INTEGER DEFAULT 0, -- Added for Leaderboard job
    parameters JSONB DEFAULT '{}'
);

-- 1.b DAILY LEADERBOARD (Replacing 'DailyLeaderboard' - Current Standings)
CREATE TABLE IF NOT EXISTS daily_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rank INTEGER UNIQUE NOT NULL,
    name TEXT,
    score INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.c WEEKLY STANDINGS (For current weekly progress before reset)
CREATE TABLE IF NOT EXISTS weekly_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rank INTEGER UNIQUE NOT NULL,
    name TEXT,
    score INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.d WEEKLY LEADERBOARD (Replacing 'WeeklyLeaderboard' - History Log)
CREATE TABLE IF NOT EXISTS weekly_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name1 TEXT, score1 INTEGER,
    name2 TEXT, score2 INTEGER,
    name3 TEXT, score3 INTEGER
);

-- 1.e MONTHLY LEADERBOARD (Replacing 'MonthlyLeaderboard' - History Log)
-- NOTE: Velo code treated this as History Log in one place, but Standings in another.
-- We will keep this as History Log (name1, name2, name3) for the Reset Job.
CREATE TABLE IF NOT EXISTS monthly_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name1 TEXT, score1 INTEGER,
    name2 TEXT, score2 INTEGER,
    name3 TEXT, score3 INTEGER
);

-- 1.e MONTHLY STANDINGS (New: For current monthly progress before reset)
CREATE TABLE IF NOT EXISTS monthly_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rank INTEGER UNIQUE NOT NULL,
    name TEXT,
    score INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.f YEARLY STANDINGS (New: For current yearly progress before reset)
CREATE TABLE IF NOT EXISTS yearly_standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rank INTEGER UNIQUE NOT NULL,
    name TEXT,
    score INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.g YEARLY LEADERBOARD (Replacing 'YearlyLeaderboard' - History Log)
CREATE TABLE IF NOT EXISTS yearly_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name1 TEXT, score1 INTEGER,
    name2 TEXT, score2 INTEGER,
    name3 TEXT, score3 INTEGER
);

-- 1.h OVERALL LEADERBOARD
CREATE TABLE IF NOT EXISTS overall_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rank INTEGER UNIQUE NOT NULL,
    name TEXT,
    score INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
