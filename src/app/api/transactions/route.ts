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

        // Fetch paid entrance tributes from applications table
        const [profilesRes, appsRes] = await Promise.all([
            supabaseAdmin.from('profiles').select('name, member_id, parameters'),
            supabaseAdmin.from('applications').select('email, name, payment_amount, created_at').eq('payment_status', 'paid'),
        ]);

        if (profilesRes.error) throw profilesRes.error;

        const transactions: any[] = [];

        // Entrance tributes (application fees)
        for (const app of appsRes.data || []) {
            transactions.push({
                type: 'ENTRANCE_TRIBUTE',
                name: app.name || app.email || 'Unknown',
                memberId: app.email || '',
                amount: app.payment_amount ? app.payment_amount / 100 : 95,
                timestamp: app.created_at,
            });
        }

        // Flatten purchaseHistory (coin purchases + paywall tributes)
        for (const profile of profilesRes.data || []) {
            const history: any[] = profile.parameters?.purchaseHistory || [];
            for (const entry of history) {
                // Only include entries that represent real money
                const type = entry.type || 'COIN_PURCHASE';
                if (!entry.amount && !entry.coins) continue;
                transactions.push({
                    type,
                    name: entry.name || profile.name || profile.member_id || 'Unknown',
                    memberId: entry.memberId || profile.member_id || '',
                    coins: entry.coins ?? null,
                    amount: entry.amount ?? null,
                    reason: entry.reason || '',
                    timestamp: entry.timestamp,
                    sessionId: entry.sessionId || entry.orderId || '',
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
