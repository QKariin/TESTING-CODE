import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/stories?date=YYYY-MM-DD
// Returns: available, count, hasAccess, stories (if access), gateItems
export async function GET(req: Request) {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const caller = await getCaller();
    const memberEmail = caller?.email || '';

    const [{ data: stories }, { data: gateItems }] = await Promise.all([
        supabaseAdmin
            .from('stories')
            .select('id, media_url, media_type, order_index, caption, tagged_members')
            .eq('date', date)
            .order('order_index', { ascending: true }),
        supabaseAdmin
            .from('Wishlist')
            .select('ID, Title, Price, Image')
            .eq('stories_gate', true),
    ]);

    const count = (stories || []).length;

    let hasAccess = false;
    if (memberEmail && count > 0) {
        const { data: access } = await supabaseAdmin
            .from('story_access')
            .select('id')
            .eq('member_email', memberEmail.toLowerCase())
            .eq('date', date)
            .maybeSingle();
        hasAccess = !!access;
    }

    return NextResponse.json({
        available: count > 0,
        count,
        hasAccess,
        stories: hasAccess ? (stories || []) : [],
        gateItems: (gateItems || []).filter((i: any) => !i.purchased),
    });
}
