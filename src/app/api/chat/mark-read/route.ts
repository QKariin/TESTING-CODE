import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// POST /api/chat/mark-read
// Body (admin): { role: 'admin', slaveEmail: string, timestamp?: string }
// Body (slave): { role: 'slave', email: string }
export async function POST(req: Request) {
    const admin = getAdmin();
    const body = await req.json();
    const { role } = body;

    if (role === 'admin') {
        const { slaveEmail, timestamp } = body;
        if (!slaveEmail) return NextResponse.json({ error: 'slaveEmail required' }, { status: 400 });
        const ts = timestamp || new Date().toISOString();

        // Atomic upsert — no read-modify-write race on JSON blob
        const { error } = await admin.from('chat_read_state').upsert({
            admin_email: 'ceo@qkarin.com',
            member_email: slaveEmail.toLowerCase(),
            last_read_at: ts,
        }, { onConflict: 'admin_email,member_email' });

        if (error) {
            // Fallback to old JSON method if table doesn't exist yet (pre-migration)
            const { data: adminProfile } = await admin
                .from('profiles').select('parameters')
                .ilike('member_id', 'ceo@qkarin.com').maybeSingle();
            const params = adminProfile?.parameters || {};
            const chatRead = params.admin_chat_read || {};
            chatRead[slaveEmail.toLowerCase()] = ts;
            await admin.from('profiles')
                .update({ parameters: { ...params, admin_chat_read: chatRead } })
                .ilike('member_id', 'ceo@qkarin.com');
        }

        return NextResponse.json({ success: true });
    }

    if (role === 'slave') {
        const { email } = body;
        if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

        const { data: profile } = await admin
            .from('profiles').select('parameters')
            .ilike('member_id', email).maybeSingle();

        const params = profile?.parameters || {};
        await admin.from('profiles')
            .update({ parameters: { ...params, slave_chat_read_at: new Date().toISOString() } })
            .ilike('member_id', email);

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'invalid role' }, { status: 400 });
}

// GET /api/chat/mark-read?type=admin - returns admin's full chat_read map
// GET /api/chat/mark-read?type=slave&email=xxx - returns slave's slave_chat_read_at
export async function GET(req: Request) {
    const admin = getAdmin();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'admin') {
        // Try new table first
        const { data: rows, error } = await admin
            .from('chat_read_state')
            .select('member_email, last_read_at')
            .eq('admin_email', 'ceo@qkarin.com');

        if (!error && rows && rows.length > 0) {
            const chatRead: Record<string, string> = {};
            rows.forEach((r: any) => {
                chatRead[r.member_email] = r.last_read_at;
            });
            return NextResponse.json({ chatRead });
        }

        // Fallback to old JSON method (pre-migration)
        const { data } = await admin.from('profiles').select('parameters').ilike('member_id', 'ceo@qkarin.com').maybeSingle();
        return NextResponse.json({ chatRead: data?.parameters?.admin_chat_read || {} });
    }

    if (type === 'slave') {
        const email = searchParams.get('email');
        if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
        const { data } = await admin.from('profiles').select('parameters').ilike('member_id', email).maybeSingle();
        return NextResponse.json({ slaveReadAt: data?.parameters?.slave_chat_read_at || null });
    }

    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
}
