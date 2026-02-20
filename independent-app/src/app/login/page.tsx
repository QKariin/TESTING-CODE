/** v1.0.1 - Force build Google OAuth integration */
"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const supabase = createClient();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else {
            router.push('/dashboard');
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            }
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Cinematic Procedural Background */}
            <div className="vignette"></div>
            <div className="particle-layer"></div>
            <div className="scanner-line"></div>

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap');

                .login-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at center, #1a0f00 0%, #050505 100%);
                    font-family: 'Rajdhani', sans-serif;
                    color: #fff;
                    overflow: hidden;
                    position: relative;
                }

                /* Deep Shadows & Vignette */
                .vignette {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 100%);
                    pointer-events: none;
                    z-index: 1;
                }

                /* Procedural Dust Particles */
                .particle-layer {
                    position: absolute;
                    inset: 0;
                    background-image: 
                        radial-gradient(circle at 20% 30%, rgba(197, 160, 89, 0.05) 1px, transparent 1px),
                        radial-gradient(circle at 80% 70%, rgba(197, 160, 89, 0.05) 1px, transparent 1px);
                    background-size: 100px 100px, 150px 150px;
                    animation: drift 20s linear infinite;
                    opacity: 0.5;
                }

                @keyframes drift {
                    from { transform: translateY(0); }
                    to { transform: translateY(-100px); }
                }

                /* Tactical Scanner Line */
                .scanner-line {
                    position: absolute;
                    top: -100px;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, rgba(197, 160, 89, 0.5), transparent);
                    box-shadow: 0 0 15px rgba(197, 160, 89, 0.5);
                    animation: scan 8s ease-in-out infinite;
                    z-index: 2;
                    pointer-events: none;
                }

                @keyframes scan {
                    0% { top: -10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 110%; opacity: 0; }
                }

                .login-card {
                    background: rgba(15, 15, 15, 0.6);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    padding: 50px 40px;
                    border-radius: 2px;
                    box-shadow: 
                        0 0 50px rgba(0,0,0,0.9),
                        inset 0 0 20px rgba(197, 160, 89, 0.05);
                    width: 100%;
                    max-width: 420px;
                    text-align: center;
                    backdrop-filter: blur(25px);
                    z-index: 10;
                    position: relative;
                    animation: cardEntry 1.5s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes cardEntry {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .card-border-glow {
                    position: absolute;
                    inset: -1px;
                    border-radius: 2px;
                    background: linear-gradient(45deg, transparent 40%, rgba(197, 160, 89, 0.3), transparent 60%);
                    background-size: 200% 200%;
                    animation: borderGlow 4s linear infinite;
                    pointer-events: none;
                }

                @keyframes borderGlow {
                    from { background-position: 200% 0; }
                    to { background-position: -200% 0; }
                }

                h1 {
                    font-family: 'Cinzel', serif;
                    color: #c5a059;
                    letter-spacing: 8px;
                    font-size: 1.5rem;
                    margin-bottom: 40px;
                    text-transform: uppercase;
                    text-shadow: 0 0 20px rgba(197, 160, 89, 0.3);
                }

                .input-group {
                    margin-bottom: 25px;
                    text-align: left;
                    position: relative;
                }

                label {
                    display: block;
                    font-size: 0.65rem;
                    color: #888;
                    margin-bottom: 8px;
                    letter-spacing: 2px;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                input {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(197, 160, 89, 0.15);
                    padding: 14px 16px;
                    color: #fff;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 1rem;
                    letter-spacing: 1px;
                    outline: none;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    border-radius: 0;
                }

                input:focus {
                    border-color: #c5a059;
                    background: rgba(197, 160, 89, 0.05);
                    box-shadow: 0 0 20px rgba(197, 160, 89, 0.1);
                }

                .login-btn {
                    width: 100%;
                    background: #c5a059;
                    color: #000;
                    border: none;
                    padding: 18px;
                    font-weight: 700;
                    letter-spacing: 4px;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    text-transform: uppercase;
                    font-family: 'Cinzel', serif;
                    font-size: 0.9rem;
                    position: relative;
                    overflow: hidden;
                }

                .login-btn:hover {
                    background: #fff;
                    letter-spacing: 6px;
                    box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
                }

                .google-btn {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    padding: 16px;
                    font-weight: 500;
                    letter-spacing: 2px;
                    cursor: pointer;
                    margin-top: 10px;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    text-transform: uppercase;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }

                .google-btn:hover {
                    background: rgba(197, 160, 89, 0.1);
                    border-color: #c5a059;
                    color: #c5a059;
                }

                .divider {
                    margin: 25px 0;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    color: #444;
                    font-size: 0.6rem;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                }

                .divider::before, .divider::after {
                    content: "";
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, #222, transparent);
                }

                .login-btn:disabled, .google-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background: #333;
                    color: #666;
                }

                .btn-shine {
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 50%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    transition: all 0.6s;
                }

                .login-btn:hover .btn-shine {
                    left: 200%;
                }

                .error-msg {
                    color: #ff4d4d;
                    font-size: 0.75rem;
                    margin-top: 20px;
                    padding: 10px;
                    background: rgba(255, 77, 77, 0.1);
                    border-left: 2px solid #ff4d4d;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .footer-text {
                    margin-top: 40px;
                    font-size: 0.55rem;
                    color: #555;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                }

                .loading-spinner {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(0,0,0,0.3);
                    border-top-color: #000;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin-right: 10px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div className="login-card">
                <div className="card-border-glow"></div>
                <h1>IDENTIFICATION</h1>

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>MEMBER EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="NAME@PROTOCOL.COM"
                        />
                    </div>

                    <div className="input-group">
                        <label>PASSWORD</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        <div className="btn-shine"></div>
                        {loading ? (
                            <>
                                <span className="loading-spinner"></span>
                                VERIFYING...
                            </>
                        ) : 'ACCESS SYSTEM'}
                    </button>
                </form>

                <div className="divider">OR USE FEDERATED ID</div>

                <button
                    onClick={handleGoogleLogin}
                    className="google-btn"
                    disabled={loading}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google Authentication
                </button>

                {error && <div className="error-msg">ACCESS DENIED: {error.toUpperCase()}</div>}

                <div className="footer-text">PROPERTY OF QUEEN KARIN // EST. 2024</div>
            </div>
        </div>
    );
}
