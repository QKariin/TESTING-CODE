import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

async function requireQueen() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase();
    if (!email || !CEO_EMAILS.includes(email)) {
        throw new Error('Unauthorized');
    }
    return email;
}

// GET /api/chatter/manage — list all chatters with stats
export async function GET() {
    try {
        await requireQueen();

        const { data: chatters, error } = await supabaseAdmin
            .from('chatters')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get message counts per chatter
        const stats: Record<string, { messages: number; tributes: number }> = {};
        for (const c of chatters || []) {
            const { count: msgCount } = await supabaseAdmin
                .from('chats')
                .select('*', { count: 'exact', head: true })
                .eq('chatter_email', c.email);

            const { count: tributeCount } = await supabaseAdmin
                .from('chats')
                .select('*', { count: 'exact', head: true })
                .eq('chatter_email', c.email)
                .eq('type', 'wishlist');

            stats[c.email] = {
                messages: msgCount || 0,
                tributes: tributeCount || 0,
            };
        }

        return NextResponse.json({
            success: true,
            chatters: (chatters || []).map((c: any) => ({
                ...c,
                stats: stats[c.email] || { messages: 0, tributes: 0 },
            })),
        });
    } catch (err: any) {
        const status = err.message === 'Unauthorized' ? 403 : 500;
        return NextResponse.json({ success: false, error: err.message }, { status });
    }
}

// POST /api/chatter/manage — add or remove a chatter
// Body: { action: 'add', email, displayName } or { action: 'remove', email }
export async function POST(req: Request) {
    try {
        await requireQueen();
        const { action, email, displayName } = await req.json();

        if (!email) {
            return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (action === 'add') {
            const { error } = await supabaseAdmin
                .from('chatters')
                .upsert({
                    email: normalizedEmail,
                    display_name: displayName || normalizedEmail.split('@')[0],
                    is_active: true,
                }, { onConflict: 'email' });

            if (error) throw error;
            return NextResponse.json({ success: true, message: `Chatter ${normalizedEmail} added` });

        } else if (action === 'remove') {
            const { error } = await supabaseAdmin
                .from('chatters')
                .update({ is_active: false })
                .eq('email', normalizedEmail);

            if (error) throw error;
            return NextResponse.json({ success: true, message: `Chatter ${normalizedEmail} removed` });

        } else {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        const status = err.message === 'Unauthorized' ? 403 : 500;
        return NextResponse.json({ success: false, error: err.message }, { status });
    }
}
