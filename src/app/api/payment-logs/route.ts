import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('payment_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;
        return NextResponse.json({ logs: data || [] });
    } catch (err: any) {
        return NextResponse.json({ logs: [], error: err.message }, { status: 500 });
    }
}
