/**
 * fix-message-avatars.ts
 * Updates global_messages.sender_avatar rows that still contain email-based
 * filenames to the current profiles.avatar_url value.
 *
 * Run: npx tsx scripts/fix-message-avatars.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
    const envPath = path.join(__dirname, '../independent-app/.env.local');
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
            const [key, ...rest] = line.split('=');
            if (key && rest.length && !process.env[key.trim()]) {
                process.env[key.trim()] = rest.join('=').trim();
            }
        }
    }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    // 1. Find messages with email-based sender_avatar
    const { data: messages, error } = await supabase
        .from('global_messages')
        .select('id, sender_email, sender_avatar')
        .like('sender_avatar', '%@%');

    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!messages?.length) { console.log('No messages with email-based avatars found.'); return; }

    console.log(`Found ${messages.length} messages to fix.\n`);

    // 2. Get unique sender emails and look up current avatar_url
    const emails = [...new Set(messages.map((m: any) => m.sender_email?.toLowerCase()).filter(Boolean))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('member_id, avatar_url')
        .in('member_id', emails);

    const avatarMap = new Map((profiles || []).map((p: any) => [p.member_id?.toLowerCase(), p.avatar_url]));

    let fixed = 0, skipped = 0;

    for (const msg of messages) {
        const email = msg.sender_email?.toLowerCase();
        const newAvatar = avatarMap.get(email) || null;

        if (!newAvatar || newAvatar === msg.sender_avatar) {
            console.log(`[SKIP] No updated avatar for ${email}`);
            skipped++;
            continue;
        }

        const { error: updateErr } = await supabase
            .from('global_messages')
            .update({ sender_avatar: newAvatar })
            .eq('id', msg.id);

        if (updateErr) {
            console.error(`[FAIL] msg ${msg.id}: ${updateErr.message}`);
        } else {
            console.log(`[OK] msg ${msg.id} — ${email}`);
            fixed++;
        }
    }

    console.log(`\nDone. ${fixed} fixed, ${skipped} skipped.`);
}

main().catch(console.error);
