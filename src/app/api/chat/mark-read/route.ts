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
// Body (admin): { role: 'admin', slaveEmail: string (UUID or email), timestamp?: string }
// Body (slave): { role: 'slave', email: string (UUID or email) }
export async function POST(req: Request) {
    const admin = getAdmin();
    const body = await req.json();
    const { role } = body;

    if (role === 'admin') {
        const rawId = body.slaveEmail || body.memberId;
        if (!rawId) return NextResponse.json({ error: 'slaveEmail/memberId required' }, { status: 400 });
        const ts = body.timestamp || new Date().toISOString();

        // Resolve to UUID if email was passed
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
        let memberId = rawId;
        if (!isUuid) {
            const { data: p } = await admin.from('profiles').select('ID').ilike('member_id', rawId).maybeSingle();
            if (p?.ID) memberId = p.ID;
        }

        // Atomic upsert — member_email column stores UUID
        const { error } = await admin.from('chat_read_state').upsert({
            admin_email: 'ceo@qkarin.com',
            member_email: memberId,
            last_read_at: ts,
        }, { onConflict: 'admin_email,member_email' });

        if (error) {
            // Fallback to old JSON method if table doesn't exist yet (pre-migration)
            const { data: adminProfile } = await admin
                .from('profiles').select('parameters')
                .ilike('member_id', 'ceo@qkarin.com').maybeSingle();
            const params = adminProfile?.parameters || {};
            const chatRead = params.admin_chat_read || {};
            chatRead[memberId] = ts;
            await admin.from('profiles')
                .update({ parameters: { ...params, admin_chat_read: chatRead } })
                .ilike('member_id', 'ceo@qkarin.com');
        }

        return NextResponse.json({ success: true });
    }

    if (role === 'slave') {
        const rawId = body.email || body.memberId;
        if (!rawId) return NextResponse.json({ error: 'email/memberId required' }, { status: 400 });

        // Support both UUID and email lookup
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
        const { data: profile } = isUuid
            ? await admin.from('profiles').select('parameters').eq('ID', rawId).maybeSingle()
            : await admin.from('profiles').select('parameters').ilike('member_id', rawId).maybeSingle();

        const params = profile?.parameters || {};
        const updateQuery = isUuid
            ? admin.from('profiles').update({ parameters: { ...params, slave_chat_read_at: new Date().toISOString() } }).eq('ID', rawId)
            : admin.from('profiles').update({ parameters: { ...params, slave_chat_read_at: new Date().toISOString() } }).ilike('member_id', rawId);
        await updateQuery;

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'invalid role' }, { status: 400 });
}

// GET /api/chat/mark-read?type=admin - returns admin's full chat_read map (keyed by UUID)
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
        const rawId = searchParams.get('email') || searchParams.get('memberId');
        if (!rawId) return NextResponse.json({ error: 'email/memberId required' }, { status: 400 });
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
        const { data } = isUuid
            ? await admin.from('profiles').select('parameters').eq('ID', rawId).maybeSingle()
            : await admin.from('profiles').select('parameters').ilike('member_id', rawId).maybeSingle();
        return NextResponse.json({ slaveReadAt: data?.parameters?.slave_chat_read_at || null });
    }

    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
}
