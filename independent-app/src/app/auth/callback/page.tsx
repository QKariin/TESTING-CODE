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
                setStatus('Authenticating via hash...');
                const { data } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: hash.get('refresh_token') || '',
                });
                if (data?.user) {
                    const identifier = data.user.email || getTwitterIdentifier(data.user);
                    setStatus(`Hash user found: ${identifier || 'NO_ID'}`);
                    if (identifier) { await routeUser(identifier); return; }
                }
            }

            // Google / Twitter PKCE — wait for session
            setStatus('Waiting for session...');
            const user = await new Promise<any>((resolve) => {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
                    if (session?.user) { subscription.unsubscribe(); resolve(session.user); }
                });
                supabase.auth.getUser().then(({ data }) => {
                    if (data.user) { subscription.unsubscribe(); resolve(data.user); }
                });
                setTimeout(() => { subscription.unsubscribe(); resolve(null); }, 8000);
            });

            if (!user) {
                setStatus('No session found — check URL below');
                const info = `search=${window.location.search}|hash=${window.location.hash.substring(0, 80) || 'empty'}`;
                setTimeout(() => router.replace(`/login?error=auth_failed&info=${encodeURIComponent(info)}`), 3000);
                return;
            }

            const identifier = user.email || getTwitterIdentifier(user);
            if (!identifier) {
                const meta = JSON.stringify(user.user_metadata || {});
                setStatus(`User found but no identifier. Meta: ${meta.substring(0, 100)}`);
                setTimeout(() => router.replace(`/login?error=no_identifier&meta=${encodeURIComponent(meta)}`), 5000);
                return;
            }

            await routeUser(identifier);
        };

        const routeUser = async (identifier: string) => {
            setStatus(`Routing: ${identifier.substring(0, 30)}...`);
            const id = identifier.trim().toLowerCase();
            if (id === 'ceo@qkarin.com' || id === 'liviacechova@gmail.com') {
                router.replace('/dashboard');
                return;
            }
            try {
                const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(id)}&full=true`);
                const data = await res.json();
                router.replace(data?.member_id ? '/profile' : '/tribute');
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
            letterSpacing: '3px',
            textTransform: 'uppercase',
            padding: '20px',
            textAlign: 'center',
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
