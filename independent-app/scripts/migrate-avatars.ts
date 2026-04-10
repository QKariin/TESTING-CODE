/**
 * migrate-avatars.ts
 * Downloads each avatar from its email-based public URL and re-uploads it
 * to a UUID-based path. This bypasses storage metadata inconsistencies.
 *
 * Run: npx tsx scripts/migrate-avatars.ts [--dry-run]
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
    const dryRun = process.argv.includes('--dry-run');
    if (dryRun) console.log('--- DRY RUN ---\n');

    // Get all profiles that have email in their avatar_url
    // OR that have a UUID-based avatar_url that returns 404/400 (S3 not there)
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, member_id, avatar_url')
        .not('member_id', 'is', null)
        .not('avatar_url', 'is', null);

    if (error || !profiles) { console.error('Fetch failed:', error?.message); process.exit(1); }

    // For each profile, check if their avatar_url returns a working image
    // If not, try the email-based URL and migrate
    let success = 0, skipped = 0, failed = 0;

    for (const profile of profiles) {
        if (!profile.avatar_url || !profile.member_id) { skipped++; continue; }

        const currentUrl = profile.avatar_url;

        // Check if current avatar_url actually works
        let currentWorks = false;
        try {
            const check = await fetch(currentUrl, { method: 'HEAD' });
            currentWorks = check.ok;
        } catch { /* network error */ }

        if (currentWorks) {
            // If the URL already works and doesn't contain email, skip
            if (!currentUrl.includes('@')) {
                skipped++;
                continue;
            }
            // URL works but has email in it — still needs migration
        }

        // Extract old email-based path components from whatever URL we have
        // Try to reconstruct old email-based URL
        const urlMatch = currentUrl.match(/\/avatars\/(.+)$/);
        if (!urlMatch) { console.warn(`[SKIP] Can't parse URL: ${currentUrl}`); skipped++; continue; }

        const currentFilename = urlMatch[1];
        const tsExtMatch = currentFilename.match(/_(\d+\..+)$/);
        if (!tsExtMatch) { console.warn(`[SKIP] Can't extract timestamp: ${currentFilename}`); skipped++; continue; }

        const tsExt = tsExtMatch[1];
        const email = profile.member_id.toLowerCase();

        // Construct the email-based URL (what S3 actually has)
        const emailFilename = `${email}_${tsExt}`;
        const emailUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/avatars/${emailFilename}`;
        const newPath = `avatars/${profile.id}_${tsExt}`;
        const newUrl  = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newPath}`;

        // Verify email-based URL actually exists
        let emailWorks = false;
        try {
            const check = await fetch(emailUrl, { method: 'HEAD' });
            emailWorks = check.ok;
        } catch { /* network error */ }

        if (!emailWorks) {
            console.warn(`[SKIP] Source file not accessible: ${emailFilename}`);
            skipped++;
            continue;
        }

        console.log(`[${dryRun ? 'DRY' : 'MIGRATING'}] ${email}`);
        console.log(`  src: ${emailFilename}`);
        console.log(`  dst: ${profile.id}_${tsExt}`);

        if (dryRun) { console.log(); continue; }

        // Download the file content
        let fileBuffer: Buffer;
        let contentType = 'image/jpeg';
        try {
            const res = await fetch(emailUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            contentType = res.headers.get('content-type') || 'image/jpeg';
            fileBuffer = Buffer.from(await res.arrayBuffer());
        } catch (e: any) {
            console.error(`  [FAIL] download: ${e.message}`); failed++; continue;
        }

        // Upload to new UUID-based path
        const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(newPath, fileBuffer, { contentType, upsert: true });

        if (uploadErr) {
            console.error(`  [FAIL] upload: ${uploadErr.message}`); failed++; continue;
        }

        // Update profiles.avatar_url
        const { error: dbErr } = await supabase
            .from('profiles')
            .update({ avatar_url: newUrl })
            .eq('id', profile.id);

        if (dbErr) {
            console.error(`  [FAIL] db: ${dbErr.message}`);
            await supabase.storage.from(BUCKET).remove([newPath]);
            failed++; continue;
        }

        // Remove old storage objects (both email-named and any broken UUID-named ones)
        const oldEmailPath = `avatars/${emailFilename}`;
        const oldUuidPath  = `avatars/${currentFilename}`;
        const pathsToDelete = [...new Set([oldEmailPath, oldUuidPath].filter(p => p !== newPath))];
        await supabase.storage.from(BUCKET).remove(pathsToDelete);

        console.log(`  [OK]`); console.log();
        success++;
    }

    console.log(`Done. ${success} migrated, ${skipped} skipped (already OK), ${failed} failed.`);
}

main().catch(console.error);
