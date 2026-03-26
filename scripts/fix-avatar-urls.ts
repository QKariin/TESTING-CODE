/**
 * fix-avatar-urls.ts
 * For profiles whose avatar_url still has an email-based filename,
 * finds the already-uploaded UUID-based file in storage and updates the DB.
 *
 * Run: npx tsx scripts/fix-avatar-urls.ts
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
const BUCKET = 'media';

async function main() {
    // 1. Find profiles whose avatar_url still contains an email address
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, member_id, avatar_url')
        .like('avatar_url', '%@%');

    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
    if (!profiles?.length) { console.log('No broken profiles found — all good!'); return; }

    console.log(`Found ${profiles.length} profiles with email-based avatar_url:\n`);

    // 2. List all files in the avatars folder
    const { data: storageFiles, error: listErr } = await supabase.storage
        .from(BUCKET)
        .list('avatars', { limit: 500 });

    if (listErr) { console.error('Storage list failed:', listErr.message); process.exit(1); }

    // Build a map: profile UUID prefix → full storage filename
    const storageMap = new Map<string, string>();
    for (const file of storageFiles || []) {
        const uuidPrefix = file.name.split('_')[0];
        // Only store UUID-looking prefixes (not email addresses)
        if (!uuidPrefix.includes('@') && uuidPrefix.length > 8) {
            storageMap.set(uuidPrefix, file.name);
        }
    }

    let fixed = 0, notFound = 0;

    for (const profile of profiles) {
        const filename = storageMap.get(profile.id);
        if (!filename) {
            console.warn(`[NOT FOUND] No UUID file in storage for ${profile.member_id} (id: ${profile.id})`);
            notFound++;
            continue;
        }

        const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/avatars/${filename}`;
        console.log(`[FIX] ${profile.member_id}`);
        console.log(`  old: ${profile.avatar_url}`);
        console.log(`  new: ${newUrl}`);

        const { error: updateErr } = await supabase
            .from('profiles')
            .update({ avatar_url: newUrl })
            .eq('id', profile.id);

        if (updateErr) {
            console.error(`  [FAIL] ${updateErr.message}`);
        } else {
            console.log(`  [OK]`);
            fixed++;
        }
        console.log();
    }

    console.log(`Done. ${fixed} fixed, ${notFound} not found in storage.`);
}

main().catch(console.error);
