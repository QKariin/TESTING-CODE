import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getRedirectForEmail(email: string, origin: string): Promise<string> {
    const email_lower = email.trim().toLowerCase();
    if (email_lower === 'ceo@qkarin.com' || email_lower === 'liviacechova@gmail.com') {
        return `${origin}/dashboard`;
    }
    try {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('member_id')
            .ilike('member_id', email_lower)
            .maybeSingle();
        if (data?.member_id) return `${origin}/profile`;
    } catch { }
    return `${origin}/tribute`;
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorParam)}`);
    }

    const supabase = await createClient();

    // OAuth 2.0 (Google) — exchange the code for a session
    if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.user) {
            return NextResponse.redirect(`${origin}/login?error=auth_failed`);
        }
        const email = data.user.email;
        if (!email) return NextResponse.redirect(`${origin}/tribute`);
        const dest = await getRedirectForEmail(email, origin);
        return NextResponse.redirect(dest);
    }

    // OAuth 1.0a (Twitter deprecated) — session already set in cookies by Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
        const dest = await getRedirectForEmail(user.email, origin);
        return NextResponse.redirect(dest);
    }

    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
