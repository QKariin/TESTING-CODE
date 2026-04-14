import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/admin-chat - insert a message from admin into the messages table
export async function POST(req: Request) {
    try {
        const { memberId, message } = await req.json();

        if (!memberId || !message?.trim()) {
            return NextResponse.json({ error: 'Missing memberId or message' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('messages')
            .insert({
                member_id: memberId,
                sender: 'admin',
                message: message.trim(),
                media_url: null,
                read: true,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[admin-chat] insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('[admin-chat] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET /api/admin-chat?memberId=xxx - fetch messages for a user
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const memberId = searchParams.get('memberId');

        if (!memberId) {
            return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('member_id', memberId)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, messages: data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
