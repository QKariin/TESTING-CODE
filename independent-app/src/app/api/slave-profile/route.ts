import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const full = searchParams.get('full') === 'true';

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (full) {
        // Returns merged profiles + tasks using admin client (bypasses RLS)
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .ilike('member_id', email)
            .maybeSingle();

        if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

        const { data: taskData } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .ilike('member_id', email)
            .maybeSingle();

        // Sum all crowdfund contributions for this user
        const { data: contribData } = await supabaseAdmin
            .from('crowdfund_contributions')
            .select('amount_given')
            .eq('member_id', email);
        const crowdfundTotal = (contribData || []).reduce((sum: number, r: any) => sum + (r.amount_given || 0), 0);

        return NextResponse.json({ ...profileData, ...(taskData || {}), _totalSpent: crowdfundTotal });
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('member_id', email)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { email, ...updates } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('member_id', email)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: data });
}
