// Shared styles for mechanism UIs
export const R = 'rgba(160,16,32,'; // brand red prefix
export const G = 'rgba(197,160,89,'; // gold prefix

export const cardStyle: React.CSSProperties = {
    background: 'rgba(12,10,14,0.95)',
    border: `1px solid ${R}0.18)`,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 0,
};

export const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 18px',
    borderBottom: `1px solid ${R}0.1)`,
};

export const bodyStyle: React.CSSProperties = {
    padding: '20px 18px',
};

export const btnStyle: React.CSSProperties = {
    padding: '14px 28px',
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '0.8rem',
    letterSpacing: '3px',
    color: `${R}0.6)`,
    background: `${R}0.05)`,
    border: `1px solid ${R}0.2)`,
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
    WebkitTapHighlightColor: 'transparent',
};

export const btnDoneStyle: React.CSSProperties = {
    ...btnStyle,
    color: 'rgba(80,200,120,0.55)',
    background: 'rgba(80,200,120,0.04)',
    border: '1px solid rgba(80,200,120,0.15)',
    cursor: 'default',
};

export const labelStyle: React.CSSProperties = {
    fontFamily: 'Rajdhani, sans-serif',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '3px',
};

export const titleStyle: React.CSSProperties = {
    fontFamily: 'Cinzel, serif',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '1px',
};

export const resultBox: React.CSSProperties = {
    marginTop: 16,
    padding: '14px 18px',
    background: `${R}0.03)`,
    border: `1px solid ${R}0.1)`,
    borderRadius: 10,
    textAlign: 'center',
};

export const doneCard: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
    background: 'rgba(80,200,120,0.03)', border: '1px solid rgba(80,200,120,0.12)',
    borderRadius: 12,
};
