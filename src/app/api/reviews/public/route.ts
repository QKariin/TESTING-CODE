import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

// ── In-memory cache shared across warm invocations ──
let cachedReviews: any[] | null = null;
let cacheTime = 0;

/** Called by submit/moderate routes to bust the cache */
export function invalidateReviewsCache() {
    cachedReviews = null;
    cacheTime = 0;
}

async function buildReviews(): Promise<any[]> {
    const { data: reviews, error } = await supabaseAdmin
        .from('reviews')
        .select('id, member_id, text, rating, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

    if (error) throw error;
    if (!reviews || reviews.length === 0) return [];

    // Batch-fetch all profiles and tasks in 2 queries instead of N+1
    const emails = reviews.map((r: any) => (r.member_id || '').toLowerCase().trim());
    const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('member_id, name, avatar_url, score, hierarchy, joined_date')
        .in('member_id', emails);
    const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('member_id, Taskdom_CompletedTasks')
        .in('member_id', emails);

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set((p.member_id || '').toLowerCase(), p));
    const taskMap = new Map<string, number>();
    (tasks || []).forEach((t: any) => taskMap.set((t.member_id || '').toLowerCase(), Number(t.Taskdom_CompletedTasks || 0)));

    return reviews.map((r: any) => {
        const email = (r.member_id || '').toLowerCase().trim();
        const profile = profileMap.get(email);
        const taskCount = taskMap.get(email) || 0;

        let servingText = '';
        const joinedDate = profile?.joined_date;
        if (joinedDate) {
            const days = Math.floor((Date.now() - new Date(joinedDate).getTime()) / 86400000);
            if (days < 1) servingText = 'today';
            else if (days < 30) servingText = `${days} days`;
            else if (days < 365) servingText = `${Math.floor(days / 30)} months`;
            else servingText = `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`;
        }

        return {
            id: r.id,
            text: r.text,
            rating: r.rating,
            reviewedAt: r.created_at,
            reviewer: {
                name: profile?.name || 'Loyal Subject',
                avatar: profile?.avatar_url || null,
                hierarchy: profile?.hierarchy || 'Hall Boy',
                merit: profile?.score || 0,
                tasksCompleted: taskCount,
                servingText,
            },
        };
    });
}

export async function GET() {
    try {
        // Serve from cache if available (invalidated on submit/moderate)
        if (cachedReviews && cacheTime > 0) {
            return NextResponse.json({ success: true, reviews: cachedReviews });
        }

        const publicReviews = await buildReviews();
        cachedReviews = publicReviews;
        cacheTime = Date.now();

        return NextResponse.json({ success: true, reviews: publicReviews });

    } catch (err: any) {
        console.error('[Reviews] Public fetch error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
