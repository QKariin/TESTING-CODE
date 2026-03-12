"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import '@/css/tribute.css';

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserAndCheck = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const display = user.email
                    || (user.user_metadata?.user_name ? `@${user.user_metadata.user_name}` : null)
                    || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : null)
                    || 'Unknown';
                setUserEmail(display);
                handleRefresh();
            }
        };
        fetchUserAndCheck();
    }, []);

    const handleTribute = async () => {
        setLoading(true);
        setStatus(null);
        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'entrance_tribute' })
            });
            const data = await response.json();
            if (data.url) window.location.href = data.url;
        } catch {
            setStatus('Connection error. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const handleRefresh = async () => {
        setLoading(true);
        setStatus('Scanning records...');
        try {
            const res = await fetch('/api/auth/link-profile', { method: 'POST' });
            const data = await res.json();
            if (data.success && data.linked) {
                setStatus('Profile located. Redirecting...');
                setTimeout(() => { window.location.href = '/profile'; }, 1500);
            } else {
                setStatus(data.message === 'No profile found to link' ? 'No record found.' : null);
                setLoading(false);
            }
        } catch {
            setStatus('Scan failed. Try again.');
            setLoading(false);
        }
    };

    return (
        <div className="tribute-container">
            <div className="tribute-bg" />
            <div className="tribute-overlay" />

            <div className="tribute-card">
                <div className="tribute-crown">✦</div>
                <h1>Queen Karin</h1>
                <p className="tribute-subtitle">Entrance Tribute Required</p>

                <div className="tribute-gate">
                    The gates are locked
                    <strong>$55 entrance tribute required</strong>
                </div>

                <button className="tribute-btn" onClick={handleTribute} disabled={loading}>
                    {loading ? 'Initializing...' : 'Send Tribute — $55'}
                </button>

                {userEmail && (
                    <div className="tribute-identity">
                        Logged in as
                        <strong>{userEmail}</strong>
                    </div>
                )}

                <div className="tribute-links">
                    <button className="tribute-link" onClick={handleRefresh} disabled={loading}>
                        Already paid? Re-check profile
                    </button>
                    <button className="tribute-link" onClick={handleLogout} disabled={loading}>
                        Logout / Switch account
                    </button>
                </div>

                {status && <div className="tribute-status">{status}</div>}

                <div className="tribute-footer">Property of Queen Karin &nbsp;·&nbsp; Est. 2024</div>
            </div>
        </div>
    );
}
