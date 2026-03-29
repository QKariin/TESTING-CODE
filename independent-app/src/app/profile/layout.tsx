'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const [silenced, setSilenced] = useState(false);
    const [silenceReason, setSilenceReason] = useState('');
    const [paywalled, setPaywalled] = useState(false);
    const [paywallReason, setPaywallReason] = useState('');
    const [paywallAmount, setPaywallAmount] = useState(0);

    useEffect(() => {
        if (sessionStorage.getItem('__silenced') === '1') {
            setSilenced(true);
            setSilenceReason(sessionStorage.getItem('__silenceReason') || '');
        }
        if (sessionStorage.getItem('__paywalled') === '1') {
            setPaywalled(true);
            setPaywallReason(sessionStorage.getItem('__paywallReason') || '');
            setPaywallAmount(Number(sessionStorage.getItem('__paywallAmount') || '0'));
        }

        let active = true;
        let interval: ReturnType<typeof setInterval>;

        async function init() {
            try {
                const supabase = createClient();
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
                            setSilenceReason(data.reason || '');
                        } else {
                            sessionStorage.removeItem('__silenced');
                            sessionStorage.removeItem('__silenceReason');
                            setSilenced(false);
                        }

                        if (data.paywall === true) {
                            sessionStorage.setItem('__paywalled', '1');
                            sessionStorage.setItem('__paywallReason', data.paywallReason || '');
                            sessionStorage.setItem('__paywallAmount', String(data.paywallAmount || 0));
                            setPaywalled(true);
                            setPaywallReason(data.paywallReason || '');
                            setPaywallAmount(data.paywallAmount || 0);
                        } else {
                            sessionStorage.removeItem('__paywalled');
                            sessionStorage.removeItem('__paywallReason');
                            sessionStorage.removeItem('__paywallAmount');
                            setPaywalled(false);
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
                        {silenceReason}
                    </div>
                </div>
            </div>
        </div>
    );

    if (paywalled) return (
        <div style={{
            position: 'fixed', top: 0, left: 0,
            width: '100vw', height: '100dvh',
            background: 'rgba(4,3,0,0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box',
            fontFamily: 'Cinzel, serif',
            zIndex: 2147483647,
        }}>
            <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <svg viewBox="0 0 24 24" width="52" height="52" fill="rgba(197,160,89,0.8)">
                        <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                    </svg>
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', color: 'rgba(197,160,89,0.8)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>
                    TRIBUTE REQUIRED
                </div>
                <div style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 14, padding: '28px 24px' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', marginBottom: 12, textTransform: 'uppercase' }}>
                        Message from Queen Karin
                    </div>
                    <div style={{ fontSize: '1.05rem', color: '#fff', lineHeight: 1.6, letterSpacing: '0.5px', marginBottom: paywallAmount > 0 ? 20 : 0 }}>
                        {paywallReason}
                    </div>
                    {paywallAmount > 0 && (
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.3rem', color: 'rgba(197,160,89,0.9)', letterSpacing: '2px', marginTop: 8 }}>
                            €{paywallAmount}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return <>{children}</>;
}
