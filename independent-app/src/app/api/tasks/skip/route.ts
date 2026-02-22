import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

        // 1. Get profile
        const { data: profile } = await getSupabaseAdmin()
            .from('profiles')
            .select('*')
            .eq('member_id', email)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const params = profile.parameters || {};
        const wallet = profile.wallet || 0;
        const penalty = 300;

        // 2. Ensure they actually have a task to skip
        if (!params.activeTask || new Date().getTime() >= new Date(params.activeTask.expiresAt).getTime()) {
            return NextResponse.json({ error: 'No active task to skip' }, { status: 400 });
        }

        // 3. Check wallet balance
        if (wallet < penalty) {
            return NextResponse.json({ error: 'Insufficient funds. You need 300 coins to skip.' }, { status: 400 });
        }

        // 4. Clear active task and deduct penalty
        delete params.activeTask;
        const newWallet = wallet - penalty;

        await getSupabaseAdmin()
            .from('profiles')
            .update({
                parameters: params,
                wallet: newWallet
            })
            .eq('member_id', email);

        return NextResponse.json({ success: true, newWallet });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
