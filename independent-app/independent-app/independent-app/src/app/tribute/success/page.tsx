"use client";

import { useEffect, useState } from 'react';
import '@/css/tribute.css';

export default function TributeSuccessPage() {
    const [status, setStatus] = useState('Tribute received. Initializing your station...');

    useEffect(() => {
        const sessionId = new URLSearchParams(window.location.search).get('session_id');
        let attempts = 0;
        const maxAttempts = 15;

        const check = async () => {
            attempts++;
            try {
                // First try direct verification via Stripe session (most reliable)
                if (sessionId) {
                    const res = await fetch('/api/tribute/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId }),
                    });
                    const data = await res.json();
                    if (data.success) {
                        setStatus('Profile confirmed. Entering...');
                        setTimeout(() => { window.location.href = '/profile'; }, 1000);
                        return;
                    }
                }

                // Fallback: check if webhook already created it
                const res2 = await fetch('/api/auth/link-profile', { method: 'POST' });
                const data2 = await res2.json();
                if (data2.success && data2.linked) {
                    setStatus('Profile confirmed. Entering...');
                    setTimeout(() => { window.location.href = '/profile'; }, 1000);
                    return;
                }
            } catch { }

            if (attempts >= maxAttempts) {
                setStatus('Taking longer than expected. Click below to enter.');
                return;
            }

            setStatus(`Confirming your record${'.'.repeat((attempts % 3) + 1)}`);
            setTimeout(check, 2000);
        };

        setTimeout(check, 2000);
    }, []);

    return (
        <div className="tribute-container">
            <div className="tribute-bg" />
            <div className="tribute-overlay" />

            <div className="tribute-card" style={{ textAlign: 'center' }}>
                <div className="tribute-crown">✦</div>
                <h1>Queen Karin</h1>
                <p className="tribute-subtitle">Tribute Accepted</p>

                <p className="tribute-desc">
                    Your offering has been received.<br />
                    The archives are being updated.
                </p>

                <div style={{
                    margin: '24px 0',
                    fontSize: '0.65rem',
                    color: '#c5a059',
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                    minHeight: '20px',
                }}>
                    {status}
                </div>

                {status.includes('Click below') && (
                    <button
                        className="tribute-btn"
                        onClick={() => { window.location.href = '/profile'; }}
                    >
                        Enter
                    </button>
                )}

                <div className="tribute-footer">Property of Queen Karin &nbsp;·&nbsp; Est. 2024</div>
            </div>
        </div>
    );
}
