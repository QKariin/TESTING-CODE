import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // No code = unexpected state, redirect to login
    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data.user) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const user = data.user;
    const email = (user.email || '').trim().toLowerCase();

    if (CEO_EMAILS.includes(email)) {
        return NextResponse.redirect(`${origin}/dashboard`);
    }

    // Check if profile exists
    const adminSupabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('ID')
        .or(`ID.eq.${user.id}${email ? `,member_id.ilike.${email}` : ''}`)
        .limit(1)
        .maybeSingle();

    if (profile) {
        return NextResponse.redirect(`${origin}/profile`);
    }

    // No profile — capture as lead and send to tribute
    if (email) {
        const provider = user.app_metadata?.provider || 'unknown';
        const now = new Date().toISOString();
        adminSupabase.from('leads').select('id, attempts').eq('email', email).maybeSingle().then(({ data: existing }) => {
            if (existing) {
                adminSupabase.from('leads').update({ last_seen: now, attempts: (existing.attempts || 1) + 1 }).eq('email', email).then(() => {});
            } else {
                adminSupabase.from('leads').insert({ email, provider, first_seen: now, last_seen: now, attempts: 1 }).then(() => {});
            }
        });
    }

    return NextResponse.redirect(`${origin}/tribute`);
}
