import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Sample the last 10 chats to see what member_id looks like
    const { data: chats, error: chatErr } = await admin
        .from('chats')
        .select('id, member_id, sender_email, type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    // Sample profiles to see what member_id looks like there
    const { data: profiles, error: profErr } = await admin
        .from('profiles')
        .select('id, member_id, name')
        .limit(5);

    return NextResponse.json({
        chats: chats || [],
        chatError: chatErr?.message || null,
        profiles: profiles || [],
        profileError: profErr?.message || null,
    });
}
