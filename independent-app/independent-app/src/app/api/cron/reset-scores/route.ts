import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Runs daily at 22:59 UTC = 23:59 CET (Europe/Prague)
// Determines which period resets to apply based on Prague local time
export async function GET(req: Request) {
    const secret = req.headers.get('authorization')?.replace('Bearer ', '');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current time in Prague timezone
    const now = new Date();
    const pragueTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
    const dayOfWeek = pragueTime.getDay(); // 0=Sunday
    const date = pragueTime.getDate();
    const month = pragueTime.getMonth() + 1; // 1-based
    const year = pragueTime.getFullYear();

    // Determine last day of current month
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const resets: string[] = ['Daily Score']; // Always reset daily

    if (dayOfWeek === 0) resets.push('Weekly Score');           // Sunday
    if (date === lastDayOfMonth) resets.push('Monthly Score');  // Last day of month
    if (month === 12 && date === 31) resets.push('Yearly Score'); // Dec 31

    const updates: Record<string, number> = {};
    for (const field of resets) updates[field] = 0;

    const { error } = await supabaseAdmin.from('tasks').update(updates).neq('member_id', '');

    if (error) {
        console.error('[cron/reset-scores] error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[cron/reset-scores] Reset: ${resets.join(', ')} at Prague time ${pragueTime.toISOString()}`);
    return NextResponse.json({ success: true, reset: resets });
}
