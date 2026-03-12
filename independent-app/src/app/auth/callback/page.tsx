"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

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
                if (data?.user?.email) {
                    await redirect(data.user.email);
                    return;
                }
            }

            // Google OAuth 2.0 — browser client auto-exchanges the ?code= param,
            // just wait for the session to be established
            const user = await new Promise<any>((resolve) => {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
                    if (session?.user) { subscription.unsubscribe(); resolve(session.user); }
                });
                supabase.auth.getUser().then(({ data }) => {
                    if (data.user) { subscription.unsubscribe(); resolve(data.user); }
                });
                setTimeout(() => { subscription.unsubscribe(); resolve(null); }, 8000);
            });

            if (!user?.email) {
                const debugInfo = `search=${window.location.search} hash=${window.location.hash.substring(0, 60) || 'empty'}`;
                router.replace(`/login?error=auth_failed&info=${encodeURIComponent(debugInfo)}`);
                return;
            }

            await redirect(user.email);
        };

        const redirect = async (email: string) => {
            setStatus('Access granted...');
            const e = email.trim().toLowerCase();
            if (e === 'ceo@qkarin.com' || e === 'liviacechova@gmail.com') {
                router.replace('/dashboard');
                return;
            }
            try {
                const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(e)}&full=true`);
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
