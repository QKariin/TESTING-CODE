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

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);

        // 1. Set appInstallClaimed in parameters
        const col = isUuid ? 'ID' : 'member_id';
        const { data: profile } = await adminClient
            .from('profiles')
            .select('ID, parameters, name')
            .eq(col, memberId)
            .maybeSingle();

        if (!profile) {
            // Try ilike for email
            const { data: p2 } = await adminClient
                .from('profiles')
                .select('ID, parameters, name')
                .ilike('member_id', memberId)
                .maybeSingle();
            if (!p2) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            // Use p2
            const params = p2.parameters || {};
            if (!params.appInstallClaimed) {
                params.appInstallClaimed = true;
                await adminClient.from('profiles').update({ parameters: params }).eq('ID', p2.ID);
            }
        } else {
            const params = profile.parameters || {};
            if (!params.appInstallClaimed) {
                params.appInstallClaimed = true;
                await adminClient.from('profiles').update({ parameters: params }).eq('ID', profile.ID);
            }
        }

        // 2. Check if notification already exists (idempotent)
        const { data: existing } = await adminClient
            .from('chats')
            .select('id')
            .ilike('member_id', memberId)
            .like('content', 'APP_INSTALL::%')
            .maybeSingle();

        if (existing) return NextResponse.json({ success: true, alreadyExists: true });

        // Also check by UUID if email was passed
        if (!isUuid && profile?.ID) {
            const { data: ex2 } = await adminClient
                .from('chats')
                .select('id')
                .eq('member_id', profile.ID)
                .like('content', 'APP_INSTALL::%')
                .maybeSingle();
            if (ex2) return NextResponse.json({ success: true, alreadyExists: true });
        }

        // 3. Insert notification
        const resolvedName = memberName || profile?.name || 'Unknown';
        const payload = {
            userName: resolvedName,
            installedAt: new Date().toISOString(),
        };

        // Use UUID as member_id if available (consistent with how chats are stored)
        const chatMemberId = profile?.ID || memberId;

        await adminClient.from('chats').insert({
            member_id: chatMemberId,
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
