import { NextResponse } from 'next/server'
// The client you created in Step 1
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    console.log('[AUTH_CALLBACK_DEBUG] Full URL:', request.url);
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect address
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            const user = data.user;

            // Create Admin Client for Lazy Matching (Bypasses RLS)
            const { createClient: createAdminClient } = await import('@supabase/supabase-js');
            const supabaseAdmin = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // 1. Check if profile exists by ID
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single();

            // 2. If not found, try matching by email
            if (!profile && user.email) {
                console.log(`[CALLBACK_DEBUG] ID mismatch, checking email: ${user.email}`);
                const { data: legacyProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, member_id')
                    .eq('member_id', user.email)
                    .single();

                if (legacyProfile) {
                    console.log(`[CALLBACK_DEBUG] Match found! Linking ${user.email} -> ${user.id}`);
                    await supabaseAdmin
                        .from('profiles')
                        .update({ id: user.id })
                        .eq('member_id', user.email);
                }
            }

            const requestUrl = new URL(request.url)
            const redirectUrl = new URL(next, requestUrl.origin)
            return NextResponse.redirect(redirectUrl)
        } else {
            const errorMsg = error?.message || 'Exchange failed';
            console.error('[AUTH_CALLBACK_ERROR]', errorMsg);
            return NextResponse.redirect(`${origin}/login?error=auth_failed&msg=${encodeURIComponent(errorMsg)}`)
        }
    } else {
        return NextResponse.redirect(`${origin}/login?error=no_code`)
    }
}
