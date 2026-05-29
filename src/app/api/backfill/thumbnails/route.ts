import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max for Vercel Pro

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|avif|bmp|heic)(\?|$)/i;
const VIDEO_EXTS = /\.(mp4|mov|webm|avi|mkv)(\?|$)/i;

function isImageUrl(url: string): boolean {
    // Also match /api/media/url?...path=....png style URLs
    if (url.startsWith('/api/media/url')) {
        return IMAGE_EXTS.test(decodeURIComponent(url));
    }
    return IMAGE_EXTS.test(url) && !VIDEO_EXTS.test(url);
}

/** Resolve relative /api/media/url paths to actual Supabase signed URLs */
async function resolveUrl(url: string): Promise<string> {
    if (!url.startsWith('/api/media/url')) return url;

    const parsed = new URL(url, 'https://throne.qkarin.com');
    const bucket = parsed.searchParams.get('bucket') || 'media';
    const path = parsed.searchParams.get('path');

    if (!path) return url;

    // Generate a signed URL directly via Supabase admin
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
        // Try public URL as fallback
        const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
        return publicUrl;
    }
    return data.signedUrl;
}

async function fetchAndResize(url: string): Promise<Buffer | null> {
    try {
        const resolved = await resolveUrl(url);
        const res = await fetch(resolved, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());

        // Dynamic import sharp — avoids build-time issues on Vercel
        let sharpMod: any;
        try { sharpMod = (await import('sharp')).default; } catch {
            // sharp unavailable — return original image as-is (still stores a thumbnail entry)
            return buf;
        }
        return await sharpMod(buf).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 60 }).toBuffer();
    } catch {
        return null;
    }
}

async function uploadThumb(thumbBuf: Buffer): Promise<string | null> {
    const filename = `task-thumbs/${crypto.randomUUID()}.jpg`;
    const { error } = await supabaseAdmin.storage.from('media').upload(filename, thumbBuf, {
        contentType: 'image/jpeg',
        upsert: false,
    });
    if (error) { console.error('[backfill] upload error:', error.message); return null; }
    const { data: { publicUrl } } = supabaseAdmin.storage.from('media').getPublicUrl(filename);
    return publicUrl;
}

// GET /api/backfill/thumbnails?limit=20&source=routines|tasks|both&dry=true
export async function GET(req: Request) {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '10'), 50);
    const source = url.searchParams.get('source') || 'both';
    const dry = url.searchParams.get('dry') === 'true';

    const results: any[] = [];
    let processed = 0;
    let updated = 0;
    let skipped = 0;

    // ── USER_ROUTINES TABLE (JSONB history) ──
    if (source === 'routines' || source === 'both') {
        const { data: userRoutines } = await supabaseAdmin
            .from('user_routines')
            .select('member_id, history')
            .not('history', 'is', null)
            .limit(100);

        let routineCount = 0;
        for (const ur of userRoutines || []) {
            if (routineCount >= limit) break;
            const history: any[] = ur.history || [];
            let changed = false;

            for (const entry of history) {
                if (routineCount >= limit) break;
                if (entry.thumbnail_url) continue;
                if (!entry.proof_url || !isImageUrl(entry.proof_url)) { skipped++; continue; }
                if (entry.proof_type === 'video') { skipped++; continue; }
                processed++;
                routineCount++;

                if (dry) {
                    results.push({ type: 'routine', id: entry.id, url: entry.proof_url, action: 'would_process' });
                    continue;
                }

                const thumbBuf = await fetchAndResize(entry.proof_url);
                if (!thumbBuf) { results.push({ type: 'routine', id: entry.id, error: 'fetch_failed' }); continue; }

                const thumbUrl = await uploadThumb(thumbBuf);
                if (!thumbUrl) { results.push({ type: 'routine', id: entry.id, error: 'upload_failed' }); continue; }

                entry.thumbnail_url = thumbUrl;
                changed = true;
                updated++;
                results.push({ type: 'routine', id: entry.id, thumbUrl });
            }

            if (changed) {
                await supabaseAdmin.from('user_routines').update({ history }).eq('member_id', ur.member_id);
            }
        }
    }

    // ── TASKS TABLE (Taskdom_History JSON) ──
    if (source === 'tasks' || source === 'both') {
        const remaining = limit - processed;
        if (remaining > 0) {
            const { data: tasks } = await supabaseAdmin
                .from('tasks')
                .select('"ID", "Taskdom_History"')
                .not('Taskdom_History', 'is', null)
                .limit(100); // scan more rows since not all will have images needing thumbs

            let taskCount = 0;
            for (const task of tasks || []) {
                if (taskCount >= remaining) break;
                let history: any[];
                try {
                    history = typeof task.Taskdom_History === 'string'
                        ? JSON.parse(task.Taskdom_History)
                        : (task.Taskdom_History || []);
                } catch { continue; }

                let changed = false;
                for (const entry of history) {
                    if (taskCount >= remaining) break;
                    if (entry.thumbnail_url) continue;
                    if (!entry.proofUrl || !isImageUrl(entry.proofUrl)) continue;
                    if (entry.proofType === 'video') continue;

                    processed++;
                    taskCount++;

                    if (dry) {
                        results.push({ type: 'task', taskId: task.ID, entryId: entry.id, url: entry.proofUrl, action: 'would_process' });
                        continue;
                    }

                    const thumbBuf = await fetchAndResize(entry.proofUrl);
                    if (!thumbBuf) { results.push({ type: 'task', entryId: entry.id, error: 'fetch_failed' }); continue; }

                    const thumbUrl = await uploadThumb(thumbBuf);
                    if (!thumbUrl) { results.push({ type: 'task', entryId: entry.id, error: 'upload_failed' }); continue; }

                    entry.thumbnail_url = thumbUrl;
                    changed = true;
                    updated++;
                    results.push({ type: 'task', taskId: task.ID, entryId: entry.id, thumbUrl });
                }

                if (changed) {
                    await supabaseAdmin.from('tasks').update({ Taskdom_History: JSON.stringify(history) }).eq('ID', task.ID);
                }
            }
        }
    }

    return NextResponse.json({
        processed,
        updated,
        skipped,
        results,
        message: dry ? 'Dry run — no changes made' : `Done. ${updated} thumbnails created.`,
    });
}
