-- ===========================================================
-- FULL LEGACY MIGRATION: Wix CMS -> Supabase profiles
-- 56 MEMBERS — UPSERT with gen_random_uuid() for id
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ===========================================================


-- Tyler (tymcfarland21@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'tymcfarland21@gmail.com',
  'Tyler',
  'Hall Boy',
  55,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Gonzalo (ervirux@hotmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'ervirux@hotmail.com',
  'Gonzalo',
  'Hall Boy',
  25,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Chris (qquegfrom13@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'qquegfrom13@gmail.com',
  'Chris',
  'Hall Boy',
  1610,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '30'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '30'), '{routine_streak}', '0');

-- Maff (maffcox@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'maffcox@gmail.com',
  'Maff',
  'Hall Boy',
  170,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Jana (hellonanacola@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'hellonanacola@gmail.com',
  'Jana',
  'Hall Boy',
  650,
  2010,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '12'), '{taskdom_completed_tasks}', '2'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '12'), '{taskdom_completed_tasks}', '2'), '{routine_streak}', '0');

-- Michael (MPLPierreYvon@proton.me)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'MPLPierreYvon@proton.me',
  'Michael',
  'Butler',
  12140,
  930,
  0, 'https://upcdn.io/kW2K8hR/raw/uploads/2025/12/29/4jGR9LWU74-Photoroom_20250921_181415.jpeg',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '146'), '{taskdom_completed_tasks}', '63'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '146'), '{taskdom_completed_tasks}', '63'), '{routine_streak}', '0');

-- Libor (kotrla@ottagroup.cz)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'kotrla@ottagroup.cz',
  'Libor',
  'Hall Boy',
  0,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Shackleton (shackleton916@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'shackleton916@gmail.com',
  'Shackleton',
  'Silverman',
  8090,
  6750,
  0, 'https://upcdn.io/kW2K8hR/raw/profile/shackleton/25a38813-6b91-4170-a571-7e48bd66fcbd.jpeg',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '145'), '{taskdom_completed_tasks}', '18'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '145'), '{taskdom_completed_tasks}', '18'), '{routine_streak}', '0');

-- Alex (ajsmith0594@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'ajsmith0594@gmail.com',
  'Alex',
  'Hall Boy',
  100,
  2365,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '2'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '2'), '{routine_streak}', '0');

-- Rouven (wirouven2@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'wirouven2@gmail.com',
  'Rouven',
  'Hall Boy',
  1225,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Thomas (joinge88@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'joinge88@gmail.com',
  'Thomas',
  'Hall Boy',
  855,
  3630,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '26'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '26'), '{routine_streak}', '0');

-- Espen (espen240@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'espen240@gmail.com',
  'Espen',
  'Hall Boy',
  2910,
  2359,
  0, 'https://upcdn.io/kW2K8hR/raw/uploads/2026/01/03/4jFm2stQEt-two%20legs%20in%20one.jpg',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '38'), '{taskdom_completed_tasks}', '7'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '38'), '{taskdom_completed_tasks}', '7'), '{routine_streak}', '0');

-- Morgan (tomnm9601@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'tomnm9601@gmail.com',
  'Morgan',
  'Hall Boy',
  487,
  4210,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '2'), '{taskdom_completed_tasks}', '3'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '2'), '{taskdom_completed_tasks}', '3'), '{routine_streak}', '0');

-- Stefan (youhavethe@power.ms)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'youhavethe@power.ms',
  'Stefan',
  'Hall Boy',
  50,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '2'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '2'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Marc (madeserres@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'madeserres@gmail.com',
  'Marc',
  'Hall Boy',
  56,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '2'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '2'), '{routine_streak}', '0');

-- Austin (Sierravee28@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'Sierravee28@gmail.com',
  'Austin',
  'Hall Boy',
  1000,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Scot (qkarin.reflected550@simplelogin.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'qkarin.reflected550@simplelogin.com',
  'Scot',
  'Hall Boy',
  1005,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Robbie (robbiesteel92@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'robbiesteel92@gmail.com',
  'Robbie',
  'Hall Boy',
  500,
  4070,
  0, 'https://upcdn.io/kW2K8hR/raw/profile/robbie/ed4f73ed-0488-4602-8958-149f95f38a93.png',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '19'), '{taskdom_completed_tasks}', '3'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '19'), '{taskdom_completed_tasks}', '3'), '{routine_streak}', '0');

-- IAN! (ian777281@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'ian777281@gmail.com',
  'IAN!',
  'Queen''s Champion',
  102810,
  9070,
  0, 'https://upcdn.io/kW2K8hR/raw/uploads/2025/12/26/4jGoxkUp89-IAN.png',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '280'), '{taskdom_completed_tasks}', '58'), '{routine_streak}', '10')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '280'), '{taskdom_completed_tasks}', '58'), '{routine_streak}', '10');

-- Emil (emillin1411@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'emillin1411@gmail.com',
  'Emil',
  'Hall Boy',
  65,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- nóbl slave  (prespamemai@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'prespamemai@gmail.com',
  'nóbl slave ',
  'Chamberlain',
  30464,
  8420,
  0, 'https://upcdn.io/kW2K8hR/raw/profile/n_bl_slave_/435fc686-2a16-4e0b-87be-35233ce94350.jpeg',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '101'), '{taskdom_completed_tasks}', '135'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '101'), '{taskdom_completed_tasks}', '135'), '{routine_streak}', '0');

-- Greg (greglionstok@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'greglionstok@gmail.com',
  'Greg',
  'Hall Boy',
  0,
  4500,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Rasnf (nyabusiness883@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'nyabusiness883@gmail.com',
  'Rasnf',
  'Hall Boy',
  2,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '1'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '1'), '{routine_streak}', '0');

-- Eros (tjhdp11@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'tjhdp11@gmail.com',
  'Eros',
  'Hall Boy',
  195,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Slave (lucygreen2889@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'lucygreen2889@gmail.com',
  'Slave',
  'Hall Boy',
  0,
  4710,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '1'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '1'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- SUPERSLave (pr.finsko@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'pr.finsko@gmail.com',
  'SUPERSLave',
  'Hall Boy',
  31527,
  15425,
  1,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '38'), '{taskdom_completed_tasks}', '70'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '38'), '{taskdom_completed_tasks}', '70'), '{routine_streak}', '0');

-- Victor (thundervic7@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'thundervic7@gmail.com',
  'Victor',
  'Hall Boy',
  1250,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '24'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '24'), '{routine_streak}', '0');

-- Cory (pixipvp2@hotmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'pixipvp2@hotmail.com',
  'Cory',
  'Hall Boy',
  5,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Idiotic Monkey (b.harris346@yahoo.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'b.harris346@yahoo.com',
  'Idiotic Monkey',
  'Hall Boy',
  200,
  2400,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '25'), '{taskdom_completed_tasks}', '1'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '25'), '{taskdom_completed_tasks}', '1'), '{routine_streak}', '0');

-- Slave (orbyjoiner@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'orbyjoiner@gmail.com',
  'Slave',
  'Hall Boy',
  0,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Sydny (sydstarkschloss@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'sydstarkschloss@gmail.com',
  'Sydny',
  'Hall Boy',
  275,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Dloyd (dlloyd1991stan@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'dlloyd1991stan@gmail.com',
  'Dloyd',
  'Hall Boy',
  1560,
  0,
  0, 'https://upcdn.io/kW2K8hR/raw/uploads/2026/01/04/4jFfzn8xGB-IMG_2389.jpeg',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '21'), '{taskdom_completed_tasks}', '7'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '21'), '{taskdom_completed_tasks}', '7'), '{routine_streak}', '0');

-- Nick (nicox1688@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'nicox1688@gmail.com',
  'Nick',
  'Hall Boy',
  1010,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Andrew (temujin8585@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'temujin8585@gmail.com',
  'Andrew',
  'Hall Boy',
  0,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Zelda (trncinacity@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'trncinacity@gmail.com',
  'Zelda',
  'Hall Boy',
  26100,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Evgenii (dexter.savage555@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, avatar_url, parameters)
VALUES (
  gen_random_uuid(),
  'dexter.savage555@gmail.com',
  'Evgenii',
  'Silverman',
  5010,
  -130,
  0, 'https://upcdn.io/kW2K8hR/raw/uploads/2025/12/30/4jGLuMJ8Fj-1000065720.jpg',
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '87'), '{taskdom_completed_tasks}', '7'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  avatar_url = EXCLUDED.avatar_url,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '87'), '{taskdom_completed_tasks}', '7'), '{routine_streak}', '0');

-- Matt (mattie2715@icloud.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'mattie2715@icloud.com',
  'Matt',
  'Hall Boy',
  200,
  2940,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '4'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '4'), '{routine_streak}', '0');

-- Idiotic Monkey! (b.harris346@yahoo.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'b.harris346@yahoo.com',
  'Idiotic Monkey!',
  'Chamberlain',
  35360,
  10980,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '78'), '{taskdom_completed_tasks}', '1'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '78'), '{taskdom_completed_tasks}', '1'), '{routine_streak}', '0');

-- David (david.park.cinnabarfl@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'david.park.cinnabarfl@gmail.com',
  'David',
  'Hall Boy',
  0,
  700,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Dave (daveinnh4561@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'daveinnh4561@gmail.com',
  'Dave',
  'Hall Boy',
  50,
  4570,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '2'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '2'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Daniel (dplayinghard@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'dplayinghard@gmail.com',
  'Daniel',
  'Hall Boy',
  0,
  5020,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '2'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '2'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Michael (michaelhabby@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'michaelhabby@gmail.com',
  'Michael',
  'Hall Boy',
  222,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Slave (sebastian.prass@gmx.de)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'sebastian.prass@gmx.de',
  'Slave',
  'Hall Boy',
  0,
  4990,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Kevin (kevdanielmartin@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'kevdanielmartin@gmail.com',
  'Kevin',
  'Hall Boy',
  0,
  990,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Benjamin (BBGoodrich@hotmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'BBGoodrich@hotmail.com',
  'Benjamin',
  'Hall Boy',
  0,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Perus (perus.duunari@luukku.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'perus.duunari@luukku.com',
  'Perus',
  'Hall Boy',
  0,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Slave (recruit0234@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'recruit0234@gmail.com',
  'Slave',
  'Hall Boy',
  0,
  4990,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '1'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '1'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- New Ian (itisanemptyset@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'itisanemptyset@gmail.com',
  'New Ian',
  'Hall Boy',
  150,
  4080,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '3'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '3'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Wolfie (wolfie9825@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'wolfie9825@gmail.com',
  'Wolfie',
  'Hall Boy',
  0,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- SEBO (thesamuraiemperor@proton.me)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'thesamuraiemperor@proton.me',
  'SEBO',
  'Hall Boy',
  27120,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '5'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '5'), '{routine_streak}', '0');

-- Brennen (colby.mitchell18@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'colby.mitchell18@gmail.com',
  'Brennen',
  'Hall Boy',
  1142,
  0,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '6'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '6'), '{routine_streak}', '0');

-- Foxiko (foxikosfoxiko@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'foxikosfoxiko@gmail.com',
  'Foxiko',
  'Hall Boy',
  49820,
  560,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- NIK (lordroy808@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'lordroy808@gmail.com',
  'NIK',
  'Hall Boy',
  0,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Nicholas (nicox1688@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'nicox1688@gmail.com',
  'Nicholas',
  'Hall Boy',
  0,
  5000,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');

-- Guus (guusj88@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'guusj88@gmail.com',
  'Guus',
  'Hall Boy',
  5180,
  140,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '129'), '{taskdom_completed_tasks}', '6'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '129'), '{taskdom_completed_tasks}', '6'), '{routine_streak}', '0');

-- Karlo (ralflichtner364@gmail.com)
INSERT INTO profiles (id, member_id, name, hierarchy, score, wallet, strike_count, parameters)
VALUES (
  gen_random_uuid(),
  'ralflichtner364@gmail.com',
  'Karlo',
  'Hall Boy',
  0,
  4400,
  0,
  jsonb_set(jsonb_set(jsonb_set('{}', '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0')
)
ON CONFLICT (member_id) DO UPDATE SET
  name = EXCLUDED.name,
  hierarchy = EXCLUDED.hierarchy,
  score = EXCLUDED.score,
  wallet = EXCLUDED.wallet,
  strike_count = EXCLUDED.strike_count,
  parameters = jsonb_set(jsonb_set(jsonb_set(COALESCE(profiles.parameters, '{}'), '{kneel_count}', '0'), '{taskdom_completed_tasks}', '0'), '{routine_streak}', '0');