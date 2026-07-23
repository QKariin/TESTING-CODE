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

    // Find existing user or create new
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existing = users.find(u => u.email?.toLowerCase() === DEMO_EMAIL);

    let userId: string;

    if (existing) {
        // Update password on existing user
        userId = existing.id;
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: DEMO_PASSWORD,
            email_confirm: true,
        });
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    } else {
        // Create fresh
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            email_confirm: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        userId = data.user.id;
    }

    // Create profile if missing
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
            parameters: { devotion: 100 },
        });
    } else {
        // Make sure ID matches
        await supabaseAdmin.from('profiles').update({ ID: userId }).ilike('member_id', DEMO_EMAIL);
    }

    // Create tasks row if missing
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
        });
    }

    return NextResponse.json({
        success: true,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
    });
}
