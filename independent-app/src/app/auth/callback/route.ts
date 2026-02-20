import { NextResponse } from 'next/server'
// The client you created in Step 1
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect address
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const requestUrl = new URL(request.url)
            const redirectUrl = new URL(next, requestUrl.origin)
            return NextResponse.redirect(redirectUrl)
        } else {
            console.error('[AUTH_CALLBACK_ERROR]', error.message);
            return NextResponse.redirect(`${origin}/login?error=auth_failed&msg=${encodeURIComponent(error.message)}`)
        }
    } else {
        return NextResponse.redirect(`${origin}/login?error=no_code`)
    }
}
