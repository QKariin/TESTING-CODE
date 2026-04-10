import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, name, wallet, hierarchy, parameters } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const lowerEmail = email.toLowerCase();

    // 0. Create Supabase Auth user so they can actually log in
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: lowerEmail,
        email_confirm: true,
    });

    // If already registered, look up their existing auth user
    let userId: string;
    if (authError) {
        if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
            const existing = users.find(u => u.email?.toLowerCase() === lowerEmail);
            if (!existing) return NextResponse.json({ error: `Auth user not found: ${authError.message}` }, { status: 500 });
            userId = existing.id;
        } else {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }
    } else {
        userId = authData.user.id;
    }

    // 1. Check if profile already exists (by email)
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, member_id')
        .ilike('member_id', lowerEmail)
        .maybeSingle();

    if (existingProfile) {
        // Profile exists — just link it to the auth user
        const { error: linkError } = await supabaseAdmin
            .from('profiles')
            .update({ id: userId, member_id: lowerEmail })
            .eq('id', existingProfile.id);
        if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
    } else {
        // Create fresh profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                member_id: lowerEmail,
                name: name || lowerEmail.split('@')[0],
                hierarchy: hierarchy || 'Hall Boy',
                score: 0,
                wallet: wallet ?? 5000,
                parameters: { devotion: 100, ...(parameters || {}) },
            });
        if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // 2. Insert into tasks (only if not already there)
    const { data: existingTask } = await supabaseAdmin
        .from('tasks')
        .select('member_id')
        .ilike('member_id', lowerEmail)
        .maybeSingle();

    if (!existingTask) {
        const { error: taskError } = await supabaseAdmin
            .from('tasks')
            .insert({
                member_id: lowerEmail,
                Name: name || lowerEmail.split('@')[0],
                Status: 'idle',
                Taskdom_History: '[]',
                taskdom_active_task: null,
                taskdom_pending_state: null,
            });
        if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
}
