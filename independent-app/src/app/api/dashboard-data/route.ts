import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';

export async function GET() {
    try {
        const [users, tributes, reviewQueue] = await Promise.all([
            DbService.getAllProfiles(),
            DbService.getRecentTributes(50),
            DbService.getReviewQueue()
        ]);

        return NextResponse.json({
            users: users || [],
            globalTributes: tributes || [],
            globalQueue: reviewQueue || [],
            availableDailyTasks: [],
            status: 'success'
        });
    } catch (error) {
        console.error('Dashboard data fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
