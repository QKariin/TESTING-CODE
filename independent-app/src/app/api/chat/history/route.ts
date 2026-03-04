import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');
        const requester = searchParams.get('requester');

        if (!email) {
            return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let userEmail = requester || user?.email;
        const isHardcodedAdmin = userEmail && ["ceo@qkarin.com", "liviacechova@gmail.com"].includes(userEmail.toLowerCase());

        // Use service role if admin to bypass RLS, otherwise use regular client
        const queryClient = isHardcodedAdmin ? createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        ) : supabase;

        // Fetch messages for this specific user
        const { data, error } = await queryClient
            .from('chats')
            .select('*')
            .eq('member_id', email)
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
