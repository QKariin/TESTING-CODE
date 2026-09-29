'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

export default function AuthCallbackPage() {
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace('#', ''));

        const code = params.get('code');              // OAuth 2.0 PKCE
        const accessToken = hash.get('access_token'); // OAuth 1.0a (deprecated) — no PKCE
        const urlError = params.get('error');

        if (urlError) {
            window.location.href = '/login?error=auth_failed';
            return;
        }

        const redirectUser = async (user: any) => {
            let email = (user.email || '').trim().toLowerCase();
            if (!email) {
                const provider = user.app_metadata?.provider || 'oauth';
                const providerId = user.user_metadata?.provider_id || user.id;
                email = `${provider}_${providerId}@${provider}.com`;
            }

            if (CEO_EMAILS.includes(email)) {
                window.location.href = '/dashboard';
                return;
            }

            try {
                const res = await fetch('/api/auth/finalize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, userId: user.id, provider: user.app_metadata?.provider }),
                });
                const json = await res.json();
                window.location.href = json.hasProfile ? '/profile' : '/tribute';
            } catch {
                window.location.href = '/profile';
            }
        };

        if (accessToken) {
            // OAuth 1.0a (deprecated Twitter) — Supabase sets session from URL hash automatically.
            // No PKCE needed, works across all mobile browser contexts.
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    redirectUser(user);
                } else {
                    // Give Supabase a moment to process the hash
                    setTimeout(async () => {
                        const { data: { user: u } } = await supabase.auth.getUser();
                        if (u) {
                            redirectUser(u);
                        } else {
                            window.location.href = '/login?error=auth_failed';
                        }
                    }, 300);
                }
            });
            return;
        }

        if (code) {
            // OAuth 2.0 PKCE — needs localStorage code_verifier from same browser context.
            // Works on Android (Chrome Custom Tabs) and iOS Safari (SFSafariViewController).
            // Fails on iOS Chrome when Twitter app intercepts the flow.
            supabase.auth.exchangeCodeForSession(code)
                .then(async ({ data, error: exchangeError }) => {
                    if (exchangeError || !data?.user) {
                        setErrorMsg('Twitter opened in a different browser. Please open in Safari or use email/password to log in.');
                        setTimeout(() => { window.location.href = '/login?error=session_lost'; }, 4000);
                        return;
                    }
                    redirectUser(data.user);
                })
                .catch(() => {
                    setErrorMsg('Twitter opened in a different browser. Please open in Safari or use email/password to log in.');
                    setTimeout(() => { window.location.href = '/login?error=session_lost'; }, 4000);
                });
            return;
        }

        // No code or token — redirect to login
        window.location.href = '/login?error=auth_failed';
    }, []);

    if (errorMsg) {
        return (
            <div style={{ background: '#020202', height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cinzel, serif', color: 'rgba(197,160,89,0.5)', letterSpacing: 6, fontSize: '0.65rem', textTransform: 'uppercase' }}>Queen Karin</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', lineHeight: 1.6, maxWidth: 300 }}>{errorMsg}</div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', letterSpacing: 2 }}>Redirecting...</div>
            </div>
        );
    }

    return <div style={{ background: '#020202', height: '100dvh' }} />;
}
