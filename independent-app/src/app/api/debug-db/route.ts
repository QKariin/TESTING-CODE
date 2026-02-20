import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        // 1. Check with Guest Pass (Anon Key)
        const { count: anonCount, error: anonError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        // 2. Check with Master Key (Service Role)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        let masterCount = null;
        let masterError = null;

        if (serviceKey) {
            const { createClient: createAdminClient } = await import('@supabase/supabase-js');
            const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
            const { count, error } = await admin
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            masterCount = count;
            masterError = error;
        }

        return NextResponse.json({
            connected: true,
            guestPass: { count: anonCount, error: anonError?.message || "none" },
            masterKey: {
                present: !!serviceKey,
                count: masterCount,
                error: masterError?.message || "none"
            }
        });
    } catch (err: any) {
        return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
    }
}
