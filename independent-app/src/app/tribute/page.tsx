"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TributePage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleTribute = async () => {
        setLoading(true);
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
        } finally {
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
                    background: #050505;
                    color: #c5a059;
                    font-family: 'Cinzel', serif;
                    text-align: center;
                    padding: 20px;
                }
                .card {
                    background: rgba(15, 15, 15, 0.8);
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    padding: 60px 40px;
                    max-width: 500px;
                    box-shadow: 0 0 50px rgba(197, 160, 89, 0.1);
                    backdrop-filter: blur(10px);
                }
                h1 {
                    letter-spacing: 5px;
                    margin-bottom: 20px;
                    font-size: 2rem;
                }
                p {
                    font-family: 'Rajdhani', sans-serif;
                    color: #888;
                    font-size: 1.1rem;
                    line-height: 1.6;
                    margin-bottom: 40px;
                    letter-spacing: 1px;
                }
                .tribute-btn {
                    background: #c5a059;
                    color: #000;
                    border: none;
                    padding: 15px 40px;
                    font-family: 'Cinzel', serif;
                    font-weight: 700;
                    letter-spacing: 3px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .tribute-btn:hover {
                    background: #fff;
                    box-shadow: 0 0 20px rgba(255,255,255,0.4);
                }
                .tribute-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>

            <div className="card">
                <h1>ENTRANCE TRIBUTE</h1>
                <p>
                    Access to the Command Console is granted only to those who have proven their devotion.
                    A one-time tribute is required to initialize your profile and grant you the rank of Hall Boy.
                </p>
                <button
                    className="tribute-btn"
                    onClick={handleTribute}
                    disabled={loading}
                >
                    {loading ? "PREPARING..." : "SEND TRIBUTE"}
                </button>
            </div>
        </div>
    );
}
