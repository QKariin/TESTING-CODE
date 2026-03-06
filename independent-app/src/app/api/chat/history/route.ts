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

        // Use admin client to bypass RLS — messages are scoped to the requested email
        const queryClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch messages for this specific user
        const { data, error } = await queryClient
            .from('chats')
            .select('*')
            .ilike('member_id', email)
            .order('created_at', { ascending: true });

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
