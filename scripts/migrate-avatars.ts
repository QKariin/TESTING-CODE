/**
 * migrate-avatars.ts
 * Renames existing avatar files from email-based names to profile-id-based names.
 * Uses Supabase Storage copy+remove (not direct SQL rename) so CDN stays consistent.
 *
 * Run with:
 *   cd /Users/liviacechova/antigravity/TESTING-CODE
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/migrate-avatars.ts
 *
 * Or just: npx tsx scripts/migrate-avatars.ts  (reads from independent-app/.env.local)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env from independent-app/.env.local if not already set
function loadEnv() {
    const envPath = path.join(__dirname, '../independent-app/.env.local');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
            const [key, ...rest] = line.split('=');
            if (key && rest.length && !process.env[key.trim()]) {
                process.env[key.trim()] = rest.join('=').trim();
            }
        }
    }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET = 'media';

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    if (dryRun) console.log('--- DRY RUN MODE (no changes will be made) ---\n');

    // Get all profiles that have an email in their avatar_url
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, member_id, avatar_url')
        .like('avatar_url', '%@%');

    if (error) {
        console.error('Failed to fetch profiles:', error.message);
        process.exit(1);
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profiles with email-based avatar URLs found. Nothing to do.');
        return;
    }

    console.log(`Found ${profiles.length} profiles to migrate.\n`);

    let success = 0;
    let failed = 0;

    for (const profile of profiles) {
        const { id, member_id, avatar_url } = profile;

        // Extract storage path from URL: .../storage/v1/object/public/media/avatars/...
        const match = avatar_url?.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
        if (!match) {
            console.warn(`[SKIP] ${member_id}: can't parse path from URL: ${avatar_url}`);
            continue;
        }

        const oldPath = match[1]; // e.g. avatars/email@example.com_1234567890.jpg

        // Extract timestamp+extension: everything after the last underscore followed by digits
        const tsExtMatch = oldPath.match(/_(\d+\..+)$/);
        if (!tsExtMatch) {
            console.warn(`[SKIP] ${member_id}: can't extract timestamp from: ${oldPath}`);
            continue;
        }

        const tsExt = tsExtMatch[1]; // e.g. 1234567890.jpg
        const newPath = `avatars/${id}_${tsExt}`; // e.g. avatars/9e465afb-..._1234567890.jpg

        const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newPath}`;

        console.log(`[${dryRun ? 'DRY' : 'MIGRATING'}] ${member_id}`);
        console.log(`  old: ${oldPath}`);
        console.log(`  new: ${newPath}`);

        if (dryRun) {
            console.log();
            continue;
        }

        // 1. Copy file to new path
        const { error: copyError } = await supabase.storage
            .from(BUCKET)
            .copy(oldPath, newPath);

        if (copyError) {
            console.error(`  [FAIL] copy failed: ${copyError.message}`);
            failed++;
            continue;
        }

        // 2. Update profiles.avatar_url
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: newUrl })
            .eq('id', id);

        if (updateError) {
            console.error(`  [FAIL] DB update failed: ${updateError.message}`);
            // Try to clean up the copy we just made
            await supabase.storage.from(BUCKET).remove([newPath]);
            failed++;
            continue;
        }

        // 3. Delete old file
        const { error: removeError } = await supabase.storage
            .from(BUCKET)
            .remove([oldPath]);

        if (removeError) {
            // Non-fatal — new file is in place and DB is updated, old file is just orphaned
            console.warn(`  [WARN] old file not deleted: ${removeError.message}`);
        }

        console.log(`  [OK]`);
        success++;
        console.log();
    }

    console.log(`\nDone. ${success} migrated, ${failed} failed.`);
}

main().catch(console.error);
