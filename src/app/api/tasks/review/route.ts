// src/app/api/tasks/review/route.ts
import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { submissionId, memberId, action, bonus } = await req.json();

        if (!submissionId || !memberId || !action) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        if (action === 'approve') {
            const points = typeof bonus === 'number' ? bonus : 500;
            await DbService.approveTask(submissionId, memberId, points, null, null);
            return NextResponse.json({ success: true, action: 'approve', pointsAwarded: points });
        }

        if (action === 'reject') {
            await DbService.rejectTask(submissionId, memberId);
            return NextResponse.json({ success: true, action: 'reject', penaltyApplied: 300 });
        }

        return NextResponse.json({ success: false, error: 'Invalid action. Use approve or reject.' }, { status: 400 });

    } catch (error: any) {
        console.error('Task Review Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
