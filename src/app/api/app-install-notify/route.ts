import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { memberId, memberName } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        // Check if already notified (idempotent — won't duplicate)
        const { data: existing } = await adminClient
            .from('chats')
            .select('id')
            .eq('member_id', memberId)
            .like('content', 'APP_INSTALL::%')
            .maybeSingle();

        if (existing) return NextResponse.json({ success: true, alreadyExists: true });

        // Also check case-insensitive for email-based member_ids
        const { data: existingIlike } = await adminClient
            .from('chats')
            .select('id')
            .ilike('member_id', memberId)
            .like('content', 'APP_INSTALL::%')
            .maybeSingle();

        if (existingIlike) return NextResponse.json({ success: true, alreadyExists: true });

        const payload = {
            userName: memberName || 'Unknown',
            installedAt: new Date().toISOString(),
        };

        await adminClient.from('chats').insert({
            member_id: memberId,
            sender_email: 'ceo@qkarin.com',
            content: `APP_INSTALL::${JSON.stringify(payload)}`,
            type: 'chat',
            metadata: { isAppInstall: true, isQueen: true },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[app-install-notify] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
