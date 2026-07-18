'use client';

export default function VaultError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div style={{ height: '100dvh', width: '100vw', background: '#050508', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', color: 'rgba(139,0,0,0.7)', letterSpacing: 6 }}>CONNECTION LOST</div>
            <button
                onClick={reset}
                style={{ padding: '12px 32px', background: 'none', border: '1px solid rgba(139,0,0,0.3)', borderRadius: 4, color: 'rgba(139,0,0,0.7)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', letterSpacing: 4, cursor: 'pointer', textTransform: 'uppercase' }}
            >
                RECONNECT
            </button>
        </div>
    );
}
