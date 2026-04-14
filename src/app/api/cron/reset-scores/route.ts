import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Runs daily at 22:59 UTC = 23:59 CET (Europe/Prague)
export async function GET(req: Request) {
    // Auth check - only enforced if CRON_SECRET is actually set and non-empty
    const envSecret = (process.env.CRON_SECRET || '').trim();
    if (envSecret) {
        const authHeader = req.headers.get('authorization') || '';
        const incoming = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
        if (incoming !== envSecret) {
            console.error('[cron/reset-scores] Unauthorized. incoming:', JSON.stringify(incoming), 'expected:', JSON.stringify(envSecret));
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    console.log('[cron/reset-scores] Fired at UTC:', new Date().toISOString());

    // Get current time in Prague timezone
    const now = new Date();
    const pragueTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
    const dayOfWeek = pragueTime.getDay(); // 0=Sunday
    const date = pragueTime.getDate();
    const month = pragueTime.getMonth() + 1;
    const year = pragueTime.getFullYear();
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    const resets: string[] = ['Daily Score']; // Always reset daily
    if (dayOfWeek === 0) resets.push('Weekly Score');
    if (date === lastDayOfMonth) resets.push('Monthly Score');
    if (month === 12 && date === 31) resets.push('Yearly Score');

    const updates: Record<string, number> = {};
    for (const field of resets) updates[field] = 0;

    console.log('[cron/reset-scores] Resetting fields:', resets, 'Prague time:', pragueTime.toISOString());

    // Use .not('member_id','is',null) - cleaner than neq to empty string
    const { error, count } = await supabaseAdmin
        .from('tasks')
        .update(updates)
        .not('member_id', 'is', null)
        .select('member_id', { count: 'exact', head: true });

    if (error) {
        console.error('[cron/reset-scores] Supabase error:', error.message, error.details);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[cron/reset-scores] Success. Rows affected: ${count ?? 'unknown'}. Reset: ${resets.join(', ')}`);
    return NextResponse.json({ success: true, reset: resets, rowsAffected: count });
}
