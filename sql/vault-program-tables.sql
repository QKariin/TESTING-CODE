-- Vault Program Tables
-- Run this in Supabase SQL Editor

-- 1. Master template: the default formula for all new users
CREATE TABLE IF NOT EXISTS vault_program_template (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    day_number integer NOT NULL,
    tasks jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz DEFAULT now()
);

-- 2. Per-member program: their personal 30-day plan (copied from template, editable)
CREATE TABLE IF NOT EXISTS vault_member_program (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id text NOT NULL,
    program jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- 3. Config table: spin wheel options, card deck, quiz questions, etc.
CREATE TABLE IF NOT EXISTS vault_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL DEFAULT '[]',
    updated_at timestamptz DEFAULT now()
);

-- 4. Vault check log — proper table for chastity checks + all vault submissions
-- Same pattern as user_routines: one row per submission, proper columns, no JSON
CREATE TABLE IF NOT EXISTS vault_check_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL DEFAULT 'chastity_check',
    proof_url TEXT,
    proof_type TEXT DEFAULT 'image',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_at TIMESTAMPTZ,
    queen_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, date, type)
);

CREATE INDEX IF NOT EXISTS idx_vault_check_log_session ON vault_check_log(session_id, date);
CREATE INDEX IF NOT EXISTS idx_vault_check_log_status ON vault_check_log(status);
CREATE INDEX IF NOT EXISTS idx_vault_check_log_member ON vault_check_log(member_id, date);

-- 5. Vault submissions — proper table for all task submissions (not chastity, that's vault_check_log)
-- One row per submission. Member can resubmit after rejection.
CREATE TABLE IF NOT EXISTS vault_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES vault_sessions(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    date DATE NOT NULL,
    order_idx INTEGER NOT NULL,
    order_type TEXT NOT NULL,
    label TEXT,
    text TEXT,
    photo_url TEXT,
    video_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TIMESTAMPTZ,
    queen_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_submissions_session_date ON vault_submissions(session_id, date);
CREATE INDEX IF NOT EXISTS idx_vault_submissions_status ON vault_submissions(status);
CREATE INDEX IF NOT EXISTS idx_vault_submissions_member ON vault_submissions(member_id, date);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vault_member_program_session ON vault_member_program(session_id);
CREATE INDEX IF NOT EXISTS idx_vault_member_program_member ON vault_member_program(member_id);
CREATE INDEX IF NOT EXISTS idx_vault_program_template_day ON vault_program_template(day_number);

-- Seed initial spin wheel options
INSERT INTO vault_config (key, value) VALUES ('spin_wheel', '[
    {"label": "Add 1 day to sentence", "effect": "add_days", "value": 1, "weight": 4},
    {"label": "Add 2 days to sentence", "effect": "add_days", "value": 2, "weight": 2},
    {"label": "Remove 1 day", "effect": "remove_days", "value": 1, "weight": 1},
    {"label": "Double kneeling tomorrow", "effect": "double_kneel", "value": 2, "weight": 3},
    {"label": "Extra tribute: 10 coins", "effect": "add_tribute", "value": 10, "weight": 3},
    {"label": "Free edge allowed", "effect": "free_edge", "value": 1, "weight": 1},
    {"label": "Cold shower 120s", "effect": "cold_shower", "value": 120, "weight": 2},
    {"label": "Corner time 15 min", "effect": "corner_time", "value": 15, "weight": 2},
    {"label": "Body writing required", "effect": "body_writing", "value": 1, "weight": 2},
    {"label": "Lucky! No punishment", "effect": "nothing", "value": 0, "weight": 1}
]') ON CONFLICT (key) DO NOTHING;

-- Seed initial card deck
INSERT INTO vault_config (key, value) VALUES ('card_deck', '[
    {"title": "Ice Cube Challenge", "description": "Hold an ice cube against your inner thigh for 60 seconds. No moving.", "category": "pain"},
    {"title": "Silent Hour", "description": "No speaking for 1 full hour. Text only if absolutely necessary.", "category": "control"},
    {"title": "Kneeling Report", "description": "Kneel and write a 100-word report on why you deserve to be locked.", "category": "devotion"},
    {"title": "Cold Water Splash", "description": "Splash cold water on your face 10 times. Film it.", "category": "pain"},
    {"title": "Gratitude Kneel", "description": "Kneel for 5 minutes while listing everything you are grateful for out loud.", "category": "devotion"},
    {"title": "Edge and Beg", "description": "Edge once, then write a 50-word begging message. Do not release.", "category": "denial"},
    {"title": "Mirror Mantra", "description": "Stand in front of a mirror and repeat I am owned property 20 times.", "category": "humiliation"},
    {"title": "Outfit Check", "description": "Wear only what Queen approves for the next 4 hours. Ask permission.", "category": "control"},
    {"title": "Breath Hold", "description": "Hold your breath for as long as you can. Report your time.", "category": "endurance"},
    {"title": "Apology Letter", "description": "Write a 200-word apology letter for your existence without permission.", "category": "devotion"},
    {"title": "Wall Sit", "description": "Wall sit for 90 seconds. Photo proof required.", "category": "pain"},
    {"title": "No Furniture", "description": "Sit only on the floor for the next 2 hours. No chairs, no couch.", "category": "control"}
]') ON CONFLICT (key) DO NOTHING;

-- Seed quiz questions
INSERT INTO vault_config (key, value) VALUES ('quiz_questions', '[
    {"question": "What is the first rule of serving Queen Karin?", "answer": "Obedience without question"},
    {"question": "How many kneeling sessions are required daily at minimum?", "answer": "8"},
    {"question": "What must you do before speaking in the presence of Queen?", "answer": "Kneel and wait for permission"},
    {"question": "What happens when you fail a daily order?", "answer": "Penalty days are added"},
    {"question": "What is the purpose of the chastity check?", "answer": "To prove devotion and submission"},
    {"question": "When is the only time you may request release?", "answer": "Never. Queen decides."},
    {"question": "What word must every message to Queen begin with?", "answer": "Queen"},
    {"question": "How should you address yourself when speaking to Queen?", "answer": "As nothing, as property, in third person"}
]') ON CONFLICT (key) DO NOTHING;

-- Seed lines texts
INSERT INTO vault_config (key, value) VALUES ('lines_texts', '[
    "I am owned property",
    "I exist to serve Queen Karin",
    "My body belongs to Queen",
    "I am nothing without her control",
    "Obedience is my only purpose",
    "I am grateful for every restriction"
]') ON CONFLICT (key) DO NOTHING;

-- Seed body writing options
INSERT INTO vault_config (key, value) VALUES ('body_writing', '[
    "OWNED",
    "PROPERTY",
    "DENIED",
    "LOCKED",
    "SERVE",
    "OBEY"
]') ON CONFLICT (key) DO NOTHING;

-- Seed exercise options
INSERT INTO vault_config (key, value) VALUES ('exercises', '[
    {"type": "pushups", "count": 50},
    {"type": "squats", "count": 40},
    {"type": "wall_sit", "count": 90},
    {"type": "plank", "count": 60},
    {"type": "burpees", "count": 20}
]') ON CONFLICT (key) DO NOTHING;
