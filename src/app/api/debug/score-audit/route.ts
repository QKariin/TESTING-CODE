import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['ceo@qkarin.com'];

// GET /api/debug/score-audit?email=user@example.com
// Shows recent Daily Score changes for a specific user (or all users)
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let callerEmail = user.email?.toLowerCase() || '';
    if (!callerEmail) {
        const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
        callerEmail = p?.member_id?.toLowerCase() || '';
    }
    if (!ADMIN_EMAILS.includes(callerEmail)) {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    let query = supabaseAdmin
        .from('score_audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);

    if (email) {
        query = query.ilike('member_id', `%${email}%`);
    }

    const { data, error } = await query;
    if (error) {
        // Table might not exist yet
        if (error.message.includes('does not exist') || error.code === '42P01') {
            return NextResponse.json({
                error: 'score_audit_log table does not exist. Run the SQL from src/lib/score-audit-trigger.sql in Supabase first.',
            }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data, count: data?.length || 0 });
}
