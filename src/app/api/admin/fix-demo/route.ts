import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Reset profile to exactly what a real new member gets on entrance
    const { error } = await supabaseAdmin
        .from('profiles')
        .update({
            hierarchy: 'Hall Boy',
            score: 0,
            wallet: 4999,
            parameters: { devotion: 100, promo72h: true, welcome_pending: true, isDemo: true },
        })
        .ilike('member_id', 'demo@qkarin.com');

    // Reset tasks to clean slate
    await supabaseAdmin
        .from('tasks')
        .update({
            Status: 'idle',
            Taskdom_History: '[]',
            taskdom_active_task: null,
            taskdom_pending_state: null,
            'Daily Score': 0,
            'Weekly Score': 0,
            'Monthly Score': 0,
            'Score': 0,
            kneelCount: 0,
            lastWorship: null,
            'today kneeling': 0,
        })
        .ilike('member_id', 'demo@qkarin.com');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, note: 'Demo fixed. Delete this route.' });
}
