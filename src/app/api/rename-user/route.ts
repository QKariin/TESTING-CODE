import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/rename-user
// body: { memberEmail: string, newName: string }
// Updates name across: profiles, tasks, global_messages, global_message_reads, chatters
export async function POST(req: Request) {
    try {
        const { memberEmail, newName } = await req.json();

        if (!memberEmail || !newName || !newName.trim()) {
            return NextResponse.json({ error: 'memberEmail and newName required' }, { status: 400 });
        }

        const trimmed = newName.trim();
        const results: Record<string, string> = {};

        // 1. profiles.name (primary)
        const { error: e1 } = await supabaseAdmin
            .from('profiles')
            .update({ name: trimmed })
            .ilike('member_id', memberEmail);
        results.profiles = e1 ? `error: ${e1.message}` : 'ok';

        // 2. tasks.Name (legacy)
        const { error: e2 } = await supabaseAdmin
            .from('tasks')
            .update({ Name: trimmed })
            .ilike('member_id', memberEmail);
        results.tasks = e2 ? `error: ${e2.message}` : 'ok';

        // 3. global_messages.sender_name (denormalized)
        const { error: e3 } = await supabaseAdmin
            .from('global_messages')
            .update({ sender_name: trimmed })
            .ilike('sender_email', memberEmail);
        results.global_messages = e3 ? `error: ${e3.message}` : 'ok';

        // 4. global_message_reads.user_name (denormalized)
        // Need the user's UUID from profiles first
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('ID')
            .ilike('member_id', memberEmail)
            .maybeSingle();
        if (profile?.ID) {
            const { error: e4 } = await supabaseAdmin
                .from('global_message_reads')
                .update({ user_name: trimmed })
                .eq('user_id', profile.ID);
            results.global_message_reads = e4 ? `error: ${e4.message}` : 'ok';
        } else {
            results.global_message_reads = 'skipped (no profile UUID)';
        }

        // 5. chatters.display_name (if they're a chatter)
        const { error: e5 } = await supabaseAdmin
            .from('chatters')
            .update({ display_name: trimmed })
            .ilike('email', memberEmail);
        results.chatters = e5 ? `error: ${e5.message}` : 'ok';

        return NextResponse.json({ success: true, newName: trimmed, results });
    } catch (err: any) {
        console.error('[rename-user] error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
