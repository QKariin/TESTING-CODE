import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const thumb = req.nextUrl.searchParams.get('thumb') || '';

    // Fetch the live thumbnail from Cloudflare Stream
    let thumbData: ArrayBuffer | null = null;
    let thumbBase64 = '';
    if (thumb) {
        try {
            const res = await fetch(thumb, { cache: 'no-store' });
            if (res.ok) {
                thumbData = await res.arrayBuffer();
                const bytes = new Uint8Array(thumbData);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                thumbBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
            }
        } catch {}
    }

    return new ImageResponse(
        (
            <div style={{
                display: 'flex',
                width: '1200px',
                height: '630px',
                backgroundColor: '#000',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Stream thumbnail as background */}
                {thumbBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={thumbBase64}
                        alt=""
                        width={1200}
                        height={630}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '1200px',
                            height: '630px',
                            objectFit: 'cover',
                        }}
                    />
                ) : (
                    /* Fallback gradient if thumbnail fails */
                    <div style={{
                        display: 'flex',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '1200px',
                        height: '630px',
                        background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 50%, #0a0a1a 100%)',
                    }} />
                )}

                {/* Dark overlay for readability */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '1200px',
                    height: '630px',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.85) 100%)',
                }} />

                {/* LIVE badge — top left */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: '32px',
                    left: '36px',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    {/* Pulsing red dot */}
                    <div style={{
                        display: 'flex',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#ed4245',
                        boxShadow: '0 0 12px 4px rgba(237,66,69,0.6)',
                    }} />
                    <span style={{
                        fontSize: '28px',
                        color: '#ed4245',
                        letterSpacing: '6px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}>LIVE</span>
                </div>

                {/* Bottom content */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    padding: '40px 44px',
                }}>
                    {/* Gold line */}
                    <div style={{
                        display: 'flex',
                        width: '80px',
                        height: '2px',
                        backgroundColor: '#c5a059',
                        marginBottom: '16px',
                    }} />

                    {/* Title */}
                    <span style={{
                        fontSize: '48px',
                        color: '#ffffff',
                        fontWeight: 700,
                        letterSpacing: '3px',
                        textShadow: '0 2px 20px rgba(0,0,0,0.8)',
                        lineHeight: 1.1,
                    }}>QUEEN KARIN</span>

                    {/* Subtitle */}
                    <span style={{
                        fontSize: '22px',
                        color: 'rgba(197,160,89,0.9)',
                        letterSpacing: '5px',
                        marginTop: '8px',
                        textTransform: 'uppercase',
                        textShadow: '0 1px 10px rgba(0,0,0,0.8)',
                    }}>IS STREAMING NOW</span>

                    {/* URL */}
                    <span style={{
                        fontSize: '16px',
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '2px',
                        marginTop: '16px',
                    }}>throne.qkarin.com</span>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        },
    );
}
