import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ participations: [] });

        const { data: prof } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
        const memberId = prof?.member_id || user.email || '';

        const { data } = await supabaseAdmin
            .from('challenge_participants')
            .select('challenge_id, status')
            .eq('member_id', memberId);

        return NextResponse.json({ participations: data || [] });
    } catch {
        return NextResponse.json({ participations: [] });
    }
}
