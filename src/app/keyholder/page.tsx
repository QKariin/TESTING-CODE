import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import KeyholderClient from './KeyholderClient';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: 'Online Chastity Keyholding — Queen Karin',
    description: 'Professional online chastity keyholding with dynamic lock timers, daily check-ins, obedience tasks, and real-time control. Weekly, monthly & quarterly subscriptions. Custom app by Queen Karin — not a timer, a real Dominant managing your lock.',
    openGraph: {
        title: 'Online Chastity Keyholding — Queen Karin',
        description: 'Professional online chastity keyholding with dynamic lock timers, daily check-ins, and real-time control by Queen Karin.',
        url: 'https://throne.qkarin.com/keyholder',
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

export default async function KeyholderPage() {
    const reviews = await getReviews();
    return <KeyholderClient initialReviews={reviews} />;
}
