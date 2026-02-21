"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TributeSuccessPage() {
    const [countdown, setCountdown] = useState(5);
    const router = useRouter();

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push('/profile');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="success-container">
            <style jsx>{`
                .success-container {
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
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    padding: 80px 40px;
                    max-width: 600px;
                    box-shadow: 0 0 100px rgba(197, 160, 89, 0.1);
                    backdrop-filter: blur(20px);
                    border-radius: 4px;
                    animation: fadeIn 2s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .icon {
                    font-size: 4rem;
                    margin-bottom: 30px;
                    filter: drop-shadow(0 0 15px rgba(197, 160, 89, 0.5));
                }
                h1 {
                    letter-spacing: 10px;
                    margin-bottom: 30px;
                    font-size: 2.5rem;
                    color: #fff;
                    text-shadow: 0 0 20px rgba(197, 160, 89, 0.3);
                }
                p {
                    font-family: 'Rajdhani', sans-serif;
                    color: rgba(255,255,255,0.8);
                    font-size: 1.2rem;
                    line-height: 1.6;
                    margin-bottom: 40px;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                }
                .status-sub {
                    font-size: 0.9rem;
                    color: rgba(197, 160, 89, 0.6);
                    letter-spacing: 4px;
                }
                .countdown {
                    font-size: 2rem;
                    color: #fff;
                    margin-top: 20px;
                    font-family: 'Orbitron', sans-serif;
                }
            `}</style>

            <div className="card">
                <div className="icon">⚔️</div>
                <h1>TRIBUTE RECEIVED</h1>
                <p>
                    Your offering has been accepted.
                    <br />
                    The archives are being updated.
                </p>
                <div className="status-sub">INITIALIZING STATION ACCESS...</div>
                <div className="countdown">{countdown}</div>
            </div>
        </div>
    );
}
