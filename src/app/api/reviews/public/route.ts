import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { data: reviews, error } = await supabaseAdmin
            .from('reviews')
            .select('id, member_id, text, rating, created_at')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!reviews || reviews.length === 0) {
            return NextResponse.json({ success: true, reviews: [] });
        }

        // Enrich each review with profile data directly
        const publicReviews = [];
        for (const r of reviews) {
            const email = (r.member_id || '').toLowerCase().trim();
            const shortKey = email.split('@')[0]?.split('.')[0] || '';

            // Lookup profile
            let profile: any = null;
            if (shortKey) {
                const { data: pData } = await supabaseAdmin
                    .from('profiles')
                    .select('name, avatar_url, score, hierarchy, joined_date')
                    .ilike('member_id', `%${shortKey}%`)
                    .limit(1);
                if (pData && pData.length > 0) profile = pData[0];
            }

            // Get completed tasks from tasks table
            let taskCount = 0;
            if (shortKey) {
                const { data: tData } = await supabaseAdmin
                    .from('tasks')
                    .select('Taskdom_CompletedTasks')
                    .ilike('member_id', `%${shortKey}%`)
                    .limit(1);
                if (tData && tData[0]) taskCount = Number(tData[0].Taskdom_CompletedTasks || 0);
            }

            // Calculate serving duration from joined_date
            let servingText = '';
            const joinedDate = profile?.joined_date;
            if (joinedDate) {
                const days = Math.floor((Date.now() - new Date(joinedDate).getTime()) / 86400000);
                if (days < 1) servingText = 'today';
                else if (days < 30) servingText = `${days} days`;
                else if (days < 365) servingText = `${Math.floor(days / 30)} months`;
                else servingText = `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`;
            }

            publicReviews.push({
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
            });
        }

        return NextResponse.json({ success: true, reviews: publicReviews });

    } catch (err: any) {
        console.error('[Reviews] Public fetch error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
