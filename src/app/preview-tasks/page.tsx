'use client';
import { useState, useRef } from 'react';

const R = 'rgba(139,0,0,';
const G = 'rgba(197,160,89,';
const BG_IMG = 'linear-gradient(rgba(4,3,10,0.78) 0%, rgba(4,3,10,0.85) 100%), url(/work-bg.jpg) center top / cover no-repeat';

/* ─── shared card styles ─── */
const cardOuter: React.CSSProperties = { margin: '20px 16px 120px', animation: 'none' };
const goldBar: React.CSSProperties = { height: 2, background: 'linear-gradient(90deg, rgba(197,160,89,0.85) 0%, rgba(197,160,89,0.05) 100%)', borderRadius: '2px 2px 0 0' };
const cardShell: React.CSSProperties = { border: '1px solid rgba(197,160,89,0.35)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' };
const cardHead: React.CSSProperties = { padding: '18px 20px 16px', background: 'rgba(197,160,89,0.05)', borderBottom: '1px solid rgba(197,160,89,0.1)', display: 'flex', alignItems: 'center', gap: 14 };
const cardBody: React.CSSProperties = { padding: '22px 20px 28px', background: 'rgba(15,12,25,0.6)' };
const descBox: React.CSSProperties = { fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: 22, padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' };
const goldBtn: React.CSSProperties = { width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { width: '100%', padding: '12px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.22)', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer' };
const uploadBtn: React.CSSProperties = { width: '100%', padding: '18px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '3px', color: '#c5a059', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid #c5a059', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 0 15px rgba(197,160,89,0.2)', cursor: 'pointer' };

const UploadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;

/* ─── Wrapper: renders the full vault screen frame ─── */
function VaultFrame({ icon, taskName, children, followUpOverlay }: { icon: string; taskName: string; children?: React.ReactNode; followUpOverlay?: React.ReactNode }) {
    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: 390, margin: '0 auto', background: BG_IMG, minHeight: 600, borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(197,160,89,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(197,160,89,0.03)' }}>
                <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: `${G}0.55)`, letterSpacing: '6px', marginBottom: 3 }}>TODAY'S</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', letterSpacing: '3px' }}>ORDERS</div>
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>✕</div>
            </div>

            {/* Day hero + task circles */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: `${G}0.55)`, letterSpacing: '6px', marginBottom: 2 }}>DAY</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '4rem', color: 'rgba(255,255,255,0.95)', fontWeight: 700, lineHeight: 0.85, letterSpacing: '-2px' }}>7</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        {[{ done: true }, { done: true }, { active: true }, { done: false }, { done: false }].map((t, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 44px' }}>
                                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.38rem', color: t.done ? 'rgba(80,200,120,0.5)' : (t as any).active ? `${G}0.6)` : 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>0{i + 1}</div>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${t.done ? 'rgba(80,200,120,0.4)' : (t as any).active ? `${G}0.6)` : 'rgba(255,255,255,0.1)'}`, background: t.done ? 'rgba(80,200,120,0.09)' : (t as any).active ? `${G}0.12)` : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (t as any).active ? `0 0 12px ${G}0.3)` : 'none' }}>
                                    {t.done && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(80,200,120,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                                    {(t as any).active && <svg viewBox="0 0 24 24" width="9" height="9" fill={`${G}0.95)`}><circle cx="12" cy="12" r="6" /></svg>}
                                    {!t.done && !(t as any).active && <svg viewBox="0 0 24 24" width="7" height="7" fill="rgba(255,255,255,0.15)"><circle cx="12" cy="12" r="5" /></svg>}
                                </div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.52rem', color: t.done ? 'rgba(255,255,255,0.2)' : (t as any).active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.2 }}>
                                    {['Done', 'Done', taskName.split(' ')[0], 'Next', 'Next'][i]}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <div style={{ height: 1, width: 20, background: `${G}0.35)` }} />
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', letterSpacing: '4px', color: 'rgba(255,255,255,0.25)' }}>2 OF 5 COMPLETE</div>
                </div>
            </div>

            {/* Scrollable task area */}
            <div style={{ overflowY: 'auto', maxHeight: 580 }}>
                {children && (
                    <div style={cardOuter}>
                        <div style={goldBar} />
                        <div style={cardShell}>
                            <div style={cardHead}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(197,160,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.07)', flexShrink: 0 }}>
                                    <span style={{ fontSize: '1rem', color: 'rgba(197,160,89,0.85)' }}>{icon}</span>
                                </div>
                                <div>
                                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: `${G}0.5)`, letterSpacing: '5px', marginBottom: 4 }}>NOW</div>
                                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.92)', letterSpacing: '1px' }}>{taskName}</div>
                                </div>
                            </div>
                            <div style={cardBody}>{children}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* FollowUp overlay — absolute over the vault frame */}
            {followUpOverlay && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: BG_IMG, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                    {followUpOverlay}
                </div>
            )}
        </div>
    );
}

/* ─── FollowUp overlays ─── */
function FollowUpWriting({ source, text }: { source: string; text: string }) {
    const [val, setVal] = useState('');
    const wc = val.split(/\s+/).filter(Boolean).length;
    const ok = wc >= 50;
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px 40px', gap: 0 }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, textAlign: 'center', marginBottom: 32 }}>{source.toUpperCase()}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.75, marginBottom: 28, maxWidth: 320 }}>{text}</div>
            <div style={{ width: '100%', maxWidth: 340 }}>
                <textarea value={val} onChange={e => setVal(e.target.value)} placeholder="Write here..." style={{ width: '100%', minHeight: 140, background: 'rgba(255,255,255,0.03)', border: `1px solid ${G}0.12)`, borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: ok ? `${G}0.6)` : 'rgba(255,255,255,0.35)' }}>{wc} / 50 words</span>
                    <button disabled={!ok} style={{ ...goldBtn, width: 'auto', padding: '12px 28px', opacity: ok ? 1 : 0.3 }}>SUBMIT</button>
                </div>
                <div style={{ marginTop: 20 }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
            </div>
        </div>
    );
}

function FollowUpPhoto({ source, text }: { source: string; text: string }) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px 40px' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, textAlign: 'center', marginBottom: 32 }}>{source.toUpperCase()}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.75, marginBottom: 36, maxWidth: 320 }}>{text}</div>
            <div style={{ width: '75%' }}>
                <div style={uploadBtn}><UploadIcon /> UPLOAD PHOTO</div>
                <div style={{ marginTop: 24 }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
            </div>
        </div>
    );
}

function FollowUpEndurance({ source, text, secs = 60 }: { source: string; text: string; secs?: number }) {
    const [left, setLeft] = useState(secs);
    const [running, setRunning] = useState(false);
    const ref = useRef<any>(null);
    const start = () => { setRunning(true); ref.current = setInterval(() => setLeft(s => { if (s <= 1) { clearInterval(ref.current); setRunning(false); return 0; } return s - 1; }), 1000); };
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 20px 40px' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, textAlign: 'center', marginBottom: 24 }}>{source.toUpperCase()}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 1.75, marginBottom: 28, maxWidth: 320 }}>{text}</div>
            <div style={{ width: '100%', maxWidth: 340 }}>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ height: '100%', width: `${(left / secs) * 100}%`, background: left <= secs * 0.2 ? `${R}0.7)` : `${G}0.55)`, borderRadius: 2, transition: 'width 0.9s linear' }} />
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.85)`, letterSpacing: 4, textAlign: 'center', marginBottom: 20 }}>
                    {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
                </div>
                {left > 0 && !running && <button onClick={start} style={goldBtn}>START TIMER</button>}
                {running && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 4, textAlign: 'center' }}>HOLD POSITION...</div>}
                {left === 0 && <div style={{ marginTop: 16, ...uploadBtn }}><UploadIcon /> UPLOAD PROOF</div>}
                <div style={{ marginTop: 20 }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
            </div>
        </div>
    );
}

function FollowUpAcknowledge({ source, text }: { source: string; text: string }) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 4, textAlign: 'center', marginBottom: 32 }}>{source.toUpperCase()}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.75, marginBottom: 36, maxWidth: 320 }}>{text}</div>
            <button style={{ ...goldBtn, width: 'auto', padding: '16px 48px' }}>ACKNOWLEDGE</button>
        </div>
    );
}

/* ─── MECHANISM SCENES ─── */

type Scene = { id: string; label: string; node: React.ReactNode; followUp?: React.ReactNode };

function SpinWheelScenes(): Scene[] {
    const WHEEL = ['Cold shower 60s', 'Write 50 lines: "I obey"', 'Edge & deny', 'Body writing photo', 'Confession essay', '2 min wall sit'];
    return [
        {
            id: 'idle', label: 'Idle',
            node: (
                <div>
                    <div style={descBox}>Spin the wheel of fate. Whatever it lands on, you obey.</div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 20px' }}>
                            <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid rgba(197,160,89,0.7)', zIndex: 2 }} />
                            <div style={{ width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.15)', position: 'relative', overflow: 'hidden' }}>
                                {WHEEL.map((_, wi) => { const seg = 360 / WHEEL.length; return <div key={wi} style={{ position: 'absolute', width: '50%', height: '50%', top: 0, right: 0, transformOrigin: '0% 100%', transform: `rotate(${wi * seg - 90}deg) skewY(-${90 - seg}deg)`, background: wi % 2 === 0 ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />; })}
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: '50%', background: '#0a0a0e', border: '1px solid rgba(197,160,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><span style={{ color: `${G}0.7)`, fontSize: '0.8rem' }}>♛</span></div>
                            </div>
                        </div>
                        <button style={{ ...goldBtn, width: 'auto', padding: '14px 44px' }}>SPIN</button>
                    </div>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        ...WHEEL.map((outcome, i) => ({
            id: `result_${i}`, label: outcome.split(' ').slice(0, 2).join(' '),
            node: (
                <div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${G}0.6)`, letterSpacing: 3, marginBottom: 8 }}>YOU LANDED ON</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: `${G}0.8)`, padding: '14px 18px', background: `${G}0.06)`, border: `1px solid ${G}0.15)`, borderRadius: 8, marginBottom: 14 }}>{outcome}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px' }}>YOUR FATE IS SEALED</div>
                    </div>
                </div>
            ),
            followUp: i === 0 ? <FollowUpEndurance source="Spin Wheel" text="Cold shower 60s — camera on, do not stop" secs={60} /> :
                       i === 1 ? <FollowUpWriting source="Spin Wheel" text='Write 50 lines: "I will obey without question"' /> :
                       i === 2 ? <FollowUpPhoto source="Spin Wheel" text="Edge & deny — upload proof after" /> :
                       i === 3 ? <FollowUpPhoto source="Spin Wheel" text="Write OWNED on your body. Clear photograph." /> :
                       i === 4 ? <FollowUpWriting source="Spin Wheel" text="Confess your deepest weakness in at least 100 words." /> :
                                 <FollowUpEndurance source="Spin Wheel" text="Wall sit for 2 full minutes. Camera on." secs={120} />,
        })),
    ];
}

function CoinflipScenes(): Scene[] {
    return [
        {
            id: 'idle', label: 'Idle',
            node: (
                <div>
                    <div style={descBox}>Heads: +20 coins — Queen shows mercy / Tails: Write 30 lines: "I will obey without question"</div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${G}0.3)`, margin: '10px auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${G}0.05)`, fontSize: '2rem' }}>$</div>
                        <button style={{ ...goldBtn, width: 'auto', padding: '14px 44px' }}>FLIP</button>
                    </div>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        {
            id: 'heads', label: 'HEADS ✓',
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid rgba(80,200,120,0.5)', margin: '10px auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(80,200,120,0.08)', fontSize: '2rem' }}>♛</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.2rem', color: 'rgba(80,200,120,0.85)', letterSpacing: 6, marginBottom: 16 }}>HEADS</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', padding: '12px 16px', background: 'rgba(80,200,120,0.06)', border: '1px solid rgba(80,200,120,0.2)', borderRadius: 8 }}>+20 coins — Queen shows mercy</div>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        {
            id: 'tails', label: 'TAILS ✗',
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${R}0.5)`, margin: '10px auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${R}0.06)`, fontSize: '2rem' }}>✕</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.2rem', color: `${R}0.85)`, letterSpacing: 6, marginBottom: 16 }}>TAILS</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', padding: '12px 16px', background: `${R}0.06)`, border: `1px solid ${R}0.2)`, borderRadius: 8, marginBottom: 4 }}>Write 30 lines: "I will obey without question"</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px', marginTop: 10 }}>YOUR FATE IS SEALED</div>
                </div>
            ),
            followUp: <FollowUpWriting source="Coinflip" text='Write 30 lines: "I will obey without question"' />,
        },
    ];
}

function CardPickScenes(): Scene[] {
    const CARDS = ['Write a worship message', 'Gratitude list — 5 items', 'Devotion photo', 'Tribute 5 coins', '1 min plank on camera'];
    return [
        {
            id: 'choosing', label: 'Choosing',
            node: (
                <div>
                    <div style={descBox}>Draw a card from Queen's deck. Each card holds a task or consequence. Accept it.</div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {CARDS.map((_, i) => (
                            <div key={i} style={{ width: 72, height: 100, borderRadius: 8, border: `1px solid ${R}0.35)`, background: `${R}0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem' }}>♠</div>
                        ))}
                    </div>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        ...CARDS.map((card, i) => ({
            id: `card_${i}`, label: card.split(' ').slice(0, 2).join(' '),
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${G}0.6)`, letterSpacing: 3, marginBottom: 10 }}>YOUR CARD</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: `${G}0.8)`, padding: '18px', background: `${G}0.06)`, border: `1px solid ${G}0.2)`, borderRadius: 10, marginBottom: 14 }}>{card}</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4 }}>YOUR FATE IS SEALED</div>
                </div>
            ),
            followUp: i === 0 ? <FollowUpWriting source="Card Pick" text="Write a worship message to your Queen. At least 100 words." /> :
                       i === 1 ? <FollowUpWriting source="Card Pick" text="List 5 things you are grateful for about your Queen." /> :
                       i === 2 ? <FollowUpPhoto source="Card Pick" text="Photo showing your devotion pose." /> :
                       i === 3 ? <FollowUpAcknowledge source="Card Pick" text="Tribute 5 coins to your Queen." /> :
                                 <FollowUpEndurance source="Card Pick" text="Plank for 1 full minute. Proper form. Camera on." secs={60} />,
        })),
    ];
}

function DiceRollScenes(): Scene[] {
    const FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const OUTCOMES = ['Write lines x40', 'Cold shower 30s', '20 pushups on camera', 'Body writing: OBEY', 'Gratitude essay (100 words)', '2 min wall sit on camera'];
    return [
        {
            id: 'idle', label: 'Idle',
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={descBox}>Roll the dice. The number determines your punishment intensity.</div>
                    <div style={{ fontSize: '5rem', margin: '10px 0 24px' }}>⚄</div>
                    <button style={{ ...goldBtn, width: 'auto', padding: '14px 44px' }}>ROLL</button>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        ...OUTCOMES.map((outcome, i) => ({
            id: `roll_${i + 1}`, label: `Roll ${i + 1} — ${FACES[i]}`,
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '5rem', margin: '0 0 16px' }}>{FACES[i]}</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: `${G}0.8)`, padding: '14px 18px', background: `${G}0.06)`, border: `1px solid ${G}0.2)`, borderRadius: 8, marginBottom: 14 }}>{outcome}</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4 }}>YOU ROLLED {i + 1}</div>
                </div>
            ),
            followUp: i === 0 ? <FollowUpWriting source="Dice Roll" text='Write 40 lines: "I exist to serve"' /> :
                       i === 1 ? <FollowUpEndurance source="Dice Roll" text="Cold shower 30s — camera on, do not stop" secs={30} /> :
                       i === 2 ? <FollowUpPhoto source="Dice Roll" text="20 pushups on camera — upload video proof" /> :
                       i === 3 ? <FollowUpPhoto source="Dice Roll" text="Write OBEY on your wrist and photograph it" /> :
                       i === 4 ? <FollowUpWriting source="Dice Roll" text="Why are you grateful for discipline? 100 words minimum." /> :
                                 <FollowUpEndurance source="Dice Roll" text="2 min wall sit — camera on" secs={120} />,
        })),
    ];
}

function RouletteScenes(): Scene[] {
    return [
        {
            id: 'idle', label: 'Idle',
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={descBox}>One chamber holds a penalty. Pull the trigger and hope for the best.</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${G}0.25)`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                        ))}
                    </div>
                    <button style={{ ...goldBtn, background: `${R}0.5)`, color: '#fff' }}>PULL THE TRIGGER</button>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        {
            id: 'safe', label: 'Safe (5/6)',
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${G}0.25)`, background: 'transparent' }} />
                        ))}
                    </div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(80,200,120,0.8)', letterSpacing: 3, marginBottom: 8 }}>YOU SURVIVED</div>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2 }}>The chamber was empty. This time.</div>
                </div>
            ),
        },
        {
            id: 'hit', label: 'Hit (1/6)',
            node: (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${i === 2 ? `${R}0.8)` : `${G}0.2)`}`, background: i === 2 ? `${R}0.15)` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {i === 2 && <div style={{ width: 10, height: 10, borderRadius: '50%', background: `${R}0.7)` }} />}
                            </div>
                        ))}
                    </div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: `${R}0.9)`, letterSpacing: 4, padding: '20px', background: `${R}0.06)`, border: `1px solid ${R}0.25)`, borderRadius: 10 }}>
                        PUNISHED — Cold shower 2 min + 50 lines
                    </div>
                </div>
            ),
            followUp: <FollowUpEndurance source="Russian Roulette" text="Cold shower for 2 minutes. No flinching. Camera on." secs={120} />,
        },
    ];
}

function QuizScenes(): Scene[] {
    const Q = { question: "What is the first thing you must do each morning?", answers: ['Check phone', 'Complete your kneeling', 'Send a message', 'Wait for instructions'], correctIdx: 1 };
    return [
        {
            id: 'question', label: 'Question',
            node: (
                <div>
                    <div style={descBox}>{Q.question}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {Q.answers.map((a, i) => (
                            <button key={i} style={{ padding: '14px 18px', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>{a}</button>
                        ))}
                    </div>
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div>
                </div>
            ),
        },
        {
            id: 'correct', label: 'Correct ✓',
            node: (
                <div>
                    <div style={descBox}>{Q.question}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {Q.answers.map((a, i) => <button key={i} style={{ padding: '14px 18px', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: i === Q.correctIdx ? 'rgba(80,200,120,0.9)' : 'rgba(255,255,255,0.2)', background: i === Q.correctIdx ? 'rgba(80,200,120,0.1)' : 'transparent', border: `1px solid ${i === Q.correctIdx ? 'rgba(80,200,120,0.4)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 8, cursor: 'default', textAlign: 'left' }}>{a}</button>)}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', color: 'rgba(80,200,120,0.85)', letterSpacing: 6, marginBottom: 6 }}>1/1</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>Perfect score. − 1 day removed</div>
                    </div>
                </div>
            ),
        },
        {
            id: 'wrong', label: 'Wrong ✗',
            node: (
                <div>
                    <div style={descBox}>{Q.question}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {Q.answers.map((a, i) => <button key={i} style={{ padding: '14px 18px', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: i === 0 ? `${R}0.7)` : i === Q.correctIdx ? 'rgba(80,200,120,0.9)' : 'rgba(255,255,255,0.2)', background: i === 0 ? `${R}0.06)` : i === Q.correctIdx ? 'rgba(80,200,120,0.08)' : 'transparent', border: `1px solid ${i === 0 ? `${R}0.3)` : i === Q.correctIdx ? 'rgba(80,200,120,0.3)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 8, cursor: 'default', textAlign: 'left' }}>{a}</button>)}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', color: `${R}0.8)`, letterSpacing: 6, marginBottom: 6 }}>0/1</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>Every answer wrong. + 3 days added</div>
                    </div>
                </div>
            ),
        },
    ];
}

function WritingScenes(): Scene[] {
    return [
        { id: 'empty', label: 'Empty', node: (<div><div style={descBox}>Write about why you chose to submit. What brought you here? What do you hope to become? Be honest and vulnerable. (100 words min)</div><textarea placeholder="Write here..." style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} /><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}><span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>0 words</span><button disabled style={{ ...goldBtn, width: 'auto', padding: '12px 28px', opacity: 0.3 }}>SUBMIT</button></div><div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'filled', label: 'Filled', node: (<div><div style={descBox}>Write about why you chose to submit. (100 words min)</div><textarea defaultValue="I chose to submit because I wanted structure in my life. The discipline feels like freedom, not constraint. Every task makes me more focused, more present. I am learning what it means to truly obey without hesitation. This is not weakness — it is the hardest kind of strength..." style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} /><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}><span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: `${G}0.6)` }}>47 words</span><button style={{ ...goldBtn, width: 'auto', padding: '12px 28px' }}>SUBMIT</button></div><div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'submitted', label: 'Submitted', node: (<div style={{ textAlign: 'center', padding: '16px 0' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: `${G}0.6)`, letterSpacing: '3px', animation: 'none' }}>⏳ AWAITING REVIEW</div></div>) },
    ];
}

function PhotoProofScenes(): Scene[] {
    return [
        { id: 'upload', label: 'Upload', node: (<div><div style={descBox}>Take a photo on your knees, head bowed. Your first act of visible submission.</div><div style={uploadBtn}><UploadIcon /> UPLOAD PROOF</div><div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'uploading', label: 'Uploading...', node: (<div><div style={descBox}>Take a photo on your knees, head bowed.</div><div style={{ ...uploadBtn, color: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none' }}>UPLOADING...</div></div>) },
        { id: 'submitted', label: 'Submitted', node: (<div style={{ textAlign: 'center', padding: '16px 0' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: `${G}0.6)`, letterSpacing: '3px' }}>⏳ AWAITING REVIEW</div></div>) },
    ];
}

function EnduranceScenes(): Scene[] {
    return [
        { id: 'pre', label: 'Pre-start', node: (<div><div style={descBox}>Hold plank position for the full duration. Proper form. Camera shows full body.</div><div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginBottom: 16 }}><div style={{ height: '100%', width: '100%', background: `${G}0.55)`, borderRadius: 2 }} /></div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.85)`, letterSpacing: 4, textAlign: 'center', marginBottom: 20 }}>1:00</div><button style={goldBtn}>START TIMER</button><div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'running', label: 'Running', node: (<div><div style={descBox}>Hold plank position for the full duration.</div><div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginBottom: 16 }}><div style={{ height: '100%', width: '55%', background: `${G}0.55)`, borderRadius: 2, transition: 'width 0.9s linear' }} /></div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.85)`, letterSpacing: 4, textAlign: 'center', marginBottom: 20 }}>0:33</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 4, textAlign: 'center' }}>HOLD POSITION...</div></div>) },
        { id: 'danger', label: 'Almost done', node: (<div><div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginBottom: 16 }}><div style={{ height: '100%', width: '12%', background: `${R}0.7)`, borderRadius: 2 }} /></div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${R}0.8)`, letterSpacing: 4, textAlign: 'center', marginBottom: 20 }}>0:07</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${R}0.5)`, letterSpacing: 4, textAlign: 'center' }}>ALMOST THERE...</div></div>) },
        { id: 'done', label: 'Done → Upload', node: (<div><div style={{ height: 3, background: `${G}0.2)`, borderRadius: 2, marginBottom: 16 }} /><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: 'rgba(80,200,120,0.85)', letterSpacing: 4, textAlign: 'center', marginBottom: 20 }}>0:00</div><div style={uploadBtn}><UploadIcon /> UPLOAD PROOF</div></div>) },
    ];
}

function GreedGameScenes(): Scene[] {
    return [
        { id: 'start', label: 'Start', node: (<div><div style={descBox}>Push your luck — the more you risk, the more you could win or lose. Max: 50 coins.</div><div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.9)`, margin: '12px 0 8px' }}>0</div><div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 24 }}>COINS STACKED / MAX 50</div><div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}><button style={{ ...goldBtn, width: 'auto', padding: '16px 32px' }}>PUSH</button><button disabled style={{ padding: '16px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: 'rgba(255,255,255,0.1)', background: 'transparent', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, cursor: 'default' }}>CASH OUT</button></div></div><div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'mid', label: 'Mid-game (32 coins)', node: (<div><div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.9)`, margin: '12px 0 8px' }}>32</div><div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 24 }}>COINS STACKED / MAX 50</div><div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}><button style={{ ...goldBtn, width: 'auto', padding: '16px 32px' }}>PUSH</button><button style={{ padding: '16px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: 'rgba(80,200,120,0.8)', background: 'rgba(80,200,120,0.04)', border: '1px solid rgba(80,200,120,0.2)', borderRadius: 8, cursor: 'pointer' }}>CASH OUT</button></div></div></div>) },
        { id: 'busted', label: 'BUSTED', node: (<div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', color: `${R}0.9)`, letterSpacing: 4, marginBottom: 8 }}>BUSTED</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: `${R}0.5)`, marginBottom: 16 }}>Greed consumed you. You walk away with nothing.</div><button style={{ ...goldBtn, background: `${R}0.3)`, color: '#fff', width: 'auto', padding: '12px 28px' }}>SUBMIT RESULT</button></div>) },
        { id: 'cashout', label: 'Cashed Out', node: (<div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', color: 'rgba(80,200,120,0.8)', letterSpacing: 4, marginBottom: 8 }}>CASHED OUT: 32 COINS</div><button style={{ ...goldBtn, background: 'rgba(80,200,120,0.5)', color: '#080810', width: 'auto', padding: '12px 28px' }}>SUBMIT RESULT</button></div>) },
    ];
}

function TruthDareScenes(): Scene[] {
    return [
        { id: 'choosing', label: 'Choose', node: (<div><div style={descBox}>Choose truth or dare. Both will test you.</div><div style={{ display: 'flex', gap: 16 }}><button style={{ flex: 1, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: `${G}0.8)`, background: `${G}0.04)`, border: `1px solid ${G}0.2)`, borderRadius: 8, cursor: 'pointer' }}>TRUTH</button><button style={{ flex: 1, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: `${R}0.8)`, background: `${R}0.04)`, border: `1px solid ${R}0.2)`, borderRadius: 8, cursor: 'pointer' }}>DARE</button></div><div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'truth', label: 'Truth chosen', node: (<div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: `${G}0.6)`, letterSpacing: 3, marginBottom: 10 }}>TRUTH</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, padding: '14px 18px', background: `${G}0.06)`, border: `1px solid ${G}0.15)`, borderRadius: 8, marginBottom: 14 }}>What is one thing you failed at this week? Confess completely.</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, textAlign: 'center' }}>YOUR FATE IS SEALED</div></div>),
            followUp: <FollowUpWriting source="Truth or Dare" text="What is one thing you failed at this week? Confess completely." /> },
        { id: 'dare', label: 'Dare chosen', node: (<div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: `${R}0.6)`, letterSpacing: 3, marginBottom: 10 }}>DARE</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, padding: '14px 18px', background: `${R}0.06)`, border: `1px solid ${R}0.15)`, borderRadius: 8, marginBottom: 14 }}>Cold water on your face for 30 seconds — on camera</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, textAlign: 'center' }}>YOUR FATE IS SEALED</div></div>),
            followUp: <FollowUpEndurance source="Truth or Dare" text="Cold water on your face for 30 seconds — camera on" secs={30} /> },
    ];
}

function SimonSaysScenes(): Scene[] {
    return [
        { id: 'idle', label: 'Idle', node: (<div style={{ textAlign: 'center', padding: '12px 0 4px' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: `${G}0.45)`, letterSpacing: '7px', marginBottom: 22 }}>⚡ SIMON SAYS</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 12 }}>3 commands are waiting.</div><div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, marginBottom: 28 }}>Tasks will arrive at random. You will not be warned. When one appears — you obey immediately.</div><button style={goldBtn}>START THE GAME</button><div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={ghostBtn}>SKIP THIS TASK</button></div></div>) },
        { id: 'idle_empty', label: 'No commands', node: (<div style={{ textAlign: 'center', padding: '12px 0 4px' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: `${G}0.45)`, letterSpacing: '7px', marginBottom: 22 }}>⚡ SIMON SAYS</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 12 }}>You have obeyed.</div><div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, marginBottom: 28 }}>No commands were issued. Mark complete to continue.</div><button style={goldBtn}>MARK COMPLETE</button></div>) },
        { id: 'waiting', label: 'Waiting', node: (<div style={{ textAlign: 'center', padding: '20px 0' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: `${G}0.45)`, letterSpacing: '7px', marginBottom: 20 }}>⚡ SIMON SAYS</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Waiting for next command...</div><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2.5rem', color: `${G}0.7)`, marginBottom: 8, letterSpacing: 4 }}>23:47</div><div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 3 }}>COMMAND 1 OF 3</div></div>) },
        { id: 'task', label: 'Task Active', node: (<div><div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', color: `${R}0.6)`, letterSpacing: '7px', marginBottom: 14, textAlign: 'center' }}>⚡ SIMON SAYS</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.75, marginBottom: 18, padding: '18px 16px', background: `${R}0.06)`, border: `1px solid ${R}0.2)`, borderRadius: 10, textAlign: 'center' }}>Drop and do 10 pushups — NOW</div><div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', marginBottom: 18 }}><div style={{ height: '100%', width: '65%', background: `${G}0.55)`, borderRadius: 2 }} /></div><div style={uploadBtn}><UploadIcon /> UPLOAD PHOTO PROOF</div><div style={{ marginTop: 10, fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '4px', textAlign: 'center' }}>TASK 1 / 3</div></div>) },
        { id: 'complete', label: 'Complete', node: (<div style={{ textAlign: 'center', padding: '24px 10px 16px' }}><div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: 'rgba(80,200,120,0.45)', letterSpacing: '8px', marginBottom: 24 }}>ALL TASKS COMPLETE</div><div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 14 }}>Good boy.</div><div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.22)', lineHeight: 1.75, marginBottom: 28 }}>You've proven yourself today. You may rest.</div><button style={{ ...goldBtn, background: 'transparent', color: 'rgba(80,200,120,0.7)', border: '1px solid rgba(80,200,120,0.2)' }}>DONE</button></div>) },
    ];
}

function SkipOverlayScene(): Scene[] {
    return [
        { id: 'skip', label: 'Skip overlay', node: null,
            followUp: (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 30px', gap: 24, flex: 1 }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textAlign: 'center', lineHeight: 1.7 }}>Skip this task?</div>
                    <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <button style={{ width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', letterSpacing: 3, marginBottom: 6 }}>PAY 300 COINS</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: `${R}0.5)`, letterSpacing: 1 }}>BREAKS OBEDIENCE STREAK</div>
                    </button>
                    <button style={{ width: '100%', maxWidth: 300, padding: '18px 20px', borderRadius: 12, background: `${G}0.05)`, border: `1px solid ${G}0.25)`, cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: `${G}0.7)`, letterSpacing: 3, marginBottom: 6 }}>USE SKIP PASS</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>2 AVAILABLE</div>
                    </button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.18)', letterSpacing: 2, padding: '12px' }}>CANCEL</button>
                </div>
            ),
        },
    ];
}

/* ─── ALL MECHANISMS ─── */
const ALL_MECHS = [
    { id: 'spin_wheel',       icon: '◎', name: 'Spin Wheel',       scenes: SpinWheelScenes },
    { id: 'coinflip',         icon: '$', name: 'Coinflip',          scenes: CoinflipScenes },
    { id: 'card_pick',        icon: '♠', name: 'Card Pick',         scenes: CardPickScenes },
    { id: 'dice_roll',        icon: '⚄', name: 'Dice Roll',         scenes: DiceRollScenes },
    { id: 'russian_roulette', icon: '⊕', name: 'Russian Roulette',  scenes: RouletteScenes },
    { id: 'quiz',             icon: '?', name: 'Quiz',              scenes: QuizScenes },
    { id: 'writing',          icon: '✎', name: 'Writing',           scenes: WritingScenes },
    { id: 'photo_proof',      icon: '✍', name: 'Photo Proof',       scenes: PhotoProofScenes },
    { id: 'endurance',        icon: '▢', name: 'Endurance',         scenes: EnduranceScenes },
    { id: 'greed_game',       icon: '↑', name: 'Greed Game',        scenes: GreedGameScenes },
    { id: 'truth_dare',       icon: '?', name: 'Truth or Dare',     scenes: TruthDareScenes },
    { id: 'simon_says',       icon: '⚡', name: 'Simon Says',        scenes: SimonSaysScenes },
    { id: 'skip_overlay',     icon: '↷', name: 'Skip Overlay',      scenes: SkipOverlayScene },
];

export default function PreviewTasks() {
    const [mechId, setMechId] = useState('spin_wheel');
    const [sceneId, setSceneId] = useState('idle');

    const mech = ALL_MECHS.find(m => m.id === mechId)!;
    const scenes: Scene[] = mech.scenes();
    const scene = scenes.find(s => s.id === sceneId) || scenes[0];

    return (
        <div style={{ minHeight: '100dvh', background: '#05050a', color: '#fff' }}>
            {/* Top bar */}
            <div style={{ background: '#0a0a12', borderBottom: '1px solid rgba(197,160,89,0.15)', padding: '12px 16px 0' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: `${G}0.5)`, letterSpacing: '6px', marginBottom: 10 }}>MECHANISM PREVIEW — localhost:3000/preview-tasks</div>
                {/* Mechanism tabs */}
                <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 0 }}>
                    {ALL_MECHS.map(m => (
                        <button key={m.id} onClick={() => { setMechId(m.id); setSceneId(m.scenes()[0]?.id || ''); }} style={{ padding: '8px 14px 10px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', letterSpacing: '1.5px', color: mechId === m.id ? `${G}0.95)` : 'rgba(255,255,255,0.25)', background: 'transparent', border: 'none', borderBottom: `2px solid ${mechId === m.id ? `${G}0.7)` : 'transparent'}`, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {m.icon} {m.name.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* State tabs */}
            <div style={{ background: '#07070f', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {scenes.map(s => (
                    <button key={s.id} onClick={() => setSceneId(s.id)} style={{ padding: '6px 14px', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', letterSpacing: '2px', color: sceneId === s.id ? '#080810' : 'rgba(255,255,255,0.45)', background: sceneId === s.id ? `${G}0.7)` : 'rgba(255,255,255,0.04)', border: `1px solid ${sceneId === s.id ? `${G}0.5)` : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Phone-sized preview */}
            <div style={{ padding: '24px 16px 48px', display: 'flex', justifyContent: 'center' }}>
                <VaultFrame icon={mech.icon} taskName={mech.name} followUpOverlay={scene.followUp}>
                    {scene.node}
                </VaultFrame>
            </div>
        </div>
    );
}
