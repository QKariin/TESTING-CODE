import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ windowId: string }> }) {
    try {
        const { windowId } = await params;
        const body = await request.json();

        if (body.push_now) {
            // Fetch the window to get the challenge's window_minutes
            const { data: win, error: wErr } = await supabaseAdmin
                .from('challenge_windows')
                .select('challenge_id, challenges(window_minutes)')
                .eq('id', windowId)
                .single();
            if (wErr || !win) return NextResponse.json({ success: false, error: 'Window not found' }, { status: 404 });

            const minutes: number = (win as any).challenges?.window_minutes ?? 30;
            const now = new Date();
            const closes = new Date(now.getTime() + minutes * 60 * 1000);
            delete body.push_now;
            body.opens_at = now.toISOString();
            body.closes_at = closes.toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('challenge_windows')
            .update(body)
            .eq('id', windowId)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, window: data });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
