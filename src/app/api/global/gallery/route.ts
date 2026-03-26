import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('chats')
            .select('id, content, type, metadata, created_at')
            .eq('sender_email', 'ceo@qkarin.com')
            .in('type', ['photo', 'video'])
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const items = (data || []).map((row: any) => {
            let url = '';
            try {
                const parsed = JSON.parse(row.content);
                url = parsed.url || parsed.media_url || row.content;
            } catch {
                url = row.content;
            }
            const meta = row.metadata || {};
            url = url || meta.url || meta.media_url || '';
            return { id: row.id, url, type: row.type, caption: meta.caption || '', created_at: row.created_at };
        }).filter((item: any) => !!item.url);

        return NextResponse.json({ items });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
