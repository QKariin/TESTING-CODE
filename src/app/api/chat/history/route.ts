import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export async function GET(req: Request) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId') || searchParams.get('email');
        const requester = searchParams.get('requester')?.toLowerCase();

        if (!memberId) {
            return NextResponse.json({ success: false, error: "memberId is required." }, { status: 400 });
        }

        if (!isOwnerOrCEO(caller, memberId)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // Robust administrative client initialization
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[API/Chat/History] GET CRITICAL: Environment variables missing");
            return NextResponse.json({ success: false, error: "Environment configuration error." }, { status: 500 });
        }

        const queryClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        // chats.member_id stores EMAIL — if caller passed a UUID, resolve it to email first
        const isUuidGet = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        let chatMemberIdGet = memberId;
        if (isUuidGet) {
            const { data: profile } = await queryClient.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
            if (profile?.member_id) chatMemberIdGet = profile.member_id;
        }

        const since = searchParams.get('since'); // ISO timestamp - return only newer messages

        const chatColumns = '*';
        let query: any;
        if (since) {
            // Polling: get messages strictly newer than timestamp (gt, not gte)
            // Using gte caused the last message to be re-fetched on every poll,
            // leading to duplicates when client-side dedup failed.
            // Realtime subscription covers the same-timestamp edge case.
            query = queryClient
                .from('chats')
                .select(chatColumns)
                .ilike('member_id', chatMemberIdGet)
                .gt('created_at', since)
                .order('created_at', { ascending: true });
        } else {
            // Initial load: get LAST 200 messages
            query = queryClient
                .from('chats')
                .select(chatColumns)
                .ilike('member_id', chatMemberIdGet)
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
        const { memberId: rawMemberId, email, since, requester } = body;
        const memberId = rawMemberId || email; // accept both memberId (UUID) and legacy email

        if (!memberId) {
            return NextResponse.json({ success: false, error: "memberId is required." }, { status: 400 });
        }

        if (!isOwnerOrCEO(caller, memberId)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // Robust administrative client initialization
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[API/Chat/History] POST CRITICAL: Environment variables missing");
            return NextResponse.json({ success: false, error: "Environment configuration error." }, { status: 500 });
        }

        const queryClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        // chats.member_id stores EMAIL — if caller passed a UUID, resolve it to email first
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        let chatMemberId = memberId;
        if (isUuid) {
            const { data: profile } = await queryClient.from('profiles').select('member_id').eq('ID', memberId).maybeSingle();
            if (profile?.member_id) chatMemberId = profile.member_id;
        }

        const chatCols = '*';
        let query: any;
        if (since) {
            // Polling: get messages strictly newer than timestamp (gt, not gte)
            query = queryClient
                .from('chats')
                .select(chatCols)
                .ilike('member_id', chatMemberId)
                .gt('created_at', since)
                .order('created_at', { ascending: true });
        } else {
            // Initial load: get LAST 200 messages
            query = queryClient
                .from('chats')
                .select(chatCols)
                .ilike('member_id', chatMemberId)
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
