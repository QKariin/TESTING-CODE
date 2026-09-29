'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

export default function AuthCallbackPage() {
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error || !code) {
            window.location.href = '/login?error=auth_failed';
            return;
        }

        const supabase = createClient();

        supabase.auth.exchangeCodeForSession(code)
            .then(async ({ data, error: exchangeError }) => {
                if (exchangeError || !data?.user) {
                    // PKCE failed — browser context switched (iOS Chrome + Twitter app)
                    setErrorMsg('Twitter opened in a different browser. Please try again in Safari, or use email/password.');
                    setTimeout(() => { window.location.href = '/login?error=session_lost'; }, 3000);
                    return;
                }

                const user = data.user;
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

                // Check profile + track lead server-side
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
            })
            .catch(() => {
                setErrorMsg('Twitter opened in a different browser. Please try again in Safari, or use email/password.');
                setTimeout(() => { window.location.href = '/login?error=session_lost'; }, 3000);
            });
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

    // Loading state — black screen while exchange happens
    return <div style={{ background: '#020202', height: '100dvh' }} />;
}
