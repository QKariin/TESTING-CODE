import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient as createAdmin } from '@supabase/supabase-js';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const memberId  = searchParams.get('member_id');
    const origin = req.headers.get('origin') || 'https://throne.qkarin.com';

    if (!sessionId || !memberId) {
        return NextResponse.redirect(`${origin}/profile`);
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return NextResponse.redirect(`${origin}/profile?paywall=unpaid`);
        }

        const admin = createAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile } = await admin
            .from('profiles')
            .select('id, parameters')
            .ilike('member_id', memberId)
            .maybeSingle();

        if (profile) {
            const params = profile.parameters || {};
            delete params.paywall;
            await admin.from('profiles').update({ parameters: params }).eq('id', profile.id);
        }

        return NextResponse.redirect(`${origin}/profile`);
    } catch {
        return NextResponse.redirect(`${origin}/profile`);
    }
}
