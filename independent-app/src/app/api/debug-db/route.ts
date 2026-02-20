import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return NextResponse.json({
                connected: false,
                error: error.message,
                details: error
            }, { status: 500 });
        }

        return NextResponse.json({
            connected: true,
            message: "Database is alive and reachable.",
            profileCount: count
        });
    } catch (err: any) {
        return NextResponse.json({
            connected: false,
            error: err.message
        }, { status: 500 });
    }
}
