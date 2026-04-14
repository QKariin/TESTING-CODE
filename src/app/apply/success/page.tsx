"use client";
import { useEffect } from 'react';

export default function ApplySuccessPage() {
    useEffect(() => {
        setTimeout(() => { window.location.href = '/profile'; }, 4000);
    }, []);

    return (
        <div style={{ minHeight: '100svh', background: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, fontFamily: 'Cinzel, serif', color: '#c5a059' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@300;400&family=Cormorant+Garamond:ital,wght@0,300;1,300&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: '2.5rem' }}>✦</div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 300, letterSpacing: '6px', textTransform: 'uppercase', margin: 0 }}>Application Received</h1>
            <div style={{ width: 40, height: 1, background: 'rgba(197,160,89,0.3)' }} />
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', fontSize: '1.05rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 320, lineHeight: 1.8, margin: 0 }}>
                Your application has been submitted.<br />I will review it personally.
            </p>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '0.8rem', color: 'rgba(197,160,89,0.3)', letterSpacing: 3, marginTop: 8 }}>Returning to your profile...</p>
        </div>
    );
}
