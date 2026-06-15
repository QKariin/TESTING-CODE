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
    const isWin = sp.get('isWin') === '1';
    const isNoLoss = sp.get('noLoss') === '1';

    // Colors based on outcome
    const accentColor = isWin ? '#c5a059' : isNoLoss ? '#4ade80' : '#ff3355';
    const accentDim = isWin ? 'rgba(197,160,89,0.15)' : isNoLoss ? 'rgba(74,222,128,0.12)' : 'rgba(255,51,85,0.12)';
    const accentGlow = isWin ? 'rgba(197,160,89,0.25)' : isNoLoss ? 'rgba(74,222,128,0.2)' : 'rgba(255,51,85,0.2)';

    // Result text
    let resultLabel: string;
    let resultValue: string;
    if (isWin) {
        resultLabel = 'WON';
        resultValue = `+${Number(wonAmount).toLocaleString()}`;
    } else if (isNoLoss) {
        resultLabel = 'LOST';
        resultValue = 'NOTHING';
    } else {
        resultLabel = 'LOST';
        resultValue = `-${Number(lostAmount).toLocaleString()}`;
    }

    return new ImageResponse(
        (
            <div style={{
                display: 'flex',
                width: '800px',
                height: '418px',
                backgroundColor: '#08080f',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Background radial glow */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: '-80px',
                    left: '50%',
                    width: '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${accentDim} 0%, transparent 65%)`,
                    transform: 'translateX(-50%)',
                }} />

                {/* Subtle diagonal lines pattern */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    inset: '0',
                    opacity: 0.03,
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, white 20px, white 21px)',
                }} />

                {/* Top accent line */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: '0', left: '0', right: '0',
                    height: '3px',
                    background: `linear-gradient(90deg, transparent 5%, ${accentColor} 50%, transparent 95%)`,
                }} />

                {/* Main content layout */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    width: '100%',
                    height: '100%',
                    padding: '0',
                    position: 'relative',
                    zIndex: 1,
                }}>
                    {/* LEFT: Small card strip with icon + card name */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '160px',
                        background: `linear-gradient(180deg, ${accentDim} 0%, rgba(8,8,15,0.8) 100%)`,
                        borderRight: `1px solid ${accentGlow}`,
                        gap: '12px',
                        flexShrink: 0,
                    }}>
                        {/* Card icon - slot machine emoji */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '72px',
                            height: '72px',
                            borderRadius: '16px',
                            background: `linear-gradient(135deg, ${accentDim}, rgba(0,0,0,0.4))`,
                            border: `1px solid ${accentGlow}`,
                            fontSize: '36px',
                            boxShadow: `0 4px 20px ${accentDim}`,
                        }}>
                            {isWin ? '\u{1F451}' : '\u{1F3B0}'}
                        </div>
                        {/* Card name */}
                        <div style={{
                            display: 'flex',
                            fontSize: '11px',
                            color: accentColor,
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            fontWeight: 700,
                            maxWidth: '130px',
                        }}>{cardName || 'RISKY'}</div>
                    </div>

                    {/* RIGHT: Main info */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        padding: '40px 44px 36px',
                        justifyContent: 'space-between',
                    }}>
                        {/* Top: Title + name */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {/* RISKY TRIBUTE label */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '8px',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '11px',
                                    color: 'rgba(197,160,89,0.45)',
                                    letterSpacing: '4px',
                                    textTransform: 'uppercase',
                                }}>RISKY TRIBUTE</div>
                                <div style={{
                                    display: 'flex',
                                    width: '80px',
                                    height: '1px',
                                    background: 'linear-gradient(90deg, rgba(197,160,89,0.3), transparent)',
                                }} />
                            </div>

                            {/* Name */}
                            <div style={{
                                display: 'flex',
                                fontSize: '34px',
                                color: '#ffffff',
                                letterSpacing: '2px',
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}>{senderName}</div>

                            {/* Hierarchy */}
                            {hierarchy && (
                                <div style={{
                                    display: 'flex',
                                    fontSize: '11px',
                                    color: 'rgba(255,255,255,0.25)',
                                    letterSpacing: '3px',
                                    textTransform: 'uppercase',
                                    marginTop: '4px',
                                }}>{hierarchy}</div>
                            )}
                        </div>

                        {/* Middle: Stake + Result */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '24px',
                            alignItems: 'flex-end',
                        }}>
                            {/* Staked */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '10px',
                                    color: 'rgba(255,255,255,0.25)',
                                    letterSpacing: '3px',
                                    textTransform: 'uppercase',
                                }}>GAMBLED</div>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '28px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontWeight: 700,
                                    letterSpacing: '1px',
                                }}>{Number(stakeAmount).toLocaleString()}</div>
                            </div>

                            {/* Separator */}
                            <div style={{
                                display: 'flex',
                                width: '1px',
                                height: '40px',
                                background: 'rgba(255,255,255,0.08)',
                                marginBottom: '4px',
                            }} />

                            {/* Result */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '10px',
                                    color: 'rgba(255,255,255,0.25)',
                                    letterSpacing: '3px',
                                    textTransform: 'uppercase',
                                }}>{resultLabel}</div>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '28px',
                                    color: accentColor,
                                    fontWeight: 700,
                                    letterSpacing: '1px',
                                }}>{resultValue}</div>
                            </div>
                        </div>

                        {/* Bottom: CTA */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '8px',
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 20px',
                                borderRadius: '8px',
                                background: 'rgba(197,160,89,0.06)',
                                border: '1px solid rgba(197,160,89,0.2)',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    fontSize: '12px',
                                    color: '#c5a059',
                                    letterSpacing: '3px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                }}>TRY YOUR LUCK</div>
                            </div>
                            <div style={{
                                display: 'flex',
                                fontSize: '11px',
                                color: 'rgba(255,255,255,0.15)',
                                letterSpacing: '2px',
                            }}>throne.qkarin.com</div>
                        </div>
                    </div>
                </div>

                {/* Bottom accent line */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: '0', left: '0', right: '0',
                    height: '3px',
                    background: `linear-gradient(90deg, transparent 5%, ${accentColor} 50%, transparent 95%)`,
                }} />
            </div>
        ),
        {
            width: 800,
            height: 418,
        },
    );
}
