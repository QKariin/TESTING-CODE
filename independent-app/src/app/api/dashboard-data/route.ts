import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { getMasterData } from '@/actions/velo-actions';
import { getCallerEmail, isCEO } from '@/lib/api-auth';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId');

        const users = await getMasterData();
        const tributes = await DbService.getRecentTributes(50).catch(() => []);
        const reviewQueue = await DbService.getReviewQueue().catch(() => []);

        // If memberId is provided, fetch specific profile
        let profile = null;
        if (memberId) {
            console.log('[dashboard-data] fetching profile for:', memberId);
            profile = await DbService.getProfile(memberId);
            console.log('[dashboard-data] profile result:', profile ? `found (${profile.name}, score=${profile.score})` : 'NULL - no match');
        }

        return NextResponse.json({
            users: users || [],
            globalTributes: tributes || [],
            globalQueue: reviewQueue || [],
            profile,
            availableDailyTasks: [],
            status: 'success'
        });
    } catch (error) {
        console.error('Dashboard data fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
