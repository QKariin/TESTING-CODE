import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findProfile } from '@/lib/lookup'

export async function POST(request: NextRequest) {
    try {
        const { messageId, userEmail } = await request.json()
        if (!messageId || !userEmail) return NextResponse.json({ ok: false })

        const profile = await findProfile(userEmail, 'ID, name, avatar_url')

        if (!profile) return NextResponse.json({ ok: false })

        await supabaseAdmin.from('global_message_reads').upsert({
            message_id: messageId,
            user_id: profile.ID,
            user_name: profile.name || userEmail.split('@')[0],
            avatar_url: profile.avatar_url || profile.profile_picture_url || null,
            read_at: new Date().toISOString(),
        }, { onConflict: 'message_id,user_id' })

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false })
    }
}

export async function GET(request: NextRequest) {
    try {
        const messageId = new URL(request.url).searchParams.get('messageId')
        if (!messageId) return NextResponse.json({ readers: [] })

        const { data } = await supabaseAdmin
            .from('global_message_reads')
            .select('user_name, avatar_url, read_at')
            .eq('message_id', messageId)
            .order('read_at', { ascending: true })

        return NextResponse.json({ readers: data || [] })
    } catch {
        return NextResponse.json({ readers: [] })
    }
}
