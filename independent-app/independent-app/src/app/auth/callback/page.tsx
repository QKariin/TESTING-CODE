"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

function getTwitterIdentifier(user: any): string | null {
    const providerId = user?.user_metadata?.provider_id
        || user?.user_metadata?.sub
        || user?.identities?.find((i: any) => i.provider === 'twitter')?.id;
    return providerId ? `twitter_${providerId}` : null;
}

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState('Verifying identity...');

    useEffect(() => {
        const handle = async () => {
            const supabase = createClient();

            // Twitter OAuth 1.0a — tokens arrive in URL hash, must be set manually
            const hash = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hash.get('access_token');
            if (accessToken) {
                setStatus('Authenticating...');
                const { data } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: hash.get('refresh_token') || '',
                });
                if (data?.user) {
                    const identifier = data.user.email || getTwitterIdentifier(data.user);
                    if (identifier) { await routeUser(identifier); return; }
                }
            }

            // Google OAuth 2.0 — browser client auto-exchanges the ?code= param
            const user = await new Promise<any>((resolve) => {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
                    if (session?.user) { subscription.unsubscribe(); resolve(session.user); }
                });
                supabase.auth.getUser().then(({ data }) => {
                    if (data.user) { subscription.unsubscribe(); resolve(data.user); }
                });
                setTimeout(() => { subscription.unsubscribe(); resolve(null); }, 8000);
            });

            if (!user) { router.replace('/login?error=auth_failed'); return; }

            const identifier = user.email || getTwitterIdentifier(user);
            if (!identifier) { router.replace('/login?error=auth_failed'); return; }

            await routeUser(identifier);
        };

        const routeUser = async (identifier: string) => {
            setStatus('Access granted...');
            const id = identifier.trim().toLowerCase();
            if (id === 'ceo@qkarin.com' || id === 'liviacechova@gmail.com') {
                router.replace('/dashboard');
                return;
            }
            try {
                const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(id)}&full=true`);
                const data = await res.json();
                router.replace((data?.memberId || data?.member_id) ? '/profile' : '/tribute');
            } catch {
                router.replace('/tribute');
            }
        };

        handle();
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            fontFamily: "'Cinzel', serif",
            color: '#c5a059',
            flexDirection: 'column',
            gap: '20px',
            fontSize: '0.75rem',
            letterSpacing: '4px',
            textTransform: 'uppercase',
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <div style={{
                width: '40px', height: '40px',
                border: '1px solid rgba(197,160,89,0.3)',
                borderTopColor: '#c5a059',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <div>{status}</div>
        </div>
    );
}
