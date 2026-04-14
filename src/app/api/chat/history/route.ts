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

        const emailToQuery = email;

        let query: any;
        if (since) {
            // Polling: get all messages newer than timestamp
            query = queryClient
                .from('chats')
                .select('*')
                .ilike('member_id', emailToQuery)
                .gt('created_at', since)
                .order('created_at', { ascending: true });
        } else {
            // Initial load: get LAST 300 messages to avoid Supabase's 1000-row default cap
            query = queryClient
                .from('chats')
                .select('*')
                .ilike('member_id', emailToQuery)
                .order('created_at', { ascending: false })
                .limit(50);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[API/Chat/History] GET query error:", error.message, error.code);
            // Return empty messages instead of 500 so the UI doesn't break
            return NextResponse.json({ success: true, messages: [] });
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
        return NextResponse.json({ success: true, messages: [] });
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

        const emailToQuery = email;

        let query: any;
        if (since) {
            // Polling: get all messages newer than timestamp
            query = queryClient
                .from('chats')
                .select('*')
                .ilike('member_id', emailToQuery)
                .gt('created_at', since)
                .order('created_at', { ascending: true });
        } else {
            // Initial load: get LAST 300 messages to avoid Supabase's 1000-row default cap
            query = queryClient
                .from('chats')
                .select('*')
                .ilike('member_id', emailToQuery)
                .order('created_at', { ascending: false })
                .limit(50);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[API/Chat/History] POST query error:", error.message, error.code);
            return NextResponse.json({ success: true, messages: [] });
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
        return NextResponse.json({ success: true, messages: [] });
    }
}
