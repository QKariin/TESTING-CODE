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
            <style jsx>{`
                .initiate-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                    font-family: 'Cinzel', serif;
                    color: #fff;
                    overflow: hidden;
                }

                .gate-card {
                    background: rgba(15, 0, 0, 0.9);
                    border: 1px solid #ff0000;
                    padding: 50px;
                    border-radius: 4px;
                    box-shadow: 0 0 100px rgba(255,0,0,0.1);
                    width: 100%;
                    max-width: 500px;
                    text-align: center;
                    position: relative;
                }

                .gate-card::before {
                    content: 'UNAUTHORIZED ACCESS';
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #ff0000;
                    color: #000;
                    font-size: 0.6rem;
                    padding: 2px 10px;
                    letter-spacing: 2px;
                    font-weight: bold;
                }

                h1 {
                    color: #fff;
                    letter-spacing: 6px;
                    font-size: 1.5rem;
                    margin-bottom: 20px;
                    text-transform: uppercase;
                }

                p {
                    font-family: 'Rajdhani', sans-serif;
                    color: #888;
                    font-size: 0.9rem;
                    margin-bottom: 30px;
                    letter-spacing: 1px;
                }

                input {
                    width: 100%;
                    background: #111;
                    border: 1px solid #333;
                    padding: 15px;
                    color: #ff0000;
                    font-family: 'Orbitron', sans-serif;
                    outline: none;
                    text-align: center;
                    font-size: 1.2rem;
                    letter-spacing: 4px;
                    margin-bottom: 20px;
                }

                input:focus {
                    border-color: #ff0000;
                    box-shadow: 0 0 15px rgba(255,0,0,0.2);
                }

                .initiate-btn {
                    width: 100%;
                    background: #ff0000;
                    color: #fff;
                    border: none;
                    padding: 20px;
                    font-weight: bold;
                    letter-spacing: 4px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                }

                .initiate-btn:hover {
                    box-shadow: 0 0 30px rgba(255,0,0,0.5);
                    transform: scale(1.02);
                }

                .error-msg {
                    color: #ff0000;
                    font-size: 0.8rem;
                    margin-top: 20px;
                    font-family: 'Orbitron', sans-serif;
                    text-transform: uppercase;
                    animation: blink 1s infinite;
                }

                @keyframes blink {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>

            <div className="gate-card">
                <h1>INITIATION GATE</h1>
                <p>IDENTIFICATION COMPLETE: {userEmail}<br />NO PROFILE FOUND. ENTER YOUR ACTIVATION CODE TO BEGIN INDUCTION.</p>

                <form onSubmit={handleInitiation}>
                    <input
                        type="text"
                        value={secretPhrase}
                        onChange={(e) => setSecretPhrase(e.target.value)}
                        required
                        placeholder="ENTER CODE"
                        autoFocus
                    />

                    <button type="submit" className="initiate-btn" disabled={loading}>
                        {loading ? 'PROCESSING...' : 'ACTIVATE ACCOUNT'}
                    </button>

                    {error && <div className="error-msg">{error}</div>}
                </form>
            </div>
        </div>
    );
}
