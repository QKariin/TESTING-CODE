import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Fetch all profiles that have purchase history
        const { data: profiles, error } = await supabaseAdmin
            .from('profiles')
            .select('name, member_id, parameters')
            .not('parameters->purchaseHistory', 'is', null);

        if (error) throw error;

        // Flatten all purchase histories into one sorted list
        const transactions: any[] = [];
        for (const profile of profiles || []) {
            const history: any[] = profile.parameters?.purchaseHistory || [];
            for (const entry of history) {
                transactions.push({
                    name: entry.name || profile.name || profile.member_id || 'Unknown',
                    memberId: entry.memberId || profile.member_id || '',
                    coins: entry.coins,
                    amount: entry.amount,
                    reason: entry.reason,
                    type: entry.type || 'COIN_PURCHASE',
                    timestamp: entry.timestamp,
                    sessionId: entry.sessionId,
                });
            }
        }

        // Sort newest first
        transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({ transactions });
    } catch (err: any) {
        console.error('[transactions] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
