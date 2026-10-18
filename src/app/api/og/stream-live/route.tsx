import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const thumb = req.nextUrl.searchParams.get('thumb') || '';

    // Try to fetch the live thumbnail from Cloudflare Stream
    let thumbBase64 = '';
    if (thumb) {
        try {
            const res = await fetch(thumb, { cache: 'no-store' });
            if (res.ok && res.status === 200) {
                const thumbData = await res.arrayBuffer();
                // Only use if we actually got image data (not empty 204)
                if (thumbData.byteLength > 100) {
                    const bytes = new Uint8Array(thumbData);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    thumbBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
                }
            }
        } catch {}
    }

    const hasThumb = thumbBase64.length > 0;

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
                {hasThumb ? (
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
                    /* Dark cinematic background when no thumbnail available */
                    <div style={{
                        display: 'flex',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '1200px',
                        height: '630px',
                        background: 'linear-gradient(135deg, #1a0505 0%, #0a0a0a 40%, #050510 100%)',
                    }} />
                )}

                {/* Red glow top-left corner */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: '-80px',
                    left: '-80px',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(237,66,69,0.2) 0%, transparent 70%)',
                }} />

                {/* Gold glow bottom-right */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: '-120px',
                    right: '-60px',
                    width: '500px',
                    height: '500px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(197,160,89,0.1) 0%, transparent 70%)',
                }} />

                {/* Dark overlay for readability */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '1200px',
                    height: '630px',
                    background: hasThumb
                        ? 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 100%)'
                        : 'transparent',
                }} />

                {/* LIVE badge — top left */}
                <div style={{
                    display: 'flex',
                    position: 'absolute',
                    top: '36px',
                    left: '44px',
                    alignItems: 'center',
                    gap: '14px',
                    background: 'rgba(237,66,69,0.15)',
                    border: '1px solid rgba(237,66,69,0.4)',
                    borderRadius: '6px',
                    padding: '8px 20px 8px 16px',
                }}>
                    <div style={{
                        display: 'flex',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#ed4245',
                        boxShadow: '0 0 12px 4px rgba(237,66,69,0.6)',
                    }} />
                    <span style={{
                        fontSize: '24px',
                        color: '#fff',
                        letterSpacing: '6px',
                        fontWeight: 700,
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
                    padding: '44px 48px',
                }}>
                    {/* Gold accent line */}
                    <div style={{
                        display: 'flex',
                        width: '80px',
                        height: '2px',
                        backgroundColor: '#c5a059',
                        marginBottom: '20px',
                    }} />

                    {/* Title */}
                    <span style={{
                        fontSize: '52px',
                        color: '#ffffff',
                        fontWeight: 700,
                        letterSpacing: '4px',
                        textShadow: '0 2px 24px rgba(0,0,0,0.9)',
                        lineHeight: 1.1,
                    }}>QUEEN KARIN</span>

                    {/* Subtitle */}
                    <span style={{
                        fontSize: '24px',
                        color: '#c5a059',
                        letterSpacing: '6px',
                        marginTop: '10px',
                        textShadow: '0 1px 10px rgba(0,0,0,0.8)',
                    }}>IS STREAMING NOW</span>

                    {/* URL bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '20px',
                    }}>
                        <div style={{
                            display: 'flex',
                            width: '30px',
                            height: '1px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                        }} />
                        <span style={{
                            fontSize: '15px',
                            color: 'rgba(255,255,255,0.35)',
                            letterSpacing: '3px',
                        }}>throne.qkarin.com</span>
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        },
    );
}
