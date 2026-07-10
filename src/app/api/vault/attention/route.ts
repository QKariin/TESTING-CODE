import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { memberId, memberName, taskType, taskLabel, completed, result, skipped } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const payload = {
            memberName: memberName || 'Unknown',
            taskType: taskType || 'unknown',
            taskLabel: taskLabel || '',
            completed: !!completed,
            skipped: !!skipped,
            result: result || null,
            requestedAt: new Date().toISOString(),
        };

        await adminClient.from('chats').insert({
            member_id: memberId,
            sender_email: 'ceo@qkarin.com',
            content: `VAULT_ATTENTION::${JSON.stringify(payload)}`,
            type: 'chat',
            metadata: { isVaultAttention: true, isQueen: true },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[vault/attention] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
