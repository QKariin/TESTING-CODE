"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import '@/css/login.css';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { access_type: 'offline', prompt: 'consent' } }
        });
        if (error) { setError(error.message); setLoading(false); }
    };

    const handleTwitterLogin = async () => {
        setLoading(true);
        setError(null);
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'twitter',
            options: { redirectTo: `${window.location.origin}/auth/callback` }
        });
        if (error) { setError(error.message); setLoading(false); }
    };

    return (
        <div className="login-container">
            <div className="login-bg" />
            <div className="login-overlay" />

            <div className="login-card">
                <div className="login-crown">✦</div>
                <h1>Queen Karin</h1>
                <p className="login-subtitle">Log in to enter</p>

                <button onClick={handleGoogleLogin} className="oauth-btn" disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Login with Google
                </button>

                <button onClick={handleTwitterLogin} className="oauth-btn" disabled={loading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Login with X
                </button>

                {error && <div className="error-msg">{error}</div>}

                <div className="footer-text">Property of Queen Karin &nbsp;·&nbsp; Est. 2024</div>
            </div>
        </div>
    );
}
