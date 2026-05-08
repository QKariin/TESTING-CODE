import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const senderName = sp.get('name') || 'SUBJECT';
    const hierarchy = sp.get('hierarchy') || '';
    const stakeAmount = sp.get('stake') || '0';
    const lostAmount = sp.get('lost') || '0';
    const wonAmount = sp.get('won') || '0';
    const cardName = sp.get('cardName') || '';
    const cardIcon = sp.get('cardIcon') || '';
    const isWin = sp.get('isWin') === '1';
    const isNoLoss = sp.get('noLoss') === '1';

    // Fetch card icon SVG as data URI
    let iconDataUri = '';
    if (cardIcon) {
        try {
            const base = req.nextUrl.origin;
            const iconUrl = cardIcon.startsWith('http') ? cardIcon : `${base}${cardIcon}`;
            const res = await fetch(iconUrl);
            if (res.ok) {
                const svgText = await res.text();
                iconDataUri = `data:image/svg+xml;base64,${btoa(svgText)}`;
            }
        } catch (_) {}
    }

    // Fetch Cinzel font
    let cinzelFont: ArrayBuffer | null = null;
    let cinzelBoldFont: ArrayBuffer | null = null;
    try {
        const [reg, bold] = await Promise.all([
            fetch('https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnfY3lCQ.woff').then(r => r.arrayBuffer()),
            fetch('https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-j3gfY3lCQ.woff').then(r => r.arrayBuffer()),
        ]);
        cinzelFont = reg;
        cinzelBoldFont = bold;
    } catch (_) {}

    // Result line
    let resultText: string;
    let resultColor: string;
    if (isWin) {
        resultText = `total won: ${Number(wonAmount).toLocaleString()}`;
        resultColor = '#4ade80';
    } else if (isNoLoss) {
        resultText = 'lost nothing';
        resultColor = '#c5a059';
    } else {
        resultText = `total lost: ${Number(lostAmount).toLocaleString()}`;
        resultColor = '#ff0000';
    }

    return new ImageResponse(
        (
            <div style={{
                display: 'flex',
                width: '800px',
                height: '418px',
                backgroundColor: '#0d0d1f',
                fontFamily: 'Cinzel, serif',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Background gradient overlay */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 100%)',
                }} />

                {/* Top gold accent */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #c5a059, transparent)',
                }} />

                {/* Bottom gold accent */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #c5a059, transparent)',
                }} />

                {/* Border */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    inset: 0,
                    border: '1px solid rgba(197,160,89,0.4)',
                    borderRadius: '12px',
                }} />

                {/* LEFT PANEL — Card icon + card name */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '224px',
                    background: 'rgba(197,160,89,0.04)',
                    borderRight: '1px solid rgba(197,160,89,0.12)',
                    padding: '40px 24px',
                    gap: '16px',
                    position: 'relative',
                    zIndex: 1,
                }}>
                    {iconDataUri ? (
                        <img src={iconDataUri} width={120} height={120} alt="" style={{ opacity: 0.9 }} />
                    ) : (
                        <div style={{
                            display: 'flex',
                            fontSize: '72px',
                            opacity: 0.7,
                        }}>🎰</div>
                    )}
                    {cardName && (
                        <div style={{
                            display: 'flex',
                            fontSize: '11px',
                            color: 'rgba(197,160,89,0.5)',
                            letterSpacing: '3px',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            lineHeight: 1.4,
                            fontWeight: 400,
                        }}>{cardName}</div>
                    )}
                </div>

                {/* RIGHT PANEL — Info */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    padding: '36px 40px 32px',
                    justifyContent: 'center',
                    gap: '4px',
                    position: 'relative',
                    zIndex: 1,
                }}>
                    {/* RISKY TRIBUTE header */}
                    <div style={{
                        display: 'flex',
                        fontSize: '12px',
                        color: 'rgba(197,160,89,0.5)',
                        letterSpacing: '4px',
                        textTransform: 'uppercase',
                        marginBottom: '14px',
                        fontWeight: 400,
                    }}>RISKY TRIBUTE</div>

                    {/* Name */}
                    <div style={{
                        display: 'flex',
                        fontSize: '36px',
                        color: '#c5a059',
                        letterSpacing: '2px',
                        fontWeight: 700,
                        lineHeight: 1.1,
                    }}>{senderName}</div>

                    {/* Hierarchy */}
                    {hierarchy && (
                        <div style={{
                            display: 'flex',
                            fontSize: '11px',
                            color: 'rgba(197,160,89,0.4)',
                            letterSpacing: '3px',
                            textTransform: 'uppercase',
                            marginTop: '2px',
                            fontWeight: 400,
                        }}>{hierarchy}</div>
                    )}

                    {/* Gambled line */}
                    <div style={{
                        display: 'flex',
                        fontSize: '22px',
                        color: 'rgba(255,255,255,0.55)',
                        fontWeight: 400,
                        marginTop: '20px',
                        letterSpacing: '1px',
                    }}>just gambled {Number(stakeAmount).toLocaleString()} coins</div>

                    {/* Result line */}
                    <div style={{
                        display: 'flex',
                        fontSize: '24px',
                        color: resultColor,
                        fontWeight: 700,
                        marginTop: '4px',
                        letterSpacing: '1px',
                    }}>{resultText}</div>
                </div>

                {/* Bottom bar */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: '2px', left: 0, right: 0,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 40px',
                }}>
                    <span style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.2)',
                        letterSpacing: '3px',
                    }}>THRONE</span>
                    <span style={{
                        fontSize: '11px',
                        color: 'rgba(197,160,89,0.35)',
                        letterSpacing: '1px',
                    }}>throne.qkarin.com</span>
                </div>
            </div>
        ),
        {
            width: 800,
            height: 418,
            fonts: [
                ...(cinzelFont ? [{ name: 'Cinzel', data: cinzelFont, weight: 400 as const, style: 'normal' as const }] : []),
                ...(cinzelBoldFont ? [{ name: 'Cinzel', data: cinzelBoldFont, weight: 700 as const, style: 'normal' as const }] : []),
            ],
        },
    );
}
