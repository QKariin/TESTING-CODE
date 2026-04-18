import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

// GET /api/chatter/role — returns { role: 'queen' | 'chatter' | 'none' }
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const email = user?.email?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (CEO_EMAILS.includes(email)) {
            return NextResponse.json({ role: 'queen' });
        }

        const { data: chatter } = await supabaseAdmin
            .from('chatters')
            .select('id, display_name')
            .eq('email', email)
            .eq('is_active', true)
            .maybeSingle();

        if (chatter) {
            return NextResponse.json({ role: 'chatter', displayName: chatter.display_name });
        }

        return NextResponse.json({ role: 'none' });
    } catch (err: any) {
        return NextResponse.json({ role: 'none', error: err.message }, { status: 500 });
    }
}
