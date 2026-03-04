import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
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
