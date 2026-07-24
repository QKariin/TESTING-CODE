'use client';
import { useState } from 'react';

const R = 'rgba(139,0,0,';
const G = 'rgba(197,160,89,';

/* ─── Shared styles ─── */
const BG = 'linear-gradient(rgba(4,3,10,0.78) 0%, rgba(4,3,10,0.85) 100%), url(/work-bg.jpg) center top / cover no-repeat';
const cardShell: React.CSSProperties = {
    border: '1px solid rgba(197,160,89,0.35)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden',
};
const cardHeader: React.CSSProperties = {
    padding: '18px 20px 16px', background: 'rgba(197,160,89,0.05)', borderBottom: '1px solid rgba(197,160,89,0.1)',
    display: 'flex', alignItems: 'center', gap: 14,
};
const cardBody: React.CSSProperties = {
    padding: '22px 20px 28px', background: 'rgba(15,12,25,0.6)',
};
const goldAccent: React.CSSProperties = {
    height: 2, background: 'linear-gradient(90deg, rgba(197,160,89,0.85) 0%, rgba(197,160,89,0.05) 100%)', borderRadius: '2px 2px 0 0',
};
const uploadBtn: React.CSSProperties = {
    width: '100%', padding: '18px 20px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 700,
    letterSpacing: '3px', color: '#c5a059', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
    border: '1px solid #c5a059', borderRadius: 10, textAlign: 'center', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10, boxShadow: '0 0 15px rgba(197,160,89,0.2)', cursor: 'pointer',
};
const goldBtn: React.CSSProperties = {
    width: '100%', padding: '16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', fontWeight: 700,
    letterSpacing: '3px', color: '#080810', background: 'rgba(197,160,89,0.7)', border: 'none', borderRadius: 8, cursor: 'pointer',
};
const descBox: React.CSSProperties = {
    fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: 22,
    padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)',
};
const skipBtn: React.CSSProperties = {
    width: '100%', padding: '12px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', letterSpacing: '3px',
    color: 'rgba(255,255,255,0.22)', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer',
};

function TaskCard({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <div style={goldAccent} />
            <div style={cardShell}>
                <div style={cardHeader}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(197,160,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.07)', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.95rem', color: 'rgba(197,160,89,0.85)' }}>{icon}</span>
                    </div>
                    <div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '5px', marginBottom: 4 }}>NOW</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.92)', letterSpacing: '1px' }}>{label}</div>
                    </div>
                </div>
                <div style={cardBody}>{children}</div>
            </div>
        </div>
    );
}

/* ═══════════════ MECHANISMS ═══════════════ */

function SpinWheel() {
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [angle, setAngle] = useState(0);
    const WHEEL = ['Cold shower 60s', 'Write 50 lines', 'Edge & deny', 'Body writing photo', 'Confession essay', '2 min wall sit'];
    const spin = () => {
        if (spinning || result) return;
        setSpinning(true);
        const newAngle = angle + 1440 + Math.floor(Math.random() * 360);
        setAngle(newAngle);
        setTimeout(() => {
            setSpinning(false);
            setResult(WHEEL[Math.floor(Math.random() * WHEEL.length)]);
        }, 4000);
    };
    return (
        <TaskCard icon="◎" label="Spin the Wheel">
            <div style={descBox}>Spin the wheel of fate. Whatever it lands on, you obey.</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 20px' }}>
                    <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '14px solid rgba(197,160,89,0.7)', zIndex: 2 }} />
                    <div style={{ width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(197,160,89,0.15)', transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.2,0.8,0.3,1)' : 'none', position: 'relative', overflow: 'hidden' }}>
                        {WHEEL.map((_, wi) => { const seg = 360 / WHEEL.length; return <div key={wi} style={{ position: 'absolute', width: '50%', height: '50%', top: 0, right: 0, transformOrigin: '0% 100%', transform: `rotate(${wi * seg - 90}deg) skewY(-${90 - seg}deg)`, background: wi % 2 === 0 ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />; })}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: '50%', background: '#0a0a0e', border: '1px solid rgba(197,160,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                            <span style={{ color: 'rgba(197,160,89,0.7)', fontSize: '0.8rem' }}>♛</span>
                        </div>
                    </div>
                </div>
                {result ? (
                    <div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${G}0.6)`, letterSpacing: 3, marginBottom: 8 }}>YOU LANDED ON</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: `${G}0.8)`, padding: '14px 18px', background: `${G}0.06)`, border: `1px solid ${G}0.15)`, borderRadius: 8, marginBottom: 16 }}>{result}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '4px' }}>YOUR FATE IS SEALED</div>
                    </div>
                ) : (
                    <button onClick={spin} disabled={spinning} style={{ ...goldBtn, width: 'auto', padding: '14px 44px' }}>
                        {spinning ? 'SPINNING...' : 'SPIN'}
                    </button>
                )}
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function Coinflip() {
    const [result, setResult] = useState<'heads' | 'tails' | null>(null);
    const [flipping, setFlipping] = useState(false);
    const flip = () => {
        if (flipping || result) return;
        setFlipping(true);
        setTimeout(() => { setFlipping(false); setResult(Math.random() > 0.5 ? 'heads' : 'tails'); }, 1200);
    };
    return (
        <TaskCard icon="$" label="Coinflip">
            <div style={descBox}>Heads: +20 coins — Queen shows mercy / Tails: Write 30 lines: "I will obey without question"</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${result === 'heads' ? `${G}0.7)` : result === 'tails' ? `${R}0.5)` : `${G}0.3)`}`, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${G}0.05)`, fontSize: '2rem', transition: 'all 0.3s', transform: flipping ? 'rotateY(90deg)' : 'none' }}>
                    {result === 'heads' ? '♛' : result === 'tails' ? '✕' : '$'}
                </div>
                {result ? (
                    <div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.2rem', color: result === 'heads' ? 'rgba(80,200,120,0.85)' : `${R}0.8)`, letterSpacing: 6, marginBottom: 12 }}>{result.toUpperCase()}</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', padding: '12px 16px', background: result === 'heads' ? 'rgba(80,200,120,0.06)' : `${R}0.06)`, border: `1px solid ${result === 'heads' ? 'rgba(80,200,120,0.2)' : `${R}0.2)`}`, borderRadius: 8 }}>
                            {result === 'heads' ? '+20 coins — Queen shows mercy' : 'Write 30 lines: "I will obey without question"'}
                        </div>
                    </div>
                ) : (
                    <button onClick={flip} style={{ ...goldBtn, width: 'auto', padding: '14px 44px' }}>FLIP</button>
                )}
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function CardPick() {
    const [picked, setPicked] = useState<number | null>(null);
    const CARDS = ['Write a worship message', 'Gratitude list (5 items)', 'Devotion photo', 'Tribute 5 coins', '1 min plank on camera'];
    return (
        <TaskCard icon="♠" label="Card Pick">
            <div style={descBox}>Draw a card from Queen's deck. Each card holds a task or consequence. Accept it.</div>
            {picked !== null ? (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: `${G}0.6)`, letterSpacing: 3, marginBottom: 10 }}>YOUR CARD</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: `${G}0.8)`, padding: '18px', background: `${G}0.06)`, border: `1px solid ${G}0.2)`, borderRadius: 10, marginBottom: 14 }}>{CARDS[picked]}</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4 }}>YOUR FATE IS SEALED</div>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {CARDS.map((_, i) => (
                        <div key={i} onClick={() => setPicked(i)} style={{ width: 72, height: 100, borderRadius: 8, border: `1px solid ${R}0.35)`, background: `${R}0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.5rem' }}>♠</div>
                    ))}
                </div>
            )}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function DiceRoll() {
    const FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const OUTCOMES = ['Write lines x40', 'Cold shower 30s', '20 pushups on camera', 'Body writing: OBEY', 'Gratitude essay (100 words)', '2 min wall sit on camera'];
    const [result, setResult] = useState<number | null>(null);
    const [rolling, setRolling] = useState(false);
    const [current, setCurrent] = useState(0);
    const roll = () => {
        if (rolling || result !== null) return;
        setRolling(true);
        let count = 0;
        const iv = setInterval(() => { setCurrent(Math.floor(Math.random() * 6)); count++; if (count > 12) { clearInterval(iv); const final = Math.floor(Math.random() * 6); setCurrent(final); setResult(final); setRolling(false); } }, 100);
    };
    return (
        <TaskCard icon="⚄" label="Dice Roll">
            <div style={descBox}>Roll the dice. The number determines your punishment intensity.</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '5rem', margin: '10px 0 20px', transition: 'all 0.1s' }}>{FACES[current]}</div>
                {result !== null ? (
                    <div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: `${G}0.8)`, padding: '14px 18px', background: `${G}0.06)`, border: `1px solid ${G}0.2)`, borderRadius: 8, marginBottom: 14 }}>{OUTCOMES[result]}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4 }}>YOU ROLLED {result + 1}</div>
                    </div>
                ) : (
                    <button onClick={roll} style={{ ...goldBtn, width: 'auto', padding: '14px 44px' }}>{rolling ? 'ROLLING...' : 'ROLL'}</button>
                )}
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function RussianRoulette() {
    const [shot, setShot] = useState<boolean | null>(null);
    const fire = () => setShot(Math.random() < 1 / 6);
    return (
        <TaskCard icon="⊕" label="Russian Roulette">
            <div style={descBox}>One chamber holds a penalty. Pull the trigger and hope for the best.</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${shot === true && i === 0 ? `${R}0.8)` : `${G}0.25)`}`, background: shot === true && i === 0 ? `${R}0.15)` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {shot === true && i === 0 && <div style={{ width: 10, height: 10, borderRadius: '50%', background: `${R}0.7)` }} />}
                        </div>
                    ))}
                </div>
                {shot === null ? (
                    <button onClick={fire} style={{ ...goldBtn, width: 'auto', padding: '16px 48px', background: `${R}0.5)`, color: '#fff' }}>PULL THE TRIGGER</button>
                ) : shot ? (
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: `${R}0.9)`, letterSpacing: 4, padding: '20px', background: `${R}0.06)`, border: `1px solid ${R}0.25)`, borderRadius: 10 }}>
                        PUNISHED — Cold shower 2 minutes + 50 lines
                    </div>
                ) : (
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(80,200,120,0.8)', letterSpacing: 3 }}>YOU SURVIVED</div>
                )}
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function Quiz() {
    const Q = { question: "What is the first thing you must do each morning in the program?", answers: ['Check phone', 'Complete your kneeling', 'Send a message', 'Wait for instructions'], correctIdx: 1 };
    const [chosen, setChosen] = useState<number | null>(null);
    return (
        <TaskCard icon="?" label="Quiz">
            <div style={descBox}>{Q.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Q.answers.map((a, i) => {
                    const isChosen = chosen === i;
                    const isCorrect = i === Q.correctIdx;
                    const bg = chosen === null ? 'rgba(255,255,255,0.03)' : isCorrect ? 'rgba(80,200,120,0.1)' : isChosen ? `${R}0.08)` : 'transparent';
                    const border = chosen === null ? 'rgba(255,255,255,0.08)' : isCorrect ? 'rgba(80,200,120,0.4)' : isChosen ? `${R}0.3)` : 'rgba(255,255,255,0.05)';
                    return (
                        <button key={i} onClick={() => chosen === null && setChosen(i)} style={{ padding: '14px 18px', fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: chosen !== null ? (isCorrect ? 'rgba(80,200,120,0.9)' : isChosen ? `${R}0.7)` : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.7)', background: bg, border: `1px solid ${border}`, borderRadius: 8, cursor: chosen === null ? 'pointer' : 'default', textAlign: 'left' }}>
                            {a}
                        </button>
                    );
                })}
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function WritingPrompt() {
    const [text, setText] = useState('');
    return (
        <TaskCard icon="✎" label="Writing Prompt">
            <div style={descBox}>Write about why you chose to submit. What brought you here? What do you hope to become? Be honest and vulnerable. (100 words min)</div>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write here..." style={{ width: '100%', minHeight: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(197,160,89,0.12)', borderRadius: 10, padding: 16, color: 'rgba(255,255,255,0.6)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '16px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>{text.split(/\s+/).filter(Boolean).length} words</span>
                <button disabled={!text.trim()} style={{ ...goldBtn, width: 'auto', padding: '12px 28px', opacity: text.trim() ? 1 : 0.3 }}>SUBMIT</button>
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function PhotoProof() {
    return (
        <TaskCard icon="✍" label="Photo Proof">
            <div style={descBox}>Take a photo on your knees, head bowed. Your first act of visible submission.</div>
            <div style={uploadBtn as any}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                UPLOAD PROOF
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function EnduranceTimer() {
    const [secs, setSecs] = useState(60);
    const [running, setRunning] = useState(false);
    const start = () => { setRunning(true); const iv = setInterval(() => setSecs(s => { if (s <= 1) { clearInterval(iv); setRunning(false); return 0; } return s - 1; }), 1000); };
    return (
        <TaskCard icon="▢" label="Endurance Timer">
            <div style={descBox}>Hold plank position for the full duration. Proper form. Camera shows full body.</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ height: '100%', width: `${(secs / 60) * 100}%`, background: secs <= 12 ? `${R}0.7)` : `${G}0.55)`, borderRadius: 2, transition: 'width 0.9s linear' }} />
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.85)`, letterSpacing: 4, marginBottom: 20 }}>
                    {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
                </div>
                {!running && secs > 0 && <button onClick={start} style={goldBtn}>START TIMER</button>}
                {running && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 4 }}>HOLD YOUR POSITION...</div>}
                {secs === 0 && <div style={uploadBtn as any}>UPLOAD PROOF</div>}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function GreedGame() {
    const CEIL = 50;
    const [coins, setCoins] = useState(0);
    const [busted, setBusted] = useState(false);
    const [cashedOut, setCashedOut] = useState(false);
    const push = () => { const add = Math.floor(Math.random() * 15) + 3; const next = Math.min(coins + add, CEIL); const bustChance = next / CEIL; if (Math.random() < bustChance * 0.6) { setBusted(true); setCoins(0); } else setCoins(next); };
    return (
        <TaskCard icon="↑" label="Greed Game">
            <div style={descBox}>Push your luck — the more you risk, the more you could win or lose. Max: {CEIL} coins.</div>
            {!busted && !cashedOut ? (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.9)`, margin: '12px 0 8px' }}>{coins}</div>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 24 }}>COINS STACKED / MAX {CEIL}</div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={push} style={{ ...goldBtn, width: 'auto', padding: '16px 32px' }}>PUSH</button>
                        <button disabled={coins === 0} onClick={() => setCashedOut(true)} style={{ padding: '16px 32px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: coins > 0 ? 'rgba(80,200,120,0.8)' : 'rgba(255,255,255,0.1)', background: coins > 0 ? 'rgba(80,200,120,0.04)' : 'transparent', border: `1px solid ${coins > 0 ? 'rgba(80,200,120,0.2)' : 'rgba(255,255,255,0.04)'}`, borderRadius: 8, cursor: coins > 0 ? 'pointer' : 'default' }}>CASH OUT</button>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1rem', color: busted ? `${R}0.9)` : 'rgba(80,200,120,0.8)', letterSpacing: 4, marginBottom: 8 }}>{busted ? 'BUSTED' : `CASHED OUT: ${coins} COINS`}</div>
                    {busted && <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: `${R}0.5)`, marginBottom: 16 }}>Greed consumed you.</div>}
                    <button onClick={() => { setBusted(false); setCashedOut(false); setCoins(0); }} style={{ ...goldBtn, width: 'auto', padding: '12px 28px', background: 'rgba(80,200,120,0.5)' }}>SUBMIT RESULT</button>
                </div>
            )}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function TruthOrDare() {
    const [choice, setChoice] = useState<'truth' | 'dare' | null>(null);
    const TRUTH = 'What is one thing you failed at this week? Confess completely.';
    const DARE = 'Cold water on your face for 30 seconds — on camera';
    return (
        <TaskCard icon="?" label="Truth or Dare">
            <div style={descBox}>Choose truth or dare. Both will test you.</div>
            {!choice ? (
                <div style={{ display: 'flex', gap: 16 }}>
                    <button onClick={() => setChoice('truth')} style={{ flex: 1, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: `${G}0.8)`, background: `${G}0.04)`, border: `1px solid ${G}0.2)`, borderRadius: 8, cursor: 'pointer' }}>TRUTH</button>
                    <button onClick={() => setChoice('dare')} style={{ flex: 1, padding: '20px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.9rem', letterSpacing: '3px', color: `${R}0.8)`, background: `${R}0.04)`, border: `1px solid ${R}0.2)`, borderRadius: 8, cursor: 'pointer' }}>DARE</button>
                </div>
            ) : (
                <div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.85rem', color: choice === 'truth' ? `${G}0.6)` : `${R}0.6)`, letterSpacing: 3, marginBottom: 10 }}>{choice.toUpperCase()}</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, padding: '14px 18px', background: choice === 'truth' ? `${G}0.06)` : `${R}0.06)`, border: `1px solid ${choice === 'truth' ? `${G}0.15)` : `${R}0.15)`}`, borderRadius: 8 }}>
                        {choice === 'truth' ? TRUTH : DARE}
                    </div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 4, textAlign: 'center', marginTop: 14 }}>YOUR FATE IS SEALED</div>
                </div>
            )}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function SimonSays() {
    const CHAIN = [{ text: 'Drop and do 10 pushups — NOW', timeLimit: 30 }, { text: 'Take a selfie on your knees', timeLimit: 20 }, { text: 'Write "I obey" 10 times', timeLimit: 40 }];
    const [phase, setPhase] = useState<'idle' | 'waiting' | 'task' | 'complete'>('idle');
    const [step, setStep] = useState(0);
    return (
        <TaskCard icon="⚡" label="Simon Says">
            {phase === 'idle' && (
                <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: `${G}0.45)`, letterSpacing: '7px', marginBottom: 22 }}>⚡ SIMON SAYS</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 12 }}>{CHAIN.length} commands are waiting.</div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, marginBottom: 28 }}>Tasks will arrive at random. You will not be warned.</div>
                    <button onClick={() => setPhase('waiting')} style={goldBtn}>START THE GAME</button>
                </div>
            )}
            {phase === 'waiting' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: `${G}0.45)`, letterSpacing: '7px', marginBottom: 20 }}>⚡ SIMON SAYS</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Waiting for next command...</div>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: `${G}0.7)`, marginBottom: 20 }}>23:47</div>
                    <button onClick={() => setPhase('task')} style={{ ...goldBtn, background: 'transparent', color: `${G}0.5)`, border: `1px solid ${G}0.2)` }}>SIMULATE TASK ARRIVAL →</button>
                </div>
            )}
            {phase === 'task' && (
                <div>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.55rem', color: `${R}0.6)`, letterSpacing: '7px', marginBottom: 14, textAlign: 'center' }}>⚡ SIMON SAYS</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.75, marginBottom: 18, padding: '18px 16px', background: `${R}0.06)`, border: `1px solid ${R}0.2)`, borderRadius: 10, textAlign: 'center' }}>{CHAIN[step].text}</div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', marginBottom: 18 }}>
                        <div style={{ height: '100%', width: '65%', background: `${G}0.55)`, borderRadius: 2 }} />
                    </div>
                    <div style={uploadBtn as any}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        UPLOAD PHOTO PROOF
                    </div>
                    <div style={{ marginTop: 10, fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '4px', textAlign: 'center' }}>TASK {step + 1} / {CHAIN.length}</div>
                    <div style={{ marginTop: 12 }}><button onClick={() => { if (step + 1 >= CHAIN.length) setPhase('complete'); else { setStep(s => s + 1); setPhase('waiting'); } }} style={{ ...goldBtn, background: 'transparent', color: `${G}0.5)`, border: `1px solid ${G}0.2)`, fontSize: '0.65rem' }}>SIMULATE COMPLETE →</button></div>
                </div>
            )}
            {phase === 'complete' && (
                <div style={{ textAlign: 'center', padding: '24px 10px 16px' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.48rem', color: 'rgba(80,200,120,0.45)', letterSpacing: '8px', marginBottom: 24 }}>ALL TASKS COMPLETE</div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 24 }}>Good boy.</div>
                    <button onClick={() => { setPhase('idle'); setStep(0); }} style={{ ...goldBtn, background: 'transparent', color: 'rgba(80,200,120,0.7)', border: '1px solid rgba(80,200,120,0.2)' }}>DONE</button>
                </div>
            )}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function Payment() {
    return (
        <TaskCard icon="◆" label="Payment / Tribute">
            <div style={descBox}>Send your required tribute to Queen Karin.</div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: `${G}0.9)`, margin: '8px 0 4px' }}>10</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 20 }}>COINS REQUIRED</div>
                <button style={goldBtn}>PAY TRIBUTE</button>
            </div>
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

function SelfReport({ label, icon, desc }: { label: string; icon: string; desc: string }) {
    return (
        <TaskCard icon={icon} label={label}>
            <div style={descBox}>{desc}</div>
            <button style={goldBtn}>MARK COMPLETE</button>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}><button style={skipBtn}>SKIP THIS TASK</button></div>
        </TaskCard>
    );
}

/* ═══════════════ SKIP OVERLAY PREVIEW ═══════════════ */
function SkipOverlay() {
    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', color: `${G}0.4)`, letterSpacing: '6px', marginBottom: 16 }}>SKIP TASK OVERLAY</div>
            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>Skip this task?</div>
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
        </div>
    );
}

const SECTIONS = ['Chance', 'Interactive', 'Proof', 'Writing', 'Special', 'Skip'];

export default function PreviewTasks() {
    const [active, setActive] = useState('Chance');
    return (
        <div style={{ minHeight: '100dvh', background: BG, color: '#fff', fontFamily: 'Cinzel, serif' }}>
            {/* Header */}
            <div style={{ padding: '24px 20px 0', borderBottom: '1px solid rgba(197,160,89,0.12)' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem', color: `${G}0.55)`, letterSpacing: '6px', marginBottom: 4 }}>LOCAL</div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '3px', marginBottom: 16 }}>MECHANISM PREVIEW</div>
                {/* Tab nav */}
                <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {SECTIONS.map(s => (
                        <button key={s} onClick={() => setActive(s)} style={{ padding: '10px 16px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.5rem', letterSpacing: '2px', color: active === s ? `${G}0.9)` : 'rgba(255,255,255,0.25)', background: 'transparent', border: 'none', borderBottom: `2px solid ${active === s ? `${G}0.7)` : 'transparent'}`, cursor: 'pointer', flexShrink: 0 }}>{s.toUpperCase()}</button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px 16px 80px' }}>
                {active === 'Chance' && (<><SpinWheel /><Coinflip /><DiceRoll /><RussianRoulette /></>)}
                {active === 'Interactive' && (<><CardPick /><GreedGame /><TruthOrDare /><SimonSays /></>)}
                {active === 'Proof' && (<><PhotoProof /><EnduranceTimer /></>)}
                {active === 'Writing' && (<><WritingPrompt /></>)}
                {active === 'Special' && (<><Payment /><SelfReport icon="⏱" label="Corner Time" desc="Stand in the corner facing the wall. Hands behind your back. Do not move until the timer ends." /><SelfReport icon="❄" label="Cold Shower" desc="Take a cold shower for 60 seconds. Film or photograph yourself as proof." /><SelfReport icon="🤐" label="Silence" desc="You are forbidden from messaging today. Endure the silence." /></>)}
                {active === 'Skip' && (<><SkipOverlay /></>)}
            </div>
        </div>
    );
}
