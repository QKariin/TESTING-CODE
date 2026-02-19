"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
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

    return (
        <div className="login-container">
            <style jsx>{`
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #050505;
                    font-family: 'Cinzel', serif;
                    color: #fff;
                    background-image: 
                        radial-gradient(circle at 50% 50%, rgba(197, 160, 89, 0.05) 0%, transparent 70%),
                        linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)),
                        url('https://static.wixstatic.com/media/ce3e5b_5fc6a144908b493b9473757471ec7ebb~mv2.png');
                    background-size: cover, cover, cover;
                    background-position: center;
                }

                .login-card {
                    background: rgba(10, 10, 10, 0.9);
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    padding: 40px;
                    border-radius: 4px;
                    box-shadow: 0 0 50px rgba(0,0,0,0.8);
                    width: 100%;
                    max-width: 400px;
                    text-align: center;
                    backdrop-filter: blur(10px);
                }

                h1 {
                    color: #c5a059;
                    letter-spacing: 4px;
                    font-size: 1.8rem;
                    margin-bottom: 30px;
                    text-transform: uppercase;
                }

                .input-group {
                    margin-bottom: 20px;
                    text-align: left;
                }

                label {
                    display: block;
                    font-size: 0.7rem;
                    color: #888;
                    margin-bottom: 5px;
                    letter-spacing: 1px;
                }

                input {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    padding: 12px;
                    color: #fff;
                    font-family: 'Rajdhani', sans-serif;
                    outline: none;
                    transition: all 0.3s ease;
                }

                input:focus {
                    border-color: #c5a059;
                    background: rgba(255, 255, 255, 0.1);
                }

                .login-btn {
                    width: 100%;
                    background: #c5a059;
                    color: #000;
                    border: none;
                    padding: 15px;
                    font-weight: bold;
                    letter-spacing: 2px;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                }

                .login-btn:hover {
                    background: #fff;
                    transform: translateY(-2px);
                }

                .error-msg {
                    color: #ff4d4d;
                    font-size: 0.8rem;
                    margin-top: 15px;
                    font-family: 'Rajdhani', sans-serif;
                }

                .footer-text {
                    margin-top: 30px;
                    font-size: 0.6rem;
                    color: #444;
                    letter-spacing: 2px;
                }
            `}</style>

            <div className="login-card">
                <h1>IDENTIFICATION</h1>
                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>MEMBER EMAIL</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Enter email..."
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
                        {loading ? 'VERIFYING...' : 'ACCESS SYSTEM'}
                    </button>

                    {error && <div className="error-msg">{error}</div>}
                </form>

                <div className="footer-text">PROPERTY OF QUEEN KARIN</div>
            </div>
        </div>
    );
}
