import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const COLORS: Record<string, { bg: string; accent: string; glow: string }> = {
    tribute:   { bg: '#0a0a0a', accent: '#c5a059', glow: 'rgba(197,160,89,0.15)' },
    risky_win: { bg: '#0a0a0a', accent: '#00cc66', glow: 'rgba(0,204,102,0.15)' },
    risky_loss:{ bg: '#0a0a0a', accent: '#cc0000', glow: 'rgba(204,0,0,0.15)' },
    arrival:   { bg: '#0a0a0a', accent: '#8b5cf6', glow: 'rgba(139,92,246,0.15)' },
    promotion: { bg: '#0a0a0a', accent: '#c5a059', glow: 'rgba(197,160,89,0.15)' },
    challenge: { bg: '#0a0a0a', accent: '#f5e6c8', glow: 'rgba(245,230,200,0.15)' },
    routine:   { bg: '#0a0a0a', accent: '#8b5cf6', glow: 'rgba(139,92,246,0.15)' },
    task_ok:   { bg: '#0a0a0a', accent: '#00cc66', glow: 'rgba(0,204,102,0.15)' },
    task_fail: { bg: '#0a0a0a', accent: '#cc0000', glow: 'rgba(204,0,0,0.15)' },
    wishlist:  { bg: '#0a0a0a', accent: '#c5a059', glow: 'rgba(197,160,89,0.15)' },
};

const ICONS: Record<string, string> = {
    tribute:   '\u{1F4B0}',
    risky_win: '\u{1F3B0}',
    risky_loss:'\u{1F3B0}',
    arrival:   '\u{1F6AA}',
    promotion: '\u{1F451}',
    challenge: '\u{2694}',
    routine:   '\u{1F9CE}',
    task_ok:   '\u{2705}',
    task_fail: '\u{274C}',
    wishlist:  '\u{1F381}',
};

export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const type = sp.get('type') || 'tribute';
    const title = sp.get('title') || '';
    const line1 = sp.get('line1') || '';
    const line2 = sp.get('line2') || '';
    const cta = sp.get('cta') || 'throne.qkarin.com';

    const c = COLORS[type] || COLORS.tribute;
    const icon = ICONS[type] || '';

    return new ImageResponse(
        (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: '800px',
                height: '418px',
                backgroundColor: c.bg,
                fontFamily: 'serif',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Glow circle */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: '-100px',
                    right: '-100px',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
                }} />

                {/* Top border line */}
                <div style={{
                    display: 'flex',
                    width: '100%',
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)`,
                }} />

                {/* Content */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    padding: '40px 50px',
                    justifyContent: 'center',
                }}>
                    {/* Title row */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        marginBottom: '8px',
                    }}>
                        <span style={{ fontSize: '36px' }}>{icon}</span>
                        <span style={{
                            fontSize: '28px',
                            color: c.accent,
                            letterSpacing: '4px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                        }}>{title}</span>
                    </div>

                    {/* Thin separator */}
                    <div style={{
                        display: 'flex',
                        width: '120px',
                        height: '1px',
                        backgroundColor: c.accent,
                        opacity: 0.4,
                        marginBottom: '24px',
                        marginTop: '8px',
                    }} />

                    {/* Line 1 - main text */}
                    <span style={{
                        fontSize: '32px',
                        color: '#ffffff',
                        lineHeight: 1.4,
                        fontWeight: 400,
                    }}>{line1}</span>

                    {/* Line 2 - detail */}
                    {line2 && (
                        <span style={{
                            fontSize: '22px',
                            color: 'rgba(255,255,255,0.5)',
                            marginTop: '12px',
                            lineHeight: 1.4,
                        }}>{line2}</span>
                    )}
                </div>

                {/* Bottom bar */}
                <div style={{
                    display: 'flex',
                    width: '100%',
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)`,
                }} />
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 50px',
                }}>
                    <span style={{
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.3)',
                        letterSpacing: '2px',
                    }}>THRONE</span>
                    <span style={{
                        fontSize: '14px',
                        color: c.accent,
                        opacity: 0.6,
                        letterSpacing: '1px',
                    }}>{cta}</span>
                </div>
            </div>
        ),
        {
            width: 800,
            height: 418,
        },
    );
}
