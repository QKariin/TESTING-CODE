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
            const code = new URLSearchParams(window.location.search).get('code');

            // Google OAuth 2.0 — exchange code first
            if (code) {
                setStatus('Authenticating...');
                try {
                    await supabase.auth.exchangeCodeForSession(code);
                } catch { /* handled below */ }
            }

            // Get session — also processes URL hash for Twitter OAuth 1.0a
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user?.email) {
                router.replace('/login?error=auth_failed');
                return;
            }

            setStatus('Access granted...');
            const email = user.email.trim().toLowerCase();

            if (email === 'ceo@qkarin.com' || email === 'liviacechova@gmail.com') {
                router.replace('/dashboard');
                return;
            }

            try {
                const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(email)}&full=true`);
                const data = await res.json();
                if (data?.member_id) {
                    router.replace('/profile');
                } else {
                    router.replace('/tribute');
                }
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
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap');`}</style>
            <div style={{
                width: '40px',
                height: '40px',
                border: '1px solid rgba(197,160,89,0.3)',
                borderTopColor: '#c5a059',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div>{status}</div>
        </div>
    );
}
