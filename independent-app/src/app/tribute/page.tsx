"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [status, setStatus] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    
    // Initialize the cookie-aware client
    const supabase = createClient();

    useEffect(() => {
        const fetchUserAndCheck = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
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
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Tribute failed:', error);
            setStatus("CONECTION ERROR. TRY AGAIN.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        // This now uses the correct client to clear the cookie
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const handleRefresh = async () => {
        setLoading(true);
        setStatus("SCANNING CORE DATABASE...");
        try {
            const res = await fetch('/api/auth/link-profile', { method: 'POST' });
            const data = await res.json();

            if (data.success && data.linked) {
                setStatus("PROFILE LOCATED. REDIRECTING...");
                setTimeout(() => {
                    window.location.href = '/profile';
                }, 1500);
            } else {
                setStatus(data.message === "No profile found to link" ? "NO LEGACY PROFILE FOUND FOR THIS EMAIL." : null);
                setLoading(false);
            }
        } catch (err) {
            console.error("Refresh failed", err);
            setStatus("SCAN FAILED. TRY AGAIN.");
            setLoading(false);
        }
    };

    return (
        <div className="tribute-container">
            <style jsx>{`
                .tribute-container {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at center, #1a1a1a 0%, #050505 100%);
                    color: #c5a059;
                    font-family: 'Cinzel', serif;
                    text-align: center;
                    padding: 20px;
                }
                .card {
                    background: rgba(10, 10, 10, 0.9);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    padding: 60px 40px;
                    max-width: 500px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(197, 160, 89, 0.05);
                    backdrop-filter: blur(20px);
                    border-radius: 4px;
                    position: relative;
                }
                h1 {
                    letter-spacing: 8px;
                    margin-bottom: 25px;
                    font-size: 2.22rem;
                    color: #fff;
                    text-shadow: 0 0 15px rgba(255,255,255,0.1);
                }
                p {
                    font-family: 'Rajdhani', sans-serif;
                    color: rgba(255,255,255,0.6);
                    font-size: 1rem;
                    line-height: 1.8;
                    margin-bottom: 45px;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }
                .tribute-btn {
                    background: #c5a059;
                    color: #000;
                    border: none;
                    padding: 18px 50px;
                    font-family: 'Cinzel', serif;
                    font-weight: 900;
                    letter-spacing: 4px;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    width: 100%;
                    margin-bottom: 20px;
                }
                .tribute-btn:hover {
                    background: #fff;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(255,255,255,0.2);
                }
                .secondary-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    margin-top: 20px;
                }
                .text-link {
                    background: none;
                    border: none;
                    color: rgba(197, 160, 89, 0.6);
                    font-family: 'Orbitron', sans-serif;
                    font-size: 0.7rem;
                    letter-spacing: 2px;
                    cursor: pointer;
                    text-decoration: none;
                    transition: color 0.3s;
                }
                .text-link:hover {
                    color: #fff;
                }
                .logout-btn {
                    margin-top: 30px;
                }
                .status-msg {
                    margin-top: 20px;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 0.8rem;
                    color: #fff;
                    letter-spacing: 2px;
                    height: 20px;
                }
            `}</style>

            <div className="card">
                <h1>ENTRANCE TRIBUTE</h1>
                <p>
                    The gates are locked.
                    Your current identity has no recorded history in the command console.
                    {userEmail && <div style={{ color: '#fff', fontSize: '0.9rem', margin: '15px 0', border: '1px dashed rgba(197, 160, 89, 0.3)', padding: '10px' }}>LOGGED IN AS: <br /><strong>{userEmail}</strong></div>}
                    Initialize your station with a one-time tribute to proceed.
                </p>

                <button
                    className="tribute-btn"
                    onClick={handleTribute}
                    disabled={loading}
                >
                    {loading ? "INITIALIZING..." : "SEND TRIBUTE"}
                </button>

                <div className="secondary-actions">
                    <button className="text-link" onClick={handleRefresh} disabled={loading}>
                        ALREADY PAID? RE-CHECK PROFILE
                    </button>
                    <button className="text-link logout-btn" onClick={handleLogout} disabled={loading}>
                        LOGOUT / SWITCH ACCOUNT
                    </button>
                </div>

                {status && <div className="status-msg">{status}</div>}
            </div>
        </div>
    );
}
