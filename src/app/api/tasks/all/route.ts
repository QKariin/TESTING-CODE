import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await supabaseAdmin
            .from('tasks_database')
            .select('*')
            .order('Category', { ascending: true });

        if (error) {
            console.error("Supabase Error fetching all tasks:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            tasks: data || []
        });
    } catch (error: any) {
        console.error("Failed to fetch all tasks:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
