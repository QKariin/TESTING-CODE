import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
        }

        const supabase = await createClient();

        // Fetch messages for this specific user (or Queen view if requester is Queen)
        // RLS will ensure the user only sees what they are allowed to.
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .eq('sender_email', email)
            .order('created_at', { ascending: true });

        if (error) {
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
