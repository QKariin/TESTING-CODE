import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

// Build a query that finds chats by UUID or email (backward compat for old records)
function buildChatQuery(queryClient: any, chatCols: string, memberId: string, email: string | null) {
    // If we have both UUID and email, query both for backward compat
    // Values must be double-quoted in .or() to prevent PostgREST from
    // interpreting dots/@ in emails as filter syntax separators
    if (email && email !== memberId) {
        return queryClient
            .from('chats')
            .select(chatCols)
            .or(`member_id.eq."${memberId}",member_id.ilike."${email}"`);
    }
    // UUID-only or email-only
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
    if (isUuid) {
        return queryClient.from('chats').select(chatCols).eq('member_id', memberId);
    }
    return queryClient.from('chats').select(chatCols).ilike('member_id', memberId);
}

async function isActiveChatter(email: string, adminClient: any): Promise<boolean> {
    const { data } = await adminClient
        .from('chatters')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();
    return !!data;
}

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId') || searchParams.get('email');

        if (!memberId) {
            return NextResponse.json({ success: false, error: "memberId is required." }, { status: 400 });
        }

        if (!isOwnerOrCEO(caller, memberId)) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!supabaseUrl || !supabaseServiceKey || !(await isActiveChatter(caller.email, createAdminClient(supabaseUrl, supabaseServiceKey)))) {
                return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
            }
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[API/Chat/History] GET CRITICAL: Environment variables missing");
            return NextResponse.json({ success: false, error: "Environment configuration error." }, { status: 500 });
        }

        const queryClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        // Resolve UUID→email for backward compat query (old records store email)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        let memberEmail: string | null = null;
        if (isUuid) {
            const { data: profile } = await queryClient.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
            if (profile?.member_id) memberEmail = profile.member_id;
        }

        const since = searchParams.get('since');
        const chatColumns = '*';
        let query: any;

        if (since) {
            query = buildChatQuery(queryClient, chatColumns, memberId, memberEmail)
                .gt('created_at', since)
                .order('created_at', { ascending: true });
        } else {
            query = buildChatQuery(queryClient, chatColumns, memberId, memberEmail)
                .order('created_at', { ascending: false })
                .limit(200);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[API/Chat/History] GET query error:", error.message, error.code);
            return NextResponse.json({ success: false, error: 'Query failed', messages: [] }, { status: 500 });
        }

        const messages = (data || []).sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        return NextResponse.json({
            success: true,
            messages
        });

    } catch (err: any) {
        console.error("[API/Chat/History] GET error:", err.message);
        return NextResponse.json({ success: false, error: 'Server error', messages: [] }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { memberId: rawMemberId, email, since } = body;
        const memberId = rawMemberId || email;

        if (!memberId) {
            return NextResponse.json({ success: false, error: "memberId is required." }, { status: 400 });
        }

        if (!isOwnerOrCEO(caller, memberId)) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!supabaseUrl || !supabaseServiceKey || !(await isActiveChatter(caller.email, createAdminClient(supabaseUrl, supabaseServiceKey)))) {
                return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
            }
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[API/Chat/History] POST CRITICAL: Environment variables missing");
            return NextResponse.json({ success: false, error: "Environment configuration error." }, { status: 500 });
        }

        const queryClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        // Resolve UUID→email for backward compat query (old records store email)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        let memberEmail: string | null = null;
        if (isUuid) {
            const { data: profile } = await queryClient.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
            if (profile?.member_id) memberEmail = profile.member_id;
        }

        const chatCols = '*';
        let query: any;

        if (since) {
            query = buildChatQuery(queryClient, chatCols, memberId, memberEmail)
                .gt('created_at', since)
                .order('created_at', { ascending: true });
        } else {
            query = buildChatQuery(queryClient, chatCols, memberId, memberEmail)
                .order('created_at', { ascending: false })
                .limit(200);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[API/Chat/History] POST query error:", error.message, error.code);
            return NextResponse.json({ success: false, error: 'Query failed', messages: [] }, { status: 500 });
        }

        const messages = (data || []).sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        return NextResponse.json({
            success: true,
            messages
        });

    } catch (err: any) {
        console.error("[API/Chat/History] POST error:", err.message);
        return NextResponse.json({ success: false, error: 'Server error', messages: [] }, { status: 500 });
    }
}
