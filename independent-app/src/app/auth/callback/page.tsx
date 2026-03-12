"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState('Verifying identity...');

    useEffect(() => {
        const run = async () => {
            const supabase = createClient();

            // Try PKCE code exchange first (OAuth 2.0 / Google)
            const code = new URLSearchParams(window.location.search).get('code');
            if (code) {
                await supabase.auth.exchangeCodeForSession(code);
            }

            // Wait for auth state — works for both OAuth 2.0 and OAuth 1.0a (Twitter)
            const finalUser = await new Promise<any>((resolve) => {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (session?.user) {
                        subscription.unsubscribe();
                        resolve(session.user);
                    }
                });
                // Also check immediately in case session already exists
                supabase.auth.getUser().then(({ data }) => {
                    if (data.user) {
                        subscription.unsubscribe();
                        resolve(data.user);
                    }
                });
                // Timeout after 8s
                setTimeout(() => { subscription.unsubscribe(); resolve(null); }, 8000);
            });

            setStatus('Checking records...');

            if (!finalUser) { router.replace('/login?error=auth_failed'); return; }

            const email = finalUser.email?.trim().toLowerCase() || '';

            if (email === 'ceo@qkarin.com' || email === 'liviacechova@gmail.com') {
                router.replace('/dashboard');
                return;
            }

            setStatus('Opening the gates...');

            try {
                const res = await fetch(`/api/slave-profile?email=${encodeURIComponent(email)}&full=true`);
                const data = await res.json();
                if (data && !data.error && data.member_id) {
                    router.replace('/profile');
                } else {
                    router.replace('/tribute');
                }
            } catch {
                router.replace('/tribute');
            }
        };

        run();
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: '#0a0a0a',
            fontFamily: "'Cinzel', serif",
        }}>
            {/* Background */}
            <div style={{
                position: 'absolute', inset: 0,
                background: "url('/login-bg.png') center center / cover no-repeat",
                zIndex: 0,
            }} />
            <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.62)',
                zIndex: 1,
            }} />

            {/* Card */}
            <div style={{
                position: 'relative', zIndex: 10,
                textAlign: 'center',
                padding: '56px 48px',
                background: 'rgba(6,4,2,0.72)',
                border: '1px solid rgba(197,160,89,0.18)',
                backdropFilter: 'blur(28px)',
                minWidth: 300,
            }}>
                <div style={{ fontSize: '1.1rem', color: 'rgba(197,160,89,0.5)', letterSpacing: 6, marginBottom: 8 }}>✦</div>
                <div style={{ fontSize: '1.25rem', color: '#c5a059', letterSpacing: 6, marginBottom: 32, textTransform: 'uppercase' }}>
                    Queen Karin
                </div>

                {/* Scanning bar */}
                <div style={{
                    width: 200, height: 2,
                    background: 'rgba(197,160,89,0.15)',
                    margin: '0 auto 28px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0,
                        height: '100%', width: '40%',
                        background: 'linear-gradient(90deg, transparent, #c5a059, transparent)',
                        animation: 'scan 1.4s ease-in-out infinite',
                    }} />
                </div>

                <div style={{
                    color: 'rgba(197,160,89,0.6)',
                    fontSize: '0.68rem',
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                }}>
                    {status}
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&display=swap');
                @keyframes scan {
                    0%   { left: -40%; }
                    100% { left: 140%; }
                }
            `}</style>
        </div>
    );
}
