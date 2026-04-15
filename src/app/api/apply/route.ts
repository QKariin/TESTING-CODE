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
            ...(profile?.id ? { member_id: profile.ID } : {}),
        };

        // Join array fields to strings for DB storage
        if (Array.isArray(data.hard_limits)) data.hard_limits = data.hard_limits.join(', ');
        if (Array.isArray(data.soft_limits)) data.soft_limits = data.soft_limits.join(', ');

        // Map all fields
        const fields = [
            'name', 'age', 'location', 'height_weight', 'occupation',
            'relationship_status', 'friends_description', 'favorite_snack', 'weekly_budget',
            'toys_owned', 'favorite_toy', 'weirdest_object', 'bought_to_impress', 'toy_want_to_try',
            'femdom_experience', 'expectations', 'hard_limits', 'soft_limits',
            'first_experience', 'best_moment', 'mistakes', 'honest_confirmation',
            'ready_for_sliders', 'sliders', 'domination_tone',
            'preference', 'isolation_effects', 'self_review', 'ideal_punishment',
            'reason_applying', 'self_perception', 'feelings_payment', 'priority_aspect', 'motivation',
            'pain_tolerance',
        ];
        for (const field of fields) {
            if (data[field] !== undefined) payload[field] = data[field];
        }

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
