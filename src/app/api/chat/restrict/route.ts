import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.toLowerCase();
        if (!email || !CEO_EMAILS.includes(email)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
        }

        const { memberId, restricted } = await req.json();
        if (!memberId) {
            return NextResponse.json({ success: false, error: 'memberId required' }, { status: 400 });
        }

        // Get current parameters
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('parameters')
            .eq('ID', memberId)
            .maybeSingle();

        const params = profile?.parameters || {};
        const updatedParams = { ...params, queen_only_chat: !!restricted };

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ parameters: updatedParams })
            .eq('ID', memberId);

        if (error) throw error;

        return NextResponse.json({ success: true, queen_only_chat: !!restricted });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
