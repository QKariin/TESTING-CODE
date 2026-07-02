import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discordNewMember } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { memberId, name } = await req.json();
        if (!memberId || !name) {
            return NextResponse.json({ error: 'Missing memberId or name' }, { status: 400 });
        }

        // Only send once — check welcome_pending flag
        const { data: profile } = await adminClient
            .from('profiles')
            .select('parameters')
            .ilike('member_id', memberId)
            .maybeSingle();

        if (!profile?.parameters?.welcome_pending) {
            return NextResponse.json({ success: true, skipped: true });
        }

        // Clear the flag so it never fires again
        const params = { ...profile.parameters };
        delete params.welcome_pending;
        await adminClient
            .from('profiles')
            .update({ parameters: params })
            .ilike('member_id', memberId);

        // Welcome card in global chat
        await adminClient.from('global_messages').insert({
            sender_email: 'system@qkarin.com',
            sender_name: 'System',
            sender_avatar: null,
            message: `WELCOME_CARD::${JSON.stringify({
                name,
                rank: 'Hall Boy',
                coins: 4999,
            })}`,
        });

        // Discord notification
        discordNewMember(name).catch(() => {});

        console.log(`[WELCOME] Announced ${name} to global chat + Discord`);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[welcome-announce] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
