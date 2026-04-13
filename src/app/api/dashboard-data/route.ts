import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { getMasterData } from '@/actions/velo-actions';
import { cached } from '@/lib/api-cache';

export const dynamic = "force-dynamic";

const USERS_TTL  = 120_000;  // 2min — user list
const QUEUE_TTL  = 300_000;  // 5min — review queue (each refresh loads all task proof images from storage)
const TRIBUTE_TTL = 300_000; // 5min — tributes change infrequently

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId');

        const [users, tributes, reviewQueue] = await Promise.all([
            cached('dashboard:users', USERS_TTL, () => getMasterData()),
            cached('dashboard:tributes', TRIBUTE_TTL, () => DbService.getRecentTributes(50).catch(() => [])),
            cached('dashboard:queue', QUEUE_TTL, () => DbService.getReviewQueue().catch(() => [])),
        ]);

        // Per-member profile is never cached — always fresh
        let profile = null;
        if (memberId) {
            profile = await DbService.getProfile(memberId);
        }

        return NextResponse.json({
            users: users || [],
            globalTributes: tributes || [],
            globalQueue: reviewQueue || [],
            profile,
            availableDailyTasks: [],
            status: 'success'
        }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
    } catch (error) {
        console.error('Dashboard data fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
