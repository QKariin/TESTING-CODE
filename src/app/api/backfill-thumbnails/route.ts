import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isOwnerOrCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET — return all video task entries missing thumbnail_url
export async function GET() {
    const caller = await getCaller();
    if (!caller || !isOwnerOrCEO(caller, caller.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: tasks, error } = await supabaseAdmin
        .from('tasks')
        .select('"ID", member_id, "Taskdom_History"');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const missing: { taskRowId: string; entryId: string; proofUrl: string; idx: number }[] = [];

    for (const row of (tasks || [])) {
        let history: any[] = [];
        try { history = typeof row.Taskdom_History === 'string' ? JSON.parse(row.Taskdom_History) : (row.Taskdom_History || []); } catch { continue; }

        for (let i = 0; i < history.length; i++) {
            const e = history[i];
            if (!e.proofUrl) continue;
            const isVideo = e.proofType === 'video' || /\.(mp4|mov|webm)/i.test(e.proofUrl);
            if (isVideo && !e.thumbnail_url) {
                missing.push({ taskRowId: row.ID, entryId: e.id, proofUrl: e.proofUrl, idx: i });
            }
        }
    }

    return NextResponse.json({ count: missing.length, items: missing });
}

// POST — update a single task entry with a generated thumbnail_url
export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller || !isOwnerOrCEO(caller, caller.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { taskRowId, entryId, thumbnailUrl } = await req.json();
    if (!taskRowId || !entryId || !thumbnailUrl) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
        .from('tasks')
        .select('"ID", "Taskdom_History"')
        .eq('ID', taskRowId)
        .maybeSingle();

    if (fetchErr || !row) return NextResponse.json({ error: fetchErr?.message || 'Not found' }, { status: 500 });

    let history: any[] = [];
    try { history = typeof row.Taskdom_History === 'string' ? JSON.parse(row.Taskdom_History) : (row.Taskdom_History || []); } catch { return NextResponse.json({ error: 'Parse error' }, { status: 500 }); }

    const entry = history.find((e: any) => e.id === entryId);
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    entry.thumbnail_url = thumbnailUrl;

    const { error: updateErr } = await supabaseAdmin
        .from('tasks')
        .update({ Taskdom_History: JSON.stringify(history) })
        .eq('ID', taskRowId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
