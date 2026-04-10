import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCallerEmail, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const caller = await getCallerEmail();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, name, wallet, hierarchy, parameters } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    // 1. Insert into profiles
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
            member_id: email,
            name: name || email.split('@')[0],
            hierarchy: hierarchy || 'Hall Boy',
            score: 0,
            wallet: wallet ?? 5000,
            parameters: { devotion: 100, ...(parameters || {}) },
        });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    // 2. Insert into tasks
    const { error: taskError } = await supabaseAdmin
        .from('tasks')
        .insert({
            member_id: email,
            Name: name || email.split('@')[0],
            Status: 'idle',
            Taskdom_History: '[]',
            taskdom_active_task: null,
            taskdom_pending_state: null,
        });
    if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
