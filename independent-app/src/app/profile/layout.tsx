'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const [silenced, setSilenced] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        // Restore from sessionStorage immediately (no network delay)
        if (sessionStorage.getItem('__silenced') === '1') {
            setSilenced(true);
            setReason(sessionStorage.getItem('__silenceReason') || '');
        }

        let active = true;
        let interval: ReturnType<typeof setInterval>;

        async function init() {
            try {
                const supabase = createClient();
                // getSession reads from local storage — no network call, instant
                const { data: { session } } = await supabase.auth.getSession();
                const email = session?.user?.email;
                if (!email || !active) return;

                async function check() {
                    try {
                        const res = await fetch('/api/silence-check', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ memberId: email }),
                        });
                        const data = await res.json();
                        if (!active) return;
                        if (data.silence === true) {
                            sessionStorage.setItem('__silenced', '1');
                            sessionStorage.setItem('__silenceReason', data.reason || '');
                            setSilenced(true);
                            setReason(data.reason || '');
                        } else {
                            sessionStorage.removeItem('__silenced');
                            sessionStorage.removeItem('__silenceReason');
                            setSilenced(false);
                        }
                    } catch {}
                }

                await check();
                if (active) interval = setInterval(check, 3000);
            } catch {}
        }

        init();
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    if (silenced) return (
        <div style={{
            position: 'fixed', top: 0, left: 0,
            width: '100vw', height: '100dvh',
            background: 'rgba(8,2,2,0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box',
            fontFamily: 'Cinzel, serif',
            zIndex: 2147483647,
        }}>
            <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <svg viewBox="0 0 24 24" width="52" height="52" fill="rgba(220,60,60,0.7)">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.68L5.68 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.68L18.32 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
                    </svg>
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(220,60,60,0.6)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>
                    ACCESS REVOKED
                </div>
                <div style={{ background: 'rgba(220,60,60,0.04)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 14, padding: '28px 24px' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(220,60,60,0.4)', letterSpacing: '3px', marginBottom: 12, textTransform: 'uppercase' }}>
                        Message from Queen Karin
                    </div>
                    <div style={{ fontSize: '1.05rem', color: '#fff', lineHeight: 1.6, letterSpacing: '0.5px' }}>
                        {reason}
                    </div>
                </div>
            </div>
        </div>
    );

    return <>{children}</>;
}
