"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { CONFIG } from '@/scripts/config';

export default function InitiatePage() {
    const [secretPhrase, setSecretPhrase] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
            } else {
                setUserEmail(user.email || null);

                // Check if profile already exists
                const { data: profile } = await supabase
                    .from('Tasks') // Check if your table is named 'Tasks'
                    .select('*')
                    .eq('memberId', user.email)
                    .single();

                if (profile) {
                    router.push('/profile');
                }
            }
        };
        checkUser();
    }, [router]);

    const handleInitiation = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Verify Secret Phrase
        if (secretPhrase.trim().toUpperCase() !== CONFIG.AUTH_CONFIG.INITIATION_PHRASE) {
            setError("INVALID ACCESS CODE. ACCESS DENIED.");
            setLoading(false);
            return;
        }

        if (!userEmail) return;

        // Create New Profile in Supabase
        const { error: insertError } = await supabase
            .from('Tasks')
            .insert([
                {
                    memberId: userEmail,
                    title_fld: 'New Initiate',
                    hierarchy: 'HallBoy',
                    wallet: 500,
                    score: 0,
                    joined: new Date().toISOString(),
                    status: 'PUBLISHED'
                }
            ]);

        if (insertError) {
            setError("COULD NOT CREATE PROFILE: " + insertError.message);
        } else {
            router.push('/profile');
        }
        setLoading(false);
    };

    return (
        <div className="initiate-container">
            {/* Deep Security Background */}
            <div className="vignette"></div>
            <div className="scanline"></div>
            <div className="pulse-glow"></div>

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700& family=Orbitron:wght@400;700&family=Rajdhani:wght@300;500;700&display=swap');

                .initiate-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                    font-family: 'Rajdhani', sans-serif;
                    color: #fff;
                    overflow: hidden;
                    position: relative;
                }

                .vignette {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.9) 100%);
                    z-index: 1;
                    pointer-events: none;
                }

                .pulse-glow {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(255, 0, 0, 0.05) 0%, transparent 70%);
                    animation: bloodPulse 4s ease-in-out infinite;
                    z-index: 0;
                }

                @keyframes bloodPulse {
                    0% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                    100% { opacity: 0.3; transform: scale(1); }
                }

                .scanline {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
                    background-size: 100% 4px, 3px 100%;
                    pointer-events: none;
                    z-index: 2;
                }

                .gate-card {
                    background: rgba(10, 0, 0, 0.7);
                    border: 1px solid rgba(255, 0, 0, 0.3);
                    padding: 60px 50px;
                    border-radius: 2px;
                    box-shadow: 
                        0 0 100px rgba(0,0,0,1),
                        0 0 30px rgba(255,0,0,0.1);
                    width: 100%;
                    max-width: 520px;
                    text-align: center;
                    position: relative;
                    backdrop-filter: blur(20px);
                    z-index: 10;
                    animation: gateEntry 1s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes gateEntry {
                    from { opacity: 0; transform: scale(1.05) translateZ(0); filter: blur(10px); }
                    to { opacity: 1; transform: scale(1) translateZ(0); filter: blur(0); }
                }

                .security-header {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #ff0000;
                    color: #000;
                    font-size: 0.65rem;
                    padding: 3px 15px;
                    letter-spacing: 3px;
                    font-weight: 900;
                    font-family: 'Orbitron', sans-serif;
                    box-shadow: 0 0 15px rgba(255,0,0,0.5);
                    white-space: nowrap;
                }

                h1 {
                    font-family: 'Cinzel', serif;
                    color: #fff;
                    letter-spacing: 10px;
                    font-size: 1.6rem;
                    margin-bottom: 25px;
                    text-transform: uppercase;
                    text-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
                }

                .status-msg {
                    font-family: 'Rajdhani', sans-serif;
                    color: #888;
                    font-size: 0.9rem;
                    margin-bottom: 40px;
                    line-height: 1.6;
                    letter-spacing: 1px;
                }

                .user-badge {
                    color: #ff0000;
                    font-weight: 700;
                    text-shadow: 0 0 10px rgba(255,0,0,0.3);
                }

                .input-wrapper {
                    position: relative;
                    margin-bottom: 30px;
                }

                input {
                    width: 100%;
                    background: rgba(20, 0, 0, 0.6);
                    border: 1px solid rgba(255, 0, 0, 0.2);
                    padding: 20px;
                    color: #ff0000;
                    font-family: 'Orbitron', sans-serif;
                    outline: none;
                    text-align: center;
                    font-size: 1.4rem;
                    letter-spacing: 10px;
                    transition: all 0.4s;
                    border-radius: 0;
                }

                input:focus {
                    border-color: #ff0000;
                    background: rgba(255, 0, 0, 0.05);
                    box-shadow: 0 0 30px rgba(255,0,0,0.15);
                }

                input::placeholder {
                    color: rgba(255, 0, 0, 0.2);
                    letter-spacing: 4px;
                }

                .initiate-btn {
                    width: 100%;
                    background: #ff0000;
                    color: #fff;
                    border: none;
                    padding: 22px;
                    font-weight: 900;
                    letter-spacing: 6px;
                    cursor: pointer;
                    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    text-transform: uppercase;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 0.9rem;
                    position: relative;
                    overflow: hidden;
                }

                .initiate-btn:hover {
                    background: #fff;
                    color: #000;
                    letter-spacing: 8px;
                    box-shadow: 0 0 40px rgba(255, 255, 255, 0.3);
                }

                .initiate-btn:disabled {
                    background: #222;
                    color: #444;
                    cursor: not-allowed;
                }

                .btn-glitch {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255,255,255,0.1);
                    transform: translateX(-100%);
                    transition: transform 0.3s;
                }

                .initiate-btn:hover .btn-glitch {
                    transform: translateX(100%);
                }

                .error-msg {
                    color: #ff0000;
                    font-size: 0.8rem;
                    margin-top: 25px;
                    padding: 12px;
                    border: 1px dashed #ff0000;
                    font-family: 'Orbitron', sans-serif;
                    text-transform: uppercase;
                    animation: glitchAlert 0.2s infinite;
                    letter-spacing: 2px;
                }

                @keyframes glitchAlert {
                    0% { transform: translate(0); }
                    20% { transform: translate(-2px, 2px); }
                    40% { transform: translate(-2px, -2px); }
                    60% { transform: translate(2px, 2px); }
                    80% { transform: translate(2px, -2px); }
                    100% { transform: translate(0); }
                }

                .sys-status {
                    margin-top: 40px;
                    font-size: 0.5rem;
                    color: #444;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    font-family: 'Orbitron', sans-serif;
                }
            `}</style>

            <div className="gate-card">
                <div className="security-header">RESTRICTED ACCESS // LEVEL 4 CLEARANCE</div>
                <h1>THE GATE</h1>
                <div className="status-msg">
                    ID DETECTED: <span className="user-badge">{userEmail}</span><br />
                    PROTOCOL: INDUCTION REQUIRED<br />
                    STATUS: NO PROFILE RECORDED. ENTER ACTIVATION PHRASE.
                </div>

                <form onSubmit={handleInitiation}>
                    <div className="input-wrapper">
                        <input
                            type="text"
                            value={secretPhrase}
                            onChange={(e) => setSecretPhrase(e.target.value)}
                            required
                            placeholder="PHRASE"
                            autoFocus
                        />
                    </div>

                    <button type="submit" className="initiate-btn" disabled={loading}>
                        <div className="btn-glitch"></div>
                        {loading ? 'PROCESSING...' : 'INITIALIZE INDUCTION'}
                    </button>

                    {error && <div className="error-msg">{error}</div>}
                </form>

                <div className="sys-status">
                    ENCRYPTION: AES-512 ACTIVE // SYSLOG_INIT_09
                </div>
            </div>
        </div>
    );
}
