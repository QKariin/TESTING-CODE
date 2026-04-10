import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const { data: challenges, error } = await supabaseAdmin
            .from('challenges')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const enriched = await Promise.all((challenges || []).map(async (c: any) => {
            const [{ count: total }, { count: active }, { count: eliminated }] = await Promise.all([
                supabaseAdmin.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id),
                supabaseAdmin.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id).eq('status', 'active'),
                supabaseAdmin.from('challenge_participants').select('*', { count: 'exact', head: true }).eq('challenge_id', c.id).eq('status', 'eliminated'),
            ]);
            return { ...c, participant_total: total || 0, participant_active: active || 0, participant_eliminated: eliminated || 0 };
        }));

        return NextResponse.json({ success: true, challenges: enriched });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const {
            name, theme = 'gold', description = '',
            duration_days, tasks_per_day, window_minutes,
            points_per_completion = 20,
            first_place_points = 10, second_place_points = 7, third_place_points = 5,
            start_date, image_url = null, task_times = null, task_names = null,
        } = body;

        if (!name || !duration_days || !tasks_per_day || !window_minutes || !start_date)
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

        const startDt = new Date(start_date);
        const endDt = new Date(startDt);
        endDt.setDate(endDt.getDate() + Number(duration_days));

        const { data: challenge, error: cErr } = await supabaseAdmin
            .from('challenges')
            .insert({
                name, theme, description, status: 'draft', is_template: true,
                duration_days: Number(duration_days), tasks_per_day: Number(tasks_per_day),
                window_minutes: Number(window_minutes),
                points_per_completion: Number(points_per_completion),
                first_place_points: Number(first_place_points),
                second_place_points: Number(second_place_points),
                third_place_points: Number(third_place_points),
                start_date: startDt.toISOString(),
                end_date: endDt.toISOString(),
                image_url: image_url || null,
                task_names: task_names || null,
            })
            .select().single();

        if (cErr) throw cErr;

        // Generate windows — use provided task_times or distribute evenly 08:00–22:00
        const windows: any[] = [];
        const tpd = Number(tasks_per_day);
        const wmin = Number(window_minutes);
        for (let day = 1; day <= Number(duration_days); day++) {
            const dayDate = new Date(startDt);
            dayDate.setDate(dayDate.getDate() + (day - 1));
            // Support both 1D (same every day) and 2D (per-day) task_times
            const dayTimes = task_times && Array.isArray(task_times[0]) ? task_times[day - 1] : task_times;
            for (let w = 0; w < tpd; w++) {
                let opensAt: Date;
                if (dayTimes && Array.isArray(dayTimes) && dayTimes[w]) {
                    const [h, m] = (dayTimes[w] as string).split(':').map(Number);
                    opensAt = new Date(dayDate);
                    opensAt.setHours(h, m, 0, 0);
                } else {
                    // Fallback: evenly distributed 08:00–22:00
                    const interval = Math.floor((14 * 60) / (tpd + 1));
                    opensAt = new Date(dayDate);
                    opensAt.setHours(8, 0, 0, 0);
                    opensAt.setMinutes(opensAt.getMinutes() + interval * (w + 1));
                }
                const closesAt = new Date(opensAt);
                closesAt.setMinutes(closesAt.getMinutes() + wmin);
                windows.push({
                    challenge_id: challenge.id,
                    day_number: day,
                    window_number: w + 1,
                    opens_at: opensAt.toISOString(),
                    closes_at: closesAt.toISOString(),
                    verification_code: Math.floor(10000 + Math.random() * 90000),
                });
            }
        }

        const { error: wErr } = await supabaseAdmin.from('challenge_windows').insert(windows);
        if (wErr) throw wErr;

        // Auto-create 3 badge definitions
        await supabaseAdmin.from('badges').insert([
            { challenge_id: challenge.id, type: 'participant', name: `${name} — Participant`, description: `Joined the ${name} challenge`, rarity: 'common' },
            { challenge_id: challenge.id, type: 'finisher', name: `${name} — Finisher`, description: `Completed the ${name} challenge`, rarity: 'rare' },
            { challenge_id: challenge.id, type: 'champion', name: `${name} — Champion`, description: `Won the ${name} challenge`, rarity: 'legendary' },
        ]);

        return NextResponse.json({ success: true, challenge, windows_created: windows.length });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
