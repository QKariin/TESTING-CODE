import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DEMO_EMAIL = 'demo@qkarin.com';
const DEMO_PASSWORD = 'QKarin2026!';

export async function GET() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user with confirmed email + password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
    });

    let userId: string;
    if (authError) {
        if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
            const existing = users.find(u => u.email?.toLowerCase() === DEMO_EMAIL);
            if (!existing) return NextResponse.json({ error: authError.message }, { status: 500 });
            userId = existing.id;
        } else {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }
    } else {
        userId = authData.user.id;
    }

    // Create profile (skip if exists)
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('ID')
        .ilike('member_id', DEMO_EMAIL)
        .maybeSingle();

    if (!existingProfile) {
        await supabaseAdmin.from('profiles').insert({
            ID: userId,
            member_id: DEMO_EMAIL,
            name: 'Demo',
            hierarchy: 'Devotee',
            score: 1240,
            wallet: 4999,
            parameters: {
                devotion: 100,
                rank: 'Devotee',
            },
        });
    }

    // Create tasks row (skip if exists)
    const { data: existingTask } = await supabaseAdmin
        .from('tasks')
        .select('member_id')
        .ilike('member_id', DEMO_EMAIL)
        .maybeSingle();

    if (!existingTask) {
        await supabaseAdmin.from('tasks').insert({
            ID: userId,
            member_id: DEMO_EMAIL,
            Name: 'Demo',
            Status: 'idle',
            Taskdom_History: '[]',
            taskdom_active_task: null,
            taskdom_pending_state: null,
        });
    }

    return NextResponse.json({
        success: true,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        note: 'Account ready. Delete this route when done.',
    });
}
