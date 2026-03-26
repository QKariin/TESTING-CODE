import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');
        const requester = searchParams.get('requester')?.toLowerCase();

        if (!email) {
            return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
        }

        // Robust administrative client initialization
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[API/Chat/History] GET CRITICAL: Environment variables missing");
            return NextResponse.json({ success: false, error: "Environment configuration error." }, { status: 500 });
        }

        const queryClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        const since = searchParams.get('since'); // ISO timestamp — return only newer messages

        // Fetch messages for this specific user
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
        const { data: profile } = await queryClient.from('profiles').select('member_id').or(isUUID ? `id.eq.${email}` : `member_id.ilike.${email}`).maybeSingle();
        const emailToQuery = profile?.member_id || email;

        let query = queryClient
            .from('chats')
            .select('*')
            .ilike('member_id', emailToQuery)
            .order('created_at', { ascending: true });

        if (since) query = query.gt('created_at', since);

        const { data, error } = await query;

        if (error) {
            console.error("[API/Chat/History] Error:", error.message);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            messages: data || []
        });

    } catch (err: any) {
        console.error("[API/Chat/History] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, since, requester } = body;

        if (!email) {
            return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
        }

        // Robust administrative client initialization
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[API/Chat/History] POST CRITICAL: Environment variables missing");
            return NextResponse.json({ success: false, error: "Environment configuration error." }, { status: 500 });
        }

        const queryClient = createAdminClient(supabaseUrl, supabaseServiceKey);

        // Fetch messages for this specific user
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
        const { data: profile } = await queryClient.from('profiles').select('member_id').or(isUUID ? `id.eq.${email}` : `member_id.ilike.${email}`).maybeSingle();
        const emailToQuery = profile?.member_id || email;

        let query = queryClient
            .from('chats')
            .select('*')
            .ilike('member_id', emailToQuery)
            .order('created_at', { ascending: true });

        if (since) query = query.gt('created_at', since);

        const { data, error } = await query;

        if (error) {
            console.error("[API/Chat/History] Error:", error.message);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            messages: data || []
        });

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
