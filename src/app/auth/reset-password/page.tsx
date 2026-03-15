"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setError(error.message);
        } else {
            setDone(true);
            setTimeout(() => router.push('/login'), 2500);
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1a0f00 0%, #050505 100%)', fontFamily: "'Rajdhani', sans-serif", color: '#fff' }}>
            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap');
                .card { background: rgba(15,15,15,0.6); border: 1px solid rgba(197,160,89,0.2); padding: 50px 40px; border-radius: 2px; box-shadow: 0 0 50px rgba(0,0,0,0.9); width: 100%; max-width: 420px; text-align: center; backdrop-filter: blur(25px); }
                h1 { font-family: 'Cinzel', serif; color: #c5a059; letter-spacing: 8px; font-size: 1.3rem; margin-bottom: 36px; text-transform: uppercase; }
                .ig { margin-bottom: 22px; text-align: left; }
                label { display: block; font-size: 0.65rem; color: #888; margin-bottom: 8px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; }
                input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(197,160,89,0.15); padding: 14px 16px; color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 1rem; outline: none; transition: all 0.3s; box-sizing: border-box; }
                input:focus { border-color: #c5a059; background: rgba(197,160,89,0.05); }
                .btn { width: 100%; background: #c5a059; color: #000; border: none; padding: 18px; font-weight: 700; letter-spacing: 4px; cursor: pointer; margin-top: 20px; font-family: 'Cinzel', serif; font-size: 0.9rem; transition: all 0.3s; text-transform: uppercase; }
                .btn:hover { background: #fff; letter-spacing: 6px; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; background: #333; color: #666; }
                .err { color: #ff4d4d; font-size: 0.75rem; margin-top: 16px; padding: 10px; background: rgba(255,77,77,0.1); border-left: 2px solid #ff4d4d; text-transform: uppercase; letter-spacing: 1px; }
                .ok { color: #c5a059; font-size: 0.8rem; margin-top: 16px; padding: 12px; background: rgba(197,160,89,0.08); border-left: 2px solid #c5a059; letter-spacing: 1px; }
                .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(0,0,0,0.3); border-top-color: #000; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 10px; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <div className="card">
                <h1>NEW PASSWORD</h1>
                {done ? (
                    <div className="ok">Password updated. Redirecting to login...</div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="ig">
                            <label>NEW PASSWORD</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                        </div>
                        <div className="ig">
                            <label>CONFIRM PASSWORD</label>
                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
                        </div>
                        <button type="submit" className="btn" disabled={loading}>
                            {loading ? <><span className="spinner"></span>UPDATING...</> : 'SET NEW PASSWORD'}
                        </button>
                        {error && <div className="err">⚠ {error.toUpperCase()}</div>}
                    </form>
                )}
            </div>
        </div>
    );
}
