import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { applicationId, step, ...data } = body;

        if (!data.email) {
            return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });
        }

        // Try to find existing application by id or email
        let existingId = applicationId;

        if (!existingId) {
            const { data: existing } = await supabaseAdmin
                .from('applications')
                .select('id')
                .ilike('email', data.email)
                .eq('payment_status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            existingId = existing?.id || null;
        }

        // Resolve member_id from profiles if email matches
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('member_id', data.email)
            .maybeSingle();

        const payload: any = {
            email: data.email.toLowerCase().trim(),
            step_reached: step,
            ...(profile?.id ? { member_id: profile.id } : {}),
        };

        // Map fields per step
        if (data.name)               payload.name               = data.name;
        if (data.toys_owned !== undefined)     payload.toys_owned         = data.toys_owned;
        if (data.favorite_toy !== undefined)   payload.favorite_toy       = data.favorite_toy;
        if (data.weirdest_object !== undefined) payload.weirdest_object   = data.weirdest_object;
        if (data.bought_to_impress !== undefined) payload.bought_to_impress = data.bought_to_impress;
        if (data.toy_want_to_try !== undefined) payload.toy_want_to_try   = data.toy_want_to_try;
        if (data.femdom_experience !== undefined) payload.femdom_experience = data.femdom_experience;
        if (data.expectations !== undefined)   payload.expectations       = data.expectations;
        if (data.hard_limits !== undefined)    payload.hard_limits        = data.hard_limits;
        if (data.soft_limits !== undefined)    payload.soft_limits        = data.soft_limits;
        if (data.first_experience !== undefined) payload.first_experience = data.first_experience;
        if (data.best_moment !== undefined)    payload.best_moment        = data.best_moment;
        if (data.mistakes !== undefined)       payload.mistakes           = data.mistakes;
        if (data.sliders !== undefined)        payload.sliders            = data.sliders;
        if (data.domination_tone !== undefined) payload.domination_tone   = data.domination_tone;
        if (data.reason_applying !== undefined) payload.reason_applying   = data.reason_applying;
        if (data.feelings_payment !== undefined) payload.feelings_payment = data.feelings_payment;
        if (data.self_perception !== undefined) payload.self_perception   = data.self_perception;
        if (data.priority_aspect !== undefined) payload.priority_aspect   = data.priority_aspect;
        if (data.motivation !== undefined)     payload.motivation         = data.motivation;
        if (data.pain_tolerance !== undefined) payload.pain_tolerance     = data.pain_tolerance;
        if (data.preference !== undefined)     payload.preference         = data.preference;
        if (data.isolation_effects !== undefined) payload.isolation_effects = data.isolation_effects;
        if (data.self_review !== undefined)    payload.self_review        = data.self_review;
        if (data.ideal_punishment !== undefined) payload.ideal_punishment = data.ideal_punishment;

        let resultId = existingId;

        if (existingId) {
            await supabaseAdmin.from('applications').update(payload).eq('id', existingId);
        } else {
            const { data: inserted } = await supabaseAdmin
                .from('applications')
                .insert(payload)
                .select('id')
                .single();
            resultId = inserted?.id;
        }

        return NextResponse.json({ success: true, applicationId: resultId });
    } catch (err: any) {
        console.error('Apply API error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
