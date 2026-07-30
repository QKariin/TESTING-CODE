import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import HomeClient from './HomeClient';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: 'Queen Karin — Femdom, Findom & Female Domination',
    description: 'Enter the world of Queen Karin. Real femdom, findom & female domination. Custom-built app with chastity keyholding, daily task training, hierarchy ranking, merit scoring & a live leaderboard. No agencies, no bots, no fakes. One Dominant. One system. Built from scratch.',
    openGraph: {
        title: 'Queen Karin — Femdom, Findom & Female Domination',
        description: 'Enter the world of Queen Karin. Real femdom, findom & female domination. No agencies, no bots, no fakes.',
        url: 'https://throne.qkarin.com/home',
    },
};

async function getReviews() {
    try {
        const { data: reviews } = await supabaseAdmin
            .from('reviews')
            .select('id, member_id, text, rating, created_at')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (!reviews || reviews.length === 0) return [];

        const emails = reviews.map((r: any) => (r.member_id || '').toLowerCase().trim());
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('member_id, name, avatar_url, score, hierarchy, joined_date')
            .in('member_id', emails);
        const { data: tasks } = await supabaseAdmin
            .from('tasks')
            .select('member_id, Taskdom_CompletedTasks, kneelCount')
            .in('member_id', emails);

        const profileMap = new Map<string, any>();
        (profiles || []).forEach((p: any) => profileMap.set((p.member_id || '').toLowerCase(), p));
        const taskMap = new Map<string, { tasks: number; kneels: number }>();
        (tasks || []).forEach((t: any) => taskMap.set((t.member_id || '').toLowerCase(), {
            tasks: Number(t.Taskdom_CompletedTasks || 0),
            kneels: Number(t.kneelCount || 0),
        }));

        return reviews.map((r: any) => {
            const email = (r.member_id || '').toLowerCase().trim();
            const profile = profileMap.get(email);
            const taskData = taskMap.get(email) || { tasks: 0, kneels: 0 };

            let servingText = '';
            const joinedDate = profile?.joined_date;
            if (joinedDate) {
                const days = Math.floor((Date.now() - new Date(joinedDate).getTime()) / 86400000);
                if (days < 1) servingText = 'today';
                else if (days < 30) servingText = `${days} days`;
                else if (days < 365) servingText = `${Math.floor(days / 30)} months`;
                else {
                    const yrs = Math.floor(days / 365);
                    const mos = Math.floor((days % 365) / 30);
                    servingText = mos > 0 ? `${yrs} ${yrs === 1 ? 'year' : 'years'} ${mos} ${mos === 1 ? 'month' : 'months'}` : `${yrs} ${yrs === 1 ? 'year' : 'years'}`;
                }
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
                    tasksCompleted: taskData.tasks,
                    kneelCount: taskData.kneels,
                    servingText,
                },
            };
        });
    } catch {
        return [];
    }
}

export default async function HomePage() {
    const reviews = await getReviews();
    return <HomeClient initialReviews={reviews} />;
}
