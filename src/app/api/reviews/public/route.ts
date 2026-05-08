import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Fetch approved reviews
        const { data: reviews, error } = await supabaseAdmin
            .from('reviews')
            .select('id, member_id, text, rating, created_at')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!reviews || reviews.length === 0) {
            return NextResponse.json({ success: true, reviews: [] });
        }

        // Collect unique member emails
        const emails = [...new Set(reviews.map((r: any) => r.member_id.toLowerCase()))];

        // Fetch profile data for all reviewers
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('ID, member_id, name, avatar_url, score, created_at')
            .in('member_id', emails);

        // Fetch task counts
        const { data: tasks } = await supabaseAdmin
            .from('tasks')
            .select('member_id, Taskdom_History')
            .in('member_id', emails);

        // Build lookup maps
        const profileMap = new Map<string, any>();
        for (const p of (profiles || [])) {
            profileMap.set(p.member_id?.toLowerCase(), p);
        }

        const taskCountMap = new Map<string, number>();
        for (const t of (tasks || [])) {
            const history = t.Taskdom_History;
            let count = 0;
            if (Array.isArray(history)) {
                count = history.filter((h: any) => h.status === 'approved').length;
            }
            taskCountMap.set(t.member_id?.toLowerCase(), count);
        }

        // Build public response — NO email, only review UUID
        const publicReviews = reviews.map((r: any) => {
            const email = r.member_id.toLowerCase();
            const profile = profileMap.get(email);
            const taskCount = taskCountMap.get(email) || 0;

            // Calculate serving duration
            const memberSince = profile?.created_at ? new Date(profile.created_at) : null;
            let servingText = '';
            if (memberSince) {
                const diffMs = Date.now() - memberSince.getTime();
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (days < 30) servingText = `${days} days`;
                else if (days < 365) servingText = `${Math.floor(days / 30)} months`;
                else servingText = `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`;
            }

            return {
                id: r.id,               // review UUID — safe to expose
                text: r.text,
                rating: r.rating,
                reviewedAt: r.created_at,
                reviewer: {
                    name: profile?.name || 'Loyal Subject',
                    avatar: profile?.avatar_url || null,
                    merit: profile?.score || 0,
                    tasksCompleted: taskCount,
                    servingSince: profile?.created_at || null,
                    servingText,
                },
            };
        });

        return NextResponse.json({ success: true, reviews: publicReviews });

    } catch (err: any) {
        console.error('[Reviews] Public fetch error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
