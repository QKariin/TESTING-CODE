import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const results: any = { connected: true, env: { serviceKeyPresent: !!serviceKey } };

        if (!serviceKey) {
            return NextResponse.json({ connected: true, error: "MASTER_KEY_MISSING_IN_VERCEL" });
        }

        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

        // 1. Check Profiles
        const { count: pCount, error: pError } = await admin.from('profiles').select('*', { count: 'exact', head: true });
        results.profiles = { count: pCount, error: pError?.message || "none" };

        // 2. Check Tasks (Legacy Cabinet)
        const { count: tCount, error: tError } = await admin.from('tasks').select('*', { count: 'exact', head: true });
        results.tasks = { count: tCount, error: tError?.message || "none" };

        // 3. Try to fetch ONE legacy email for proof
        const { data: sample, error: sampleErr } = await admin.from('tasks').select('*').limit(1).maybeSingle();
        results.sampleData = sample || { error: sampleErr?.message };

        if (sample && sample.member_id) {
            // 4. Test an explicitly targeted update to see if it throws a constraint/type error
            const { error: updateErr } = await admin.from('tasks')
                .update({ lastWorship: new Date().toISOString() })
                .eq('member_id', sample.member_id);

            results.testUpdate = { success: !updateErr, error: updateErr?.message || null };
        }

        return NextResponse.json(results, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    } catch (err: any) {
        return NextResponse.json({ connected: false, error: err.message }, { status: 500 });
    }
}
