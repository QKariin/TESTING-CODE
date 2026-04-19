import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/altar?memberId=user@example.com
// Returns the top 3 approved tasks sorted by meritAwarded (highest first)
// with pre-signed image URLs — lightweight endpoint for instant altar display.
export async function GET(req: NextRequest) {
    const memberId = req.nextUrl.searchParams.get('memberId');
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data, error } = await supabaseAdmin
            .from('tasks')
            .select('Taskdom_History')
            .or(isUUID ? `ID.eq.${memberId}` : `member_id.ilike.${memberId}`)
            .maybeSingle();

        if (error || !data) return NextResponse.json({ top3: [] });

        let history: any[] = [];
        const raw = data['Taskdom_History'];
        if (typeof raw === 'string' && raw) {
            try { history = JSON.parse(raw); } catch { history = []; }
        } else if (Array.isArray(raw)) {
            history = raw;
        }

        // Filter approved tasks with valid proof images
        const approved = history.filter((t: any) =>
            t.status === 'approve' &&
            t.proofUrl &&
            t.proofUrl !== 'SKIPPED' &&
            t.proofUrl !== 'FORCED' &&
            !t.proofUrl.startsWith('failed')
        );

        // Sort by meritAwarded descending, tiebreak by timestamp
        approved.sort((a: any, b: any) => {
            const dm = (b.meritAwarded || 0) - (a.meritAwarded || 0);
            if (dm !== 0) return dm;
            return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });

        const top3 = approved.slice(0, 3);

        // Sign URLs server-side
        const PRIVATE_PREFIXES = ['task-proofs/', 'admin-chat/', 'chat-media/', 'challenge-proofs/'];
        const isPrivate = (path: string) => PRIVATE_PREFIXES.some(p => path.includes(p));

        const signed = await Promise.all(top3.map(async (t: any) => {
            let url = t.proofUrl;
            let thumbUrl = t.thumbnail_url || null;

            // Extract bucket/path from Supabase URL
            const extractBucketPath = (rawUrl: string) => {
                // Handle /api/media/url paths
                if (rawUrl.startsWith('/api/media/url')) {
                    const qs = rawUrl.split('?')[1] || '';
                    const params = new URLSearchParams(qs);
                    return { bucket: params.get('bucket') || 'media', path: params.get('path') || params.get('url') || '' };
                }
                // Handle full Supabase storage URLs
                const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/?]+)\/([^?]+)/);
                if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
                // Assume media bucket with raw path
                if (!rawUrl.startsWith('http')) return { bucket: 'media', path: rawUrl };
                return null;
            };

            const signUrl = async (rawUrl: string) => {
                const parsed = extractBucketPath(rawUrl);
                if (!parsed || !parsed.path) return rawUrl;

                if (parsed.bucket === 'proofs' || isPrivate(parsed.path)) {
                    const { data: signed } = await supabaseAdmin.storage
                        .from(parsed.bucket)
                        .createSignedUrl(parsed.path, 7200);
                    return signed?.signedUrl || `/api/media?bucket=${parsed.bucket}&path=${encodeURIComponent(parsed.path)}`;
                }

                const { data: pub } = supabaseAdmin.storage.from(parsed.bucket).getPublicUrl(parsed.path);
                return pub?.publicUrl || rawUrl;
            };

            try { url = await signUrl(url); } catch { /* keep original */ }
            if (thumbUrl) {
                try { thumbUrl = await signUrl(thumbUrl); } catch { /* keep original */ }
            }

            return {
                proofUrl: url,
                thumbnailUrl: thumbUrl,
                proofType: t.proofType || 'image',
                meritAwarded: t.meritAwarded || 0,
                text: t.text || '',
            };
        }));

        return NextResponse.json({ top3: signed });
    } catch (err: any) {
        console.error('[altar] error:', err.message);
        return NextResponse.json({ top3: [] });
    }
}
