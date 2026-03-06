import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberEmail = searchParams.get('email');

        if (!memberEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        // Use supabaseAdmin to bypass RLS
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('routine, routine_history')
            .ilike('member_id', memberEmail)
            .maybeSingle();

        const routine = profile?.routine || null;
        const history: string[] = Array.isArray(profile?.routine_history) ? profile.routine_history : [];

        // Check if uploaded today (UTC midnight reset)
        const todayStr = new Date().toISOString().split('T')[0];
        const uploadedToday = history.some((ts: string) => {
            try { return new Date(ts).toISOString().split('T')[0] === todayStr; } catch { return false; }
        });

        return NextResponse.json({
            routine,           // null = no routine set | string = their routine text
            uploadedToday,     // true = already uploaded today
        });
    } catch (err: any) {
        console.error('[routine-status]', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
