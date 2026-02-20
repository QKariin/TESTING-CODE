import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId');

        const [users, tributes, reviewQueue, profile] = await Promise.all([
            DbService.getAllProfiles(),
            DbService.getRecentTributes(50),
            DbService.getReviewQueue(),
            memberId ? DbService.getProfile(memberId) : Promise.resolve(null)
        ]);

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
