import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST — capture a lead (called from auth callback when user has no profile)
export async function POST(req: NextRequest) {
    try {
        const { email, provider } = await req.json();
        if (!email) return NextResponse.json({ success: false, error: 'No email' }, { status: 400 });

        const id = email.trim().toLowerCase();

        // Try to find existing lead
        const { data: existing } = await supabaseAdmin
            .from('leads')
            .select('id, attempts')
            .eq('email', id)
            .maybeSingle();

        if (existing) {
            await supabaseAdmin
                .from('leads')
                .update({ last_seen: new Date().toISOString(), attempts: (existing.attempts || 1) + 1 })
                .eq('email', id);
        } else {
            await supabaseAdmin
                .from('leads')
                .insert({ email: id, provider: provider || 'unknown', first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), attempts: 1 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[leads POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// GET — list all leads for the dashboard
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('leads')
            .select('*')
            .order('last_seen', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, leads: data || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, leads: [] }, { status: 500 });
    }
}
