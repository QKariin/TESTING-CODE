'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

/* ─── Design tokens ─── */
const G = 'rgba(197,160,89,';
const R = 'rgba(139,0,0,';
const BG = 'linear-gradient(rgba(4,3,10,0.78) 0%,rgba(4,3,10,0.88) 100%),url(/work-bg.jpg) center top/cover no-repeat';
const GOLD: React.CSSProperties = { width:'100%', padding:'16px', fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', fontWeight:700, letterSpacing:'3px', color:'#080810', background:`${G}0.7)`, border:'none', borderRadius:8, cursor:'pointer' };
const GHOST: React.CSSProperties = { width:'100%', padding:'12px', fontFamily:'Orbitron,sans-serif', fontSize:'0.6rem', letterSpacing:'3px', color:'rgba(255,255,255,0.22)', background:'transparent', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, cursor:'pointer' };
const UPLOAD: React.CSSProperties = { width:'100%', padding:'18px 20px', fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', fontWeight:700, letterSpacing:'3px', color:'#c5a059', background:'rgba(255,255,255,0.05)', backdropFilter:'blur(10px)', border:'1px solid #c5a059', borderRadius:10, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:10, boxShadow:'0 0 15px rgba(197,160,89,0.2)', cursor:'pointer' };
const DESC: React.CSSProperties = { fontFamily:'Cinzel,serif', fontSize:'0.95rem', color:'rgba(255,255,255,0.75)', lineHeight:1.8, marginBottom:22, padding:'14px 16px', background:'rgba(0,0,0,0.25)', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)' };

const UploadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;

/* ─── Mechanisms ─── */
const MECHS = [
    { id:'spin_wheel', name:'Spin Wheel', icon:'◎', desc:'Spin the wheel of fate. Whatever it lands on, you obey.' },
    { id:'coinflip', name:'Coinflip', icon:'$', desc:'Heads or tails — fate decides. No take-backs.' },
    { id:'card_pick', name:'Card Pick', icon:'♠', desc:"Draw a card from Queen's deck. Accept what you get." },
    { id:'dice_roll', name:'Dice Roll', icon:'⚄', desc:'Roll the dice. The number determines your punishment.' },
    { id:'russian_roulette', name:'Roulette', icon:'⊕', desc:'One chamber holds a penalty. Pull the trigger.' },
    { id:'quiz', name:'Quiz', icon:'?', desc:"Answer Queen's question. Wrong answers have consequences." },
    { id:'writing', name:'Writing', icon:'✎', desc:'Write as instructed. Quality and honesty judged.' },
    { id:'photo_proof', name:'Photo Proof', icon:'✍', desc:'Take a clear photo as proof. No filters.' },
    { id:'endurance', name:'Endurance', icon:'▢', desc:'Endure the challenge for the full duration.' },
    { id:'greed_game', name:'Greed Game', icon:'↑', desc:'Push your luck. The more you risk, the more you can lose.' },
    { id:'truth_dare', name:'Truth/Dare', icon:'?', desc:'Choose truth or dare. Both will test you.' },
    { id:'simon_says', name:'Simon Says', icon:'⚡', desc:'Commands arrive at random. You obey immediately.' },
    { id:'lines', name:'Lines', icon:'✏', desc:'Write the assigned line repeatedly.' },
    { id:'corner_time', name:'Corner Time', icon:'⏱', desc:'Stand in the corner. No phone. No distractions.' },
    { id:'cold_shower', name:'Cold Shower', icon:'❄', desc:'Cold shower for the assigned duration. Camera on.' },
    { id:'body_writing', name:'Body Writing', icon:'✍', desc:'Write the required word on your body. Photograph it.' },
    { id:'exercise', name:'Exercise', icon:'▢', desc:'Complete the required reps. Video proof required.' },
    { id:'edge', name:'Edge', icon:'◆', desc:'Edge as instructed. Do not release. Report.' },
];

/* ─── Follow-up overlays ─── */
function FuWriting({ prompt, onDone, onSkip }: { prompt: string; onDone: () => void; onSkip: () => void }) {
    const [val, setVal] = useState('');
    const wc = val.split(/\s+/).filter(Boolean).length;
    const min = 50; const ok = wc >= min;
    return (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'56px 20px 120px', gap:0 }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.15)', letterSpacing:4, textAlign:'center', marginBottom:32 }}>FOLLOW-UP</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:'rgba(255,255,255,0.7)', textAlign:'center', lineHeight:1.75, marginBottom:28, maxWidth:320 }}>{prompt}</div>
            <div style={{ width:'100%', maxWidth:340 }}>
                <textarea value={val} onChange={e => setVal(e.target.value)} placeholder="Write here..." style={{ width:'100%', minHeight:140, background:'rgba(255,255,255,0.03)', border:`1px solid ${G}0.12)`, borderRadius:10, padding:16, color:'rgba(255,255,255,0.6)', fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'16px', lineHeight:1.7, resize:'vertical', outline:'none', boxSizing:'border-box' }} />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                    <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.85rem', color: ok ? `${G}0.6)` : 'rgba(255,255,255,0.35)' }}>{wc} / {min} words</span>
                    <button onClick={onDone} disabled={!ok} style={{ ...GOLD, width:'auto', padding:'12px 28px', opacity: ok ? 1 : 0.3 }}>SUBMIT</button>
                </div>
                <div style={{ marginTop:20 }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>
            </div>
        </div>
    );
}

function FuPhoto({ instruction, onDone, onSkip }: { instruction: string; onDone: () => void; onSkip: () => void }) {
    const [done, setDone] = useState(false);
    return (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'56px 20px 120px' }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.15)', letterSpacing:4, textAlign:'center', marginBottom:32 }}>FOLLOW-UP</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:'rgba(255,255,255,0.7)', textAlign:'center', lineHeight:1.75, marginBottom:36, maxWidth:320 }}>{instruction}</div>
            <div style={{ width:'75%' }}>
                {!done ? (
                    <div onClick={() => setDone(true)} style={UPLOAD}><UploadIcon /> UPLOAD PHOTO</div>
                ) : (
                    <div style={{ textAlign:'center' }}>
                        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', color:`${G}0.6)`, letterSpacing:'3px', marginBottom:20 }}>⏳ AWAITING REVIEW</div>
                        <button onClick={onDone} style={{ ...GOLD, width:'auto', padding:'12px 28px' }}>DONE</button>
                    </div>
                )}
                {!done && <div style={{ marginTop:24 }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>}
            </div>
        </div>
    );
}

function FuEndurance({ instruction, duration, onDone, onSkip }: { instruction: string; duration: number; onDone: () => void; onSkip: () => void }) {
    const [left, setLeft] = useState(duration);
    const [running, setRunning] = useState(false);
    const ref = useRef<any>(null);
    const start = () => { setRunning(true); ref.current = setInterval(() => setLeft(s => { if (s <= 1) { clearInterval(ref.current); setRunning(false); return 0; } return s - 1; }), 1000); };
    return (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'56px 20px 120px' }}>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.15)', letterSpacing:4, textAlign:'center', marginBottom:24 }}>FOLLOW-UP</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:'rgba(255,255,255,0.65)', textAlign:'center', lineHeight:1.75, marginBottom:28, maxWidth:320 }}>{instruction}</div>
            <div style={{ width:'100%', maxWidth:340 }}>
                <div style={{ height:3, background:'rgba(255,255,255,0.04)', borderRadius:2, overflow:'hidden', marginBottom:16 }}>
                    <div style={{ height:'100%', width:`${(left/duration)*100}%`, background: left <= duration*0.2 ? `${R}0.7)` : `${G}0.55)`, borderRadius:2, transition:'width 0.9s linear' }} />
                </div>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'3rem', color:`${G}0.85)`, letterSpacing:4, textAlign:'center', marginBottom:20 }}>{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</div>
                {left > 0 && !running && <button onClick={start} style={GOLD}>START TIMER</button>}
                {running && <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.25)', letterSpacing:4, textAlign:'center' }}>HOLD POSITION...</div>}
                {left === 0 && (
                    <div>
                        <div onClick={onDone} style={{ ...UPLOAD, marginBottom:16 }}><UploadIcon /> UPLOAD PROOF</div>
                        <button onClick={onDone} style={GOLD}>DONE</button>
                    </div>
                )}
                {left > 0 && <div style={{ marginTop:20 }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>}
            </div>
        </div>
    );
}

function FuAcknowledge({ text, onDone }: { text: string; onDone: () => void }) {
    return (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1.1rem', color:'rgba(255,255,255,0.7)', textAlign:'center', lineHeight:1.75, marginBottom:36, maxWidth:320 }}>{text}</div>
            <button onClick={onDone} style={{ ...GOLD, width:'auto', padding:'16px 48px' }}>ACKNOWLEDGE</button>
        </div>
    );
}

type FollowUp = { type: 'writing'|'photo'|'endurance'|'ack'; prompt: string; duration?: number };

/* ─── Skip overlay ─── */
function SkipOverlay({ coins, passes, onCoin, onPass, onCancel }: { coins: number; passes: number; onCoin: () => void; onPass: () => void; onCancel: () => void }) {
    return (
        <div style={{ position:'absolute', inset:0, zIndex:60, background:BG, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:'40px 30px' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:'rgba(255,255,255,0.5)', letterSpacing:2, textAlign:'center', lineHeight:1.7 }}>Skip this task?</div>
            <div style={{ width:40, height:1, background:'rgba(255,255,255,0.06)' }} />
            <button onClick={onCoin} style={{ width:'100%', maxWidth:300, padding:'18px 20px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', textAlign:'center' }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.75rem', color:'rgba(255,255,255,0.55)', letterSpacing:3, marginBottom:6 }}>PAY 300 COINS</div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.7rem', color:`${R}0.5)`, letterSpacing:1 }}>WALLET: {coins} — BREAKS STREAK</div>
            </button>
            <button onClick={onPass} disabled={passes <= 0} style={{ width:'100%', maxWidth:300, padding:'18px 20px', borderRadius:12, background:`${G}0.05)`, border:`1px solid ${G}${passes > 0 ? '0.25' : '0.08'})`, cursor: passes > 0 ? 'pointer' : 'not-allowed', textAlign:'center', opacity: passes > 0 ? 1 : 0.4 }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.75rem', color:`${G}0.7)`, letterSpacing:3, marginBottom:6 }}>USE SKIP PASS</div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.25)', letterSpacing:1 }}>{passes} AVAILABLE</div>
            </button>
            <button onClick={onCancel} style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'Rajdhani,sans-serif', fontSize:'0.75rem', color:'rgba(255,255,255,0.18)', letterSpacing:2, padding:'12px' }}>CANCEL</button>
        </div>
    );
}

/* ─── Mechanism renderers ─── */
function SpinWheel({ onResult }: { onResult: (text: string, fu: FollowUp) => void }) {
    const SEGS = [
        { text:'Edge 3 times. No release.', fu:{ type:'ack' as const, prompt:'Edge 3 times. No release. Acknowledge when done.' }},
        { text:'+2 days added to sentence', fu:{ type:'ack' as const, prompt:'Queen adds 2 days to your sentence. Acknowledge your punishment.' }},
        { text:'Write 50 lines of devotion', fu:{ type:'writing' as const, prompt:'Write 50 lines: "I exist to serve and obey."' }},
        { text:'Cold shower — 60s proof', fu:{ type:'endurance' as const, prompt:'Cold shower for 60 seconds. Camera on, do not stop.', duration:60 }},
        { text:'Confession essay (100 words)', fu:{ type:'writing' as const, prompt:'Confess your deepest weakness in at least 100 words.' }},
        { text:'Body writing photo', fu:{ type:'photo' as const, prompt:'Write OWNED on your body. Clear photograph.' }},
        { text:'2 min wall sit on camera', fu:{ type:'endurance' as const, prompt:'Wall sit for 2 full minutes. Camera on.', duration:120 }},
        { text:'Queen grants 50 coins', fu:{ type:'ack' as const, prompt:'Queen grants you 50 coins as a mercy. Accept gratefully.' }},
    ];
    const [spinning, setSpinning] = useState(false);
    const [preview, setPreview] = useState('');
    const [result, setResult] = useState<typeof SEGS[0] | null>(null);
    const spin = () => {
        if (spinning) return;
        setSpinning(true); setPreview(''); setResult(null);
        let count = 0; let final = SEGS[0];
        const iv = setInterval(() => {
            final = SEGS[Math.floor(Math.random() * SEGS.length)];
            setPreview(final.text); count++;
            if (count > 20) { clearInterval(iv); setSpinning(false); setPreview(''); setResult(final); }
        }, 120);
    };
    return (
        <div style={{ textAlign:'center' }}>
            <div style={{ width:120, height:120, margin:'12px auto 16px', borderRadius:'50%', border:`2px solid ${spinning ? `${G}0.5)` : `${R}0.2)`}`, display:'flex', alignItems:'center', justifyContent:'center', background: spinning ? `${G}0.06)` : `${R}0.04)`, animation: spinning ? 'vPulse 0.12s linear infinite' : 'none' }}>
                <span style={{ fontFamily:'Cinzel,serif', fontSize:'2.5rem', color: spinning ? `${G}0.6)` : `${R}0.3)` }}>◎</span>
            </div>
            {spinning && <div style={{ fontFamily:'Cinzel,serif', fontSize:'0.85rem', color:`${G}0.4)`, minHeight:24, marginBottom:12 }}>{preview}</div>}
            {result && <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:`${G}0.85)`, padding:'14px 18px', background:`${G}0.06)`, border:`1px solid ${G}0.2)`, borderRadius:8, marginBottom:16 }}>{result.text}</div>}
            {!result ? (
                <button onClick={spin} disabled={spinning} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>{spinning ? 'SPINNING...' : 'SPIN'}</button>
            ) : (
                <button onClick={() => onResult(result.text, result.fu)} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>CONTINUE</button>
            )}
        </div>
    );
}

function Coinflip({ headsText, tailsText, onResult }: { headsText: string; tailsText: string; onResult: (text: string, fu: FollowUp) => void }) {
    const [flipping, setFlipping] = useState(false);
    const [result, setResult] = useState<'heads'|'tails'|null>(null);
    const flip = () => {
        setFlipping(true); setResult(null);
        let count = 0;
        const iv = setInterval(() => {
            const v: 'heads'|'tails' = Math.random() > 0.5 ? 'heads' : 'tails';
            setResult(v); count++;
            if (count > 14) { clearInterval(iv); setFlipping(false); }
        }, 120);
    };
    const taskText = result === 'heads' ? headsText : tailsText;
    const inferFu = (t: string): FollowUp => {
        const l = t.toLowerCase();
        if (/photo|selfie|body writing|picture/.test(l)) return { type:'photo', prompt:t };
        if (/write|essay|lines|confession|journal/.test(l)) return { type:'writing', prompt:t };
        if (/shower|plank|hold|sit|pushup|endure|ice/.test(l)) return { type:'endurance', prompt:t, duration:60 };
        return { type:'ack', prompt:t };
    };
    return (
        <div style={{ textAlign:'center' }}>
            <div style={{ width:90, height:90, margin:'16px auto 20px', borderRadius:'50%', border:`2px solid ${result ? (result==='heads' ? `${G}0.5)` : `${R}0.4)`) : `${R}0.2)`}`, display:'flex', alignItems:'center', justifyContent:'center', background: result==='heads' ? `${G}0.08)` : result==='tails' ? `${R}0.06)` : `${R}0.04)`, animation: flipping ? 'vPulse 0.12s linear infinite' : 'none' }}>
                <span style={{ fontFamily:'Cinzel,serif', fontSize: result ? '0.85rem' : '1.5rem', color: result==='heads' ? `${G}0.9)` : result==='tails' ? `${R}0.8)` : `${R}0.3)`, letterSpacing:2, fontWeight:700 }}>{result ? result.toUpperCase() : '$'}</span>
            </div>
            {result && !flipping && <div style={{ fontFamily:'Cinzel,serif', fontSize:'0.95rem', color:'rgba(255,255,255,0.7)', lineHeight:1.6, margin:'0 0 20px', padding:'14px 18px', background: result==='heads' ? `${G}0.06)` : `${R}0.06)`, border:`1px solid ${result==='heads' ? `${G}0.15)` : `${R}0.15)`}`, borderRadius:8 }}>{taskText}</div>}
            {!result || flipping ? (
                <button onClick={flip} disabled={flipping} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>{flipping ? 'FLIPPING...' : 'FLIP COIN'}</button>
            ) : (
                <button onClick={() => onResult(taskText, inferFu(taskText))} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>CONTINUE</button>
            )}
        </div>
    );
}

function CardPick({ cards, onResult }: { cards: { text: string; fu: FollowUp }[]; onResult: (text: string, fu: FollowUp) => void }) {
    const [picked, setPicked] = useState<typeof cards[0] | null>(null);
    const [picking, setPicking] = useState(false);
    const pick = (card: typeof cards[0]) => { if (picking || picked) return; setPicking(true); setTimeout(() => { setPicked(card); setPicking(false); }, 300); };
    return (
        <div style={{ textAlign:'center' }}>
            {!picked ? (
                <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', margin:'16px 0 24px' }}>
                    {cards.map((c, i) => (
                        <button key={i} onClick={() => pick(c)} disabled={picking} style={{ width:64, height:90, borderRadius:8, border:`1px solid ${R}0.35)`, background: picking ? `${R}0.04)` : `${R}0.08)`, cursor:'pointer', fontSize:'1.5rem', color:`${R}0.6)`, transition:'all 0.2s' }}>♠</button>
                    ))}
                </div>
            ) : (
                <div style={{ margin:'16px 0 20px' }}>
                    <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.7rem', color:`${G}0.6)`, letterSpacing:3, marginBottom:10 }}>YOUR CARD</div>
                    <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:`${G}0.85)`, padding:'18px', background:`${G}0.06)`, border:`1px solid ${G}0.2)`, borderRadius:10, marginBottom:16 }}>{picked.text}</div>
                    <button onClick={() => onResult(picked.text, picked.fu)} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>CONTINUE</button>
                </div>
            )}
        </div>
    );
}

function DiceRoll({ outcomes, onResult }: { outcomes: { text: string; fu: FollowUp }[]; onResult: (text: string, fu: FollowUp) => void }) {
    const FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const [rolling, setRolling] = useState(false);
    const [result, setResult] = useState<number|null>(null);
    const roll = () => {
        setRolling(true); setResult(null);
        let count = 0; let final = 1;
        const iv = setInterval(() => {
            final = Math.floor(Math.random()*6)+1;
            setResult(final); count++;
            if (count > 15) { clearInterval(iv); setRolling(false); }
        }, 100);
    };
    const oc = result ? outcomes[result-1] : null;
    return (
        <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'5rem', margin:'0 0 16px', animation: rolling ? 'vPulse 0.1s linear infinite' : 'none' }}>{result ? FACES[result-1] : '⚄'}</div>
            {result && !rolling && oc && <div style={{ fontFamily:'Cinzel,serif', fontSize:'0.95rem', color:`${G}0.8)`, padding:'14px 18px', background:`${G}0.06)`, border:`1px solid ${G}0.2)`, borderRadius:8, marginBottom:16 }}>{oc.text}</div>}
            {!result || rolling ? (
                <button onClick={roll} disabled={rolling} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>{rolling ? 'ROLLING...' : 'ROLL DICE'}</button>
            ) : oc ? (
                <button onClick={() => onResult(oc.text, oc.fu)} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>CONTINUE</button>
            ) : null}
        </div>
    );
}

function Roulette({ penalty, onResult }: { penalty: string; onResult: (text: string, fu: FollowUp) => void }) {
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<'safe'|'hit'|null>(null);
    const [hitIdx, setHitIdx] = useState(0);
    const pull = () => {
        setSpinning(true); setResult(null);
        setTimeout(() => {
            const hit = Math.random() < 1/6;
            if (hit) { setHitIdx(Math.floor(Math.random()*6)); setResult('hit'); } else { setResult('safe'); }
            setSpinning(false);
        }, 1200);
    };
    return (
        <div style={{ textAlign:'center' }}>
            <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:24 }}>
                {Array.from({length:6}).map((_,i) => (
                    <div key={i} style={{ width:32, height:32, borderRadius:'50%', border:`1.5px solid ${result==='hit' && i===hitIdx ? `${R}0.8)` : `${G}0.25)`}`, background: result==='hit' && i===hitIdx ? `${R}0.15)` : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.3s' }}>
                        {result==='hit' && i===hitIdx && <div style={{ width:10, height:10, borderRadius:'50%', background:`${R}0.7)` }} />}
                    </div>
                ))}
            </div>
            {result === 'safe' && <div style={{ fontFamily:'Cinzel,serif', fontSize:'1.1rem', color:'rgba(80,200,120,0.8)', letterSpacing:3, marginBottom:16 }}>YOU SURVIVED — This time.</div>}
            {result === 'hit' && <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', color:`${R}0.9)`, letterSpacing:4, padding:'20px', background:`${R}0.06)`, border:`1px solid ${R}0.25)`, borderRadius:10, marginBottom:16 }}>PUNISHED — {penalty}</div>}
            {!result ? (
                <button onClick={pull} disabled={spinning} style={{ ...GOLD, background:`${R}0.5)`, color:'#fff' }}>{spinning ? 'PULLING...' : 'PULL THE TRIGGER'}</button>
            ) : result === 'safe' ? (
                <button onClick={() => onResult('Survived', { type:'ack', prompt:'You survived. The chamber was empty. This time.' })} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>CONTINUE</button>
            ) : (
                <button onClick={() => onResult(penalty, { type:'endurance', prompt:penalty, duration:120 })} style={{ ...GOLD, background:`${R}0.5)`, color:'#fff', width:'auto', padding:'14px 44px' }}>FACE PUNISHMENT</button>
            )}
        </div>
    );
}

function Quiz({ questions, onResult }: { questions: { question: string; answers: string[]; correctIdx: number }[]; onResult: (text: string, fu: FollowUp) => void }) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<number[]>([]);
    const [reveal, setReveal] = useState<number|null>(null);
    const [done, setDone] = useState(false);
    const q = questions[step];
    const pick = (ai: number) => {
        if (reveal !== null) return;
        setReveal(ai);
        setTimeout(() => {
            setReveal(null);
            const na = [...answers, ai];
            setAnswers(na);
            if (na.length < questions.length) setStep(s => s+1);
            else setDone(true);
        }, 1500);
    };
    if (done) {
        const correct = answers.filter((a,i) => a === questions[i].correctIdx).length;
        const total = questions.length;
        const c = correct === total ? 'rgba(80,200,120,0.85)' : correct === 0 ? `${R}0.8)` : `${G}0.8)`;
        return (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'1.8rem', color:c, letterSpacing:6, marginBottom:6 }}>{correct}/{total}</div>
                <div style={{ fontFamily:'Cinzel,serif', fontSize:'0.8rem', color:'rgba(255,255,255,0.35)', marginBottom:20 }}>{correct===total ? 'Perfect score. −1 day.' : correct===0 ? 'Every answer wrong. +3 days.' : 'Partial score.'}</div>
                <button onClick={() => onResult(`${correct}/${total}`, { type:'ack', prompt:`You scored ${correct} out of ${total}.` })} style={{ ...GOLD, width:'auto', padding:'14px 44px' }}>CONTINUE</button>
            </div>
        );
    }
    return (
        <div>
            <div style={DESC}>{q.question}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {q.answers.map((a, i) => {
                    const isSelected = reveal === i;
                    const isCorrect = i === q.correctIdx;
                    const showResult = reveal !== null;
                    return (
                        <button key={i} onClick={() => pick(i)} style={{ padding:'14px 18px', fontFamily:'Cinzel,serif', fontSize:'0.85rem', color: showResult ? (isCorrect ? 'rgba(80,200,120,0.9)' : isSelected && !isCorrect ? `${R}0.7)` : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.7)', background: showResult ? (isCorrect ? 'rgba(80,200,120,0.1)' : isSelected ? `${R}0.06)` : 'transparent') : 'rgba(255,255,255,0.03)', border:`1px solid ${showResult ? (isCorrect ? 'rgba(80,200,120,0.4)' : isSelected ? `${R}0.3)` : 'rgba(255,255,255,0.05)') : 'rgba(255,255,255,0.08)'}`, borderRadius:8, cursor: reveal !== null ? 'default' : 'pointer', textAlign:'left', transition:'all 0.3s' }}>{a}</button>
                    );
                })}
            </div>
        </div>
    );
}

function WritingTask({ prompt, minWords, onDone, onSkip }: { prompt: string; minWords: number; onDone: () => void; onSkip: () => void }) {
    const [val, setVal] = useState('');
    const [sent, setSent] = useState(false);
    const wc = val.split(/\s+/).filter(Boolean).length;
    const ok = wc >= minWords;
    if (sent) return <div style={{ textAlign:'center', padding:'16px 0' }}><div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', color:`${G}0.6)`, letterSpacing:'3px' }}>⏳ AWAITING REVIEW</div></div>;
    return (
        <div>
            <div style={DESC}>{prompt}</div>
            <textarea value={val} onChange={e => setVal(e.target.value)} placeholder="Write here..." style={{ width:'100%', minHeight:120, background:'rgba(255,255,255,0.03)', border:`1px solid ${G}0.12)`, borderRadius:10, padding:16, color:'rgba(255,255,255,0.6)', fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'16px', lineHeight:1.7, resize:'vertical', outline:'none', boxSizing:'border-box' }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.85rem', color: ok ? `${G}0.6)` : 'rgba(255,255,255,0.4)' }}>{wc} / {minWords} words</span>
                <button onClick={() => setSent(true)} disabled={!ok} style={{ ...GOLD, width:'auto', padding:'12px 28px', opacity: ok ? 1 : 0.3 }}>SUBMIT</button>
            </div>
            <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>
        </div>
    );
}

function PhotoTask({ prompt, onSkip }: { prompt: string; onSkip: () => void }) {
    const [sent, setSent] = useState(false);
    if (sent) return <div style={{ textAlign:'center', padding:'16px 0' }}><div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', color:`${G}0.6)`, letterSpacing:'3px' }}>⏳ AWAITING REVIEW</div></div>;
    return (
        <div>
            <div style={DESC}>{prompt}</div>
            <div onClick={() => setSent(true)} style={UPLOAD}><UploadIcon /> UPLOAD PROOF</div>
            <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>
        </div>
    );
}

function EnduranceTask({ prompt, duration, onSkip }: { prompt: string; duration: number; onSkip: () => void }) {
    const [left, setLeft] = useState(duration);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const ref = useRef<any>(null);
    const start = () => { setRunning(true); ref.current = setInterval(() => setLeft(s => { if (s<=1){clearInterval(ref.current);setRunning(false);setDone(true);return 0;} return s-1; }),1000); };
    return (
        <div>
            <div style={DESC}>{prompt}</div>
            <div style={{ height:3, background:'rgba(255,255,255,0.04)', borderRadius:2, overflow:'hidden', marginBottom:16 }}>
                <div style={{ height:'100%', width:`${(left/duration)*100}%`, background: left<=duration*0.2 ? `${R}0.7)` : `${G}0.55)`, borderRadius:2, transition:'width 0.9s linear' }} />
            </div>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'3rem', color:`${G}0.85)`, letterSpacing:4, textAlign:'center', marginBottom:20 }}>{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</div>
            {left>0 && !running && <button onClick={start} style={GOLD}>START TIMER</button>}
            {running && <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.25)', letterSpacing:4, textAlign:'center' }}>HOLD POSITION...</div>}
            {done && <div style={UPLOAD}><UploadIcon /> UPLOAD PROOF</div>}
            {!done && <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>}
        </div>
    );
}

function GreedGame({ maxCoins, onResult }: { maxCoins: number; onResult: (coins: number, busted: boolean) => void }) {
    const [coins, setCoins] = useState(0);
    const [busted, setBusted] = useState(false);
    const [cashedOut, setCashedOut] = useState(false);
    const [pushing, setPushing] = useState(false);
    const push = () => {
        if (pushing || coins >= maxCoins) return;
        setPushing(true);
        setTimeout(() => {
            const bust = Math.random() < 0.15 + (coins/maxCoins)*0.25;
            if (bust) { setBusted(true); onResult(0, true); } else { setCoins(c => Math.min(c+10, maxCoins)); }
            setPushing(false);
        }, 600);
    };
    if (busted) return <div style={{ textAlign:'center' }}><div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'1rem', color:`${R}0.9)`, letterSpacing:4, marginBottom:8 }}>BUSTED</div><div style={{ fontFamily:'Cinzel,serif', fontSize:'0.9rem', color:`${R}0.5)` }}>Greed consumed you. You walk away with nothing.</div></div>;
    if (cashedOut) return <div style={{ textAlign:'center' }}><div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'1rem', color:'rgba(80,200,120,0.8)', letterSpacing:4, marginBottom:8 }}>CASHED OUT: {coins} COINS</div></div>;
    return (
        <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'3rem', color:`${G}0.9)`, margin:'12px 0 8px' }}>{coins}</div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.8rem', color:'rgba(255,255,255,0.25)', letterSpacing:2, marginBottom:24 }}>COINS STACKED / MAX {maxCoins}</div>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                <button onClick={push} disabled={pushing || coins >= maxCoins} style={{ ...GOLD, width:'auto', padding:'16px 32px', opacity: pushing ? 0.6 : 1 }}>{pushing ? '...' : 'PUSH'}</button>
                <button onClick={() => { setCashedOut(true); onResult(coins, false); }} disabled={coins === 0} style={{ padding:'16px 32px', fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', letterSpacing:'3px', color: coins>0 ? 'rgba(80,200,120,0.8)' : 'rgba(255,255,255,0.1)', background: coins>0 ? 'rgba(80,200,120,0.04)' : 'transparent', border:`1px solid ${coins>0 ? 'rgba(80,200,120,0.2)' : 'rgba(255,255,255,0.04)'}`, borderRadius:8, cursor: coins>0 ? 'pointer' : 'default' }}>CASH OUT</button>
            </div>
        </div>
    );
}

function TruthDare({ onChoice }: { onChoice: (choice: 'truth'|'dare', text: string, fu: FollowUp) => void }) {
    const [chose, setChose] = useState<'truth'|'dare'|null>(null);
    const TRUTH = 'Confess your deepest weakness to Queen Karin — at least 150 words';
    const DARE = 'Take a cold shower for 60 seconds — upload photo proof';
    if (!chose) return (
        <div>
            <div style={DESC}>Choose truth or dare. Both will test you.</div>
            <div style={{ display:'flex', gap:16 }}>
                <button onClick={() => { setChose('truth'); onChoice('truth', TRUTH, { type:'writing', prompt:TRUTH }); }} style={{ flex:1, padding:'20px 16px', fontFamily:'Orbitron,sans-serif', fontSize:'0.9rem', letterSpacing:'3px', color:`${G}0.8)`, background:`${G}0.04)`, border:`1px solid ${G}0.2)`, borderRadius:8, cursor:'pointer' }}>TRUTH</button>
                <button onClick={() => { setChose('dare'); onChoice('dare', DARE, { type:'endurance', prompt:DARE, duration:60 }); }} style={{ flex:1, padding:'20px 16px', fontFamily:'Orbitron,sans-serif', fontSize:'0.9rem', letterSpacing:'3px', color:`${R}0.8)`, background:`${R}0.04)`, border:`1px solid ${R}0.2)`, borderRadius:8, cursor:'pointer' }}>DARE</button>
            </div>
        </div>
    );
    const text = chose === 'truth' ? TRUTH : DARE;
    return (
        <div>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.85rem', color: chose==='truth' ? `${G}0.6)` : `${R}0.6)`, letterSpacing:3, marginBottom:10 }}>{chose.toUpperCase()}</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'0.95rem', color:'rgba(255,255,255,0.7)', lineHeight:1.6, padding:'14px 18px', background: chose==='truth' ? `${G}0.06)` : `${R}0.06)`, border:`1px solid ${chose==='truth' ? `${G}0.15)` : `${R}0.15)`}`, borderRadius:8 }}>{text}</div>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.65rem', color:'rgba(255,255,255,0.2)', letterSpacing:4, textAlign:'center', marginTop:12 }}>YOUR FATE IS SEALED</div>
        </div>
    );
}

function SimonSays({ tasks: chainTasks }: { tasks: { text: string; timeLimit: number; proofType?: string }[] }) {
    const [phase, setPhase] = useState<'idle'|'waiting'|'task'|'complete'>('idle');
    const [step, setStep] = useState(0);
    const [secs, setSecs] = useState(0);
    const [limit, setLimit] = useState(0);
    const [waitSecs, setWaitSecs] = useState(0);
    const waitRef = useRef<any>(null);
    const taskRef = useRef<any>(null);
    const [proofSent, setProofSent] = useState(false);

    const startWaiting = () => {
        setPhase('waiting');
        const wait = Math.floor(Math.random()*30)+10;
        setWaitSecs(wait);
        waitRef.current = setInterval(() => setWaitSecs(s => {
            if (s <= 1) { clearInterval(waitRef.current); activateTask(); return 0; }
            return s-1;
        }), 1000);
    };

    const activateTask = () => {
        const t = chainTasks[step];
        if (!t) { setPhase('complete'); return; }
        setPhase('task'); setSecs(t.timeLimit); setLimit(t.timeLimit); setProofSent(false);
        taskRef.current = setInterval(() => setSecs(s => {
            if (s <= 1) { clearInterval(taskRef.current); return 0; }
            return s-1;
        }), 1000);
    };

    const nextTask = () => {
        clearInterval(taskRef.current);
        const nextStep = step + 1;
        setStep(nextStep);
        if (nextStep >= chainTasks.length) { setPhase('complete'); return; }
        if (nextStep < chainTasks.length - 1) { startWaiting(); } else { activateTask(); }
    };

    if (chainTasks.length === 0) return (
        <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.5rem', color:`${G}0.45)`, letterSpacing:'7px', marginBottom:22 }}>⚡ SIMON SAYS</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1.05rem', color:'rgba(255,255,255,0.65)', marginBottom:28 }}>No commands configured. Mark complete.</div>
            <button onClick={() => setPhase('complete')} style={GOLD}>MARK COMPLETE</button>
        </div>
    );

    if (phase === 'idle') return (
        <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.5rem', color:`${G}0.45)`, letterSpacing:'7px', marginBottom:22 }}>⚡ SIMON SAYS</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1.05rem', color:'rgba(255,255,255,0.65)', lineHeight:1.75, marginBottom:12 }}>{chainTasks.length} commands are waiting.</div>
            <div style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'0.78rem', color:'rgba(255,255,255,0.28)', lineHeight:1.8, marginBottom:28 }}>Tasks will arrive at random. You will not be warned. When one appears — you obey immediately.</div>
            <button onClick={startWaiting} style={GOLD}>START THE GAME</button>
        </div>
    );

    if (phase === 'waiting') return (
        <div style={{ textAlign:'center', padding:'36px 10px 24px' }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.45rem', color:`${G}0.3)`, letterSpacing:'8px', marginBottom:32 }}>SIMON IS WATCHING</div>
            <div style={{ width:18, height:18, borderRadius:'50%', background:`${R}0.75)`, margin:'0 auto 32px', boxShadow:`0 0 16px ${R}0.3)` }} />
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1.7rem', color:'rgba(255,255,255,0.5)', letterSpacing:'8px', marginBottom:8 }}>Stand by.</div>
            <div style={{ fontFamily:'Orbitron,monospace', fontSize:'2rem', color:`${G}0.4)`, letterSpacing:4 }}>{Math.floor(waitSecs/60)}:{String(waitSecs%60).padStart(2,'0')}</div>
            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.7rem', color:'rgba(255,255,255,0.2)', letterSpacing:3, marginTop:8 }}>TASK {step+1} OF {chainTasks.length}</div>
        </div>
    );

    if (phase === 'task') {
        const t = chainTasks[step];
        return (
            <div>
                <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.55rem', color:`${R}0.6)`, letterSpacing:'7px', marginBottom:14, textAlign:'center' }}>⚡ SIMON SAYS</div>
                <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:'rgba(255,255,255,0.88)', lineHeight:1.75, marginBottom:18, padding:'18px 16px', background:`${R}0.06)`, border:`1px solid ${R}0.2)`, borderRadius:10, textAlign:'center' }}>{t.text}</div>
                <div style={{ height:3, background:'rgba(255,255,255,0.04)', borderRadius:2, overflow:'hidden', marginBottom:18 }}>
                    <div style={{ height:'100%', width:`${(secs/limit)*100}%`, background: secs <= limit*0.2 ? `${R}0.7)` : `${G}0.55)`, borderRadius:2, transition:'width 0.9s linear' }} />
                </div>
                <div style={{ fontFamily:'Orbitron,monospace', fontSize:'2rem', color:`${G}0.7)`, letterSpacing:4, textAlign:'center', marginBottom:16 }}>{Math.floor(secs/60)}:{String(secs%60).padStart(2,'0')}</div>
                {!proofSent ? (
                    <div onClick={() => { setProofSent(true); clearInterval(taskRef.current); }} style={UPLOAD}><UploadIcon /> UPLOAD {t.proofType==='video' ? 'VIDEO' : 'PHOTO'} PROOF</div>
                ) : (
                    <button onClick={nextTask} style={{ ...GOLD, marginTop:12 }}>NEXT COMMAND</button>
                )}
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.45rem', color:'rgba(255,255,255,0.1)', letterSpacing:'4px', textAlign:'center', marginTop:10 }}>TASK {step+1} / {chainTasks.length}</div>
            </div>
        );
    }

    return (
        <div style={{ textAlign:'center', padding:'24px 10px 16px' }}>
            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.48rem', color:'rgba(80,200,120,0.45)', letterSpacing:'8px', marginBottom:24 }}>ALL TASKS COMPLETE</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:'1.2rem', color:'rgba(255,255,255,0.6)', lineHeight:1.6, marginBottom:14 }}>Good boy.</div>
            <div style={{ fontFamily:'Plus Jakarta Sans,sans-serif', fontSize:'0.78rem', color:'rgba(255,255,255,0.22)', lineHeight:1.75, marginBottom:28 }}>You have proven yourself today. You may rest.</div>
            <button style={{ ...GOLD, background:'transparent', color:'rgba(80,200,120,0.7)', border:'1px solid rgba(80,200,120,0.2)' }}>DONE</button>
        </div>
    );
}

/* ─── Default configs per mechanism ─── */
const DEFAULTS: Record<string, any> = {
    spin_wheel: null,
    coinflip: { headsText: '+20 coins — Queen shows mercy', tailsText: 'Write 30 lines: "I will obey without question"' },
    card_pick: { cards: [{ text:'Write a worship message (100 words)', fu:{ type:'writing', prompt:'Write a worship message to your Queen. At least 100 words.' }}, { text:'Gratitude list — 5 items', fu:{ type:'writing', prompt:'List 5 things you are grateful for about your Queen.' }}, { text:'Devotion photo', fu:{ type:'photo', prompt:'Photo showing your devotion pose.' }}, { text:'Tribute 5 coins', fu:{ type:'ack', prompt:'Tribute 5 coins to your Queen.' }}, { text:'1 min plank on camera', fu:{ type:'endurance', prompt:'Plank for 1 full minute. Camera on.', duration:60 }}]},
    dice_roll: { outcomes: [{ text:'Write 40 lines: "I exist to serve"', fu:{ type:'writing', prompt:'Write 40 lines: "I exist to serve."' }}, { text:'Cold shower 30s', fu:{ type:'endurance', prompt:'Cold shower 30 seconds.', duration:30 }}, { text:'20 pushups on camera', fu:{ type:'photo', prompt:'20 pushups on camera — upload video proof' }}, { text:'Body writing: OBEY', fu:{ type:'photo', prompt:'Write OBEY on your wrist and photograph it' }}, { text:'Gratitude essay (100 words)', fu:{ type:'writing', prompt:'Why are you grateful for discipline? 100 words minimum.' }}, { text:'2 min wall sit on camera', fu:{ type:'endurance', prompt:'2 min wall sit — camera on', duration:120 }}]},
    russian_roulette: { penalty: 'Cold shower 2 min + 50 lines' },
    quiz: { questions: [{ question:'What is the first thing you must do each morning?', answers:['Check phone','Complete your kneeling','Send a message','Wait for instructions'], correctIdx:1 }]},
    writing: { prompt:'Write about why you chose to submit. What brought you here? What do you hope to become? Be honest and vulnerable.', minWords:100 },
    photo_proof: { prompt:'Take a photo on your knees, head bowed. Your first act of visible submission.' },
    endurance: { prompt:'Hold plank position for the full duration. Proper form. Camera shows full body.', duration:60 },
    greed_game: { maxCoins:50 },
    truth_dare: null,
    simon_says: { tasks:[{ text:'Drop and do 10 pushups — NOW', timeLimit:30, proofType:'photo' },{ text:'Write OWNED on your wrist, photograph it', timeLimit:60, proofType:'photo' }]},
    lines: { prompt:'Write 30 lines: "I will obey without question"', minWords:30 },
    corner_time: { prompt:'Stand in the corner for 5 minutes. No phone. No distractions. Report when done.', duration:300 },
    cold_shower: { prompt:'Cold shower for 60 seconds. Camera on, do not stop.', duration:60 },
    body_writing: { prompt:'Write OWNED on your wrist. Clear photograph showing the word.' },
    exercise: { prompt:'20 pushups on camera — upload video proof' },
    edge: { prompt:'Edge once. Do not release. Report when done.' },
};

/* ─── Main page ─── */
export default function PreviewTasks() {
    const [mechId, setMechId] = useState('spin_wheel');
    const [followUp, setFollowUp] = useState<FollowUp|null>(null);
    const [skipOpen, setSkipOpen] = useState(false);
    const [skipped, setSkipped] = useState(false);
    const [coins] = useState(1200);
    const [passes] = useState(2);
    const [key, setKey] = useState(0); // increment to reset mechanism

    const mech = MECHS.find(m => m.id === mechId)!;
    const cfg = DEFAULTS[mechId] || {};

    const switchMech = (id: string) => { setMechId(id); setFollowUp(null); setSkipOpen(false); setSkipped(false); setKey(k => k+1); };
    const onFuDone = () => { setFollowUp(null); setSkipped(false); setKey(k => k+1); };
    const onSkip = () => setSkipOpen(true);
    const doSkip = () => { setSkipOpen(false); setSkipped(true); setFollowUp(null); };

    const TASKS = MECHS.map(m => ({ done: m.id === mechId && skipped, current: m.id === mechId && !skipped }));
    const doneCount = TASKS.filter(t => t.done).length;

    const renderMech = useCallback(() => {
        if (skipped) return <div style={{ textAlign:'center', padding:'16px 0' }}><div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.8rem', color:`${G}0.6)`, letterSpacing:'3px' }}>TASK SKIPPED</div></div>;
        switch (mechId) {
            case 'spin_wheel': return <SpinWheel key={key} onResult={(_, fu) => setFollowUp(fu)} />;
            case 'coinflip': return <Coinflip key={key} headsText={cfg.headsText} tailsText={cfg.tailsText} onResult={(_, fu) => setFollowUp(fu)} />;
            case 'card_pick': return <CardPick key={key} cards={cfg.cards} onResult={(_, fu) => setFollowUp(fu)} />;
            case 'dice_roll': return <DiceRoll key={key} outcomes={cfg.outcomes} onResult={(_, fu) => setFollowUp(fu)} />;
            case 'russian_roulette': return <Roulette key={key} penalty={cfg.penalty} onResult={(_, fu) => setFollowUp(fu)} />;
            case 'quiz': return <Quiz key={key} questions={cfg.questions} onResult={(_, fu) => setFollowUp(fu)} />;
            case 'writing': case 'lines': return <WritingTask key={key} prompt={cfg.prompt} minWords={cfg.minWords || 50} onDone={onFuDone} onSkip={onSkip} />;
            case 'photo_proof': case 'body_writing': case 'exercise': return <PhotoTask key={key} prompt={cfg.prompt} onSkip={onSkip} />;
            case 'endurance': case 'cold_shower': case 'corner_time': return <EnduranceTask key={key} prompt={cfg.prompt} duration={cfg.duration} onSkip={onSkip} />;
            case 'greed_game': return <GreedGame key={key} maxCoins={cfg.maxCoins} onResult={(c, b) => setFollowUp({ type:'ack', prompt: b ? 'You busted. Walk away with nothing.' : `You cashed out ${c} coins.` })} />;
            case 'truth_dare': return <TruthDare key={key} onChoice={(_, __, fu) => setFollowUp(fu)} />;
            case 'simon_says': return <SimonSays key={key} tasks={cfg.tasks || []} />;
            case 'edge': case 'denial': return (
                <div>
                    <div style={DESC}>{cfg.prompt}</div>
                    <button onClick={onFuDone} style={GOLD}>MARK COMPLETE</button>
                    <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}><button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button></div>
                </div>
            );
            default: return <div style={DESC}>{cfg.prompt || mech.desc}</div>;
        }
    }, [mechId, cfg, key, skipped]);

    const renderFollowUp = () => {
        if (!followUp) return null;
        switch (followUp.type) {
            case 'writing': return <FuWriting prompt={followUp.prompt} onDone={onFuDone} onSkip={onSkip} />;
            case 'photo': return <FuPhoto instruction={followUp.prompt} onDone={onFuDone} onSkip={onSkip} />;
            case 'endurance': return <FuEndurance instruction={followUp.prompt} duration={followUp.duration || 60} onDone={onFuDone} onSkip={onSkip} />;
            case 'ack': return <FuAcknowledge text={followUp.prompt} onDone={onFuDone} />;
        }
    };

    return (
        <div style={{ minHeight:'100dvh', background:'#05050a', color:'#fff' }}>
            {/* Mechanism tabs */}
            <div style={{ background:'#0a0a12', borderBottom:`1px solid ${G}0.15)`, padding:'10px 16px 0', position:'sticky', top:0, zIndex:100 }}>
                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.35rem', color:`${G}0.4)`, letterSpacing:'5px', marginBottom:8 }}>MECHANISM PREVIEW — /preview-tasks</div>
                <div style={{ display:'flex', gap:0, overflowX:'auto', scrollbarWidth:'none' }}>
                    {MECHS.map(m => (
                        <button key={m.id} onClick={() => switchMech(m.id)} style={{ padding:'6px 12px 10px', fontFamily:'Orbitron,sans-serif', fontSize:'0.35rem', letterSpacing:'1px', color: mechId===m.id ? `${G}0.95)` : 'rgba(255,255,255,0.25)', background:'transparent', border:'none', borderBottom:`2px solid ${mechId===m.id ? `${G}0.7)` : 'transparent'}`, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                            {m.icon} {m.name.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Phone frame */}
            <div style={{ padding:'24px 16px 48px', display:'flex', justifyContent:'center' }}>
                <div style={{ position:'relative', width:'100%', maxWidth:390, background:BG, minHeight:700, borderRadius:20, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.8)' }}>

                    {/* Header */}
                    <div style={{ padding:'16px 20px', borderBottom:`1px solid ${G}0.12)`, display:'flex', justifyContent:'space-between', alignItems:'center', background:`${G}0.03)` }}>
                        <div>
                            <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.45rem', color:`${G}0.55)`, letterSpacing:'6px', marginBottom:3 }}>TODAY'S</div>
                            <div style={{ fontFamily:'Cinzel,serif', fontSize:'0.9rem', color:'rgba(255,255,255,0.75)', letterSpacing:'3px' }}>ORDERS</div>
                        </div>
                        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.65rem', color:'rgba(255,255,255,0.2)', letterSpacing:1 }}>✕</div>
                    </div>

                    {/* Day hero + task circles */}
                    <div style={{ padding:'20px 20px 16px', borderBottom:`1px solid ${G}0.1)` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                            <div style={{ flexShrink:0 }}>
                                <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.45rem', color:`${G}0.55)`, letterSpacing:'6px', marginBottom:2 }}>DAY</div>
                                <div style={{ fontFamily:'Cinzel,serif', fontSize:'4rem', color:'rgba(255,255,255,0.95)', fontWeight:700, lineHeight:0.85, letterSpacing:'-2px' }}>7</div>
                            </div>
                            <div style={{ display:'flex', gap:6, flex:1, overflowX:'auto', scrollbarWidth:'none' }}>
                                {MECHS.slice(0,5).map((m, i) => {
                                    const isActive = m.id === mechId && !skipped;
                                    const isDone = m.id === mechId && skipped;
                                    return (
                                        <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:'0 0 44px' }}>
                                            <div style={{ fontFamily:'Orbitron,monospace', fontSize:'0.38rem', color: isDone ? 'rgba(80,200,120,0.5)' : isActive ? `${G}0.6)` : 'rgba(255,255,255,0.2)', letterSpacing:'1px' }}>{String(i+1).padStart(2,'0')}</div>
                                            <div style={{ width:36, height:36, borderRadius:'50%', border:`1.5px solid ${isDone ? 'rgba(80,200,120,0.4)' : isActive ? `${G}0.6)` : 'rgba(255,255,255,0.1)'}`, background: isDone ? 'rgba(80,200,120,0.09)' : isActive ? `${G}0.12)` : 'rgba(255,255,255,0.03)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow: isActive ? `0 0 12px ${G}0.3)` : 'none' }}>
                                                {isDone && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(80,200,120,0.8)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                                                {isActive && <svg viewBox="0 0 24 24" width="9" height="9" fill={`${G}0.95)`}><circle cx="12" cy="12" r="6"/></svg>}
                                                {!isDone && !isActive && <svg viewBox="0 0 24 24" width="7" height="7" fill="rgba(255,255,255,0.15)"><circle cx="12" cy="12" r="5"/></svg>}
                                            </div>
                                            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.48rem', color: isDone ? 'rgba(255,255,255,0.2)' : isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', textAlign:'center', lineHeight:1.2 }}>{m.name.split(' ')[0]}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:14 }}>
                            <div style={{ height:1, width:20, background:`${G}0.35)` }} />
                            <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'0.65rem', letterSpacing:'4px', color:'rgba(255,255,255,0.25)' }}>{doneCount} OF {MECHS.length} COMPLETE</div>
                        </div>
                    </div>

                    {/* Task card */}
                    <div style={{ overflowY:'auto', maxHeight:600 }}>
                        <div style={{ margin:'20px 16px 120px' }}>
                            <div style={{ height:2, background:`linear-gradient(90deg, ${G}0.85) 0%, ${G}0.05) 100%)`, borderRadius:'2px 2px 0 0' }} />
                            <div style={{ border:`1px solid ${G}0.35)`, borderTop:'none', borderRadius:'0 0 14px 14px', overflow:'hidden' }}>
                                <div style={{ padding:'18px 20px 16px', background:`${G}0.05)`, borderBottom:`1px solid ${G}0.1)`, display:'flex', alignItems:'center', gap:14 }}>
                                    <div style={{ width:36, height:36, borderRadius:9, border:`1px solid ${G}0.3)`, display:'flex', alignItems:'center', justifyContent:'center', background:`${G}0.07)`, flexShrink:0 }}>
                                        <span style={{ fontSize:'0.95rem', color:`${G}0.85)` }}>{mech.icon}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontFamily:'Orbitron,sans-serif', fontSize:'0.42rem', color:`${G}0.5)`, letterSpacing:'5px', marginBottom:4 }}>NOW</div>
                                        <div style={{ fontFamily:'Cinzel,serif', fontSize:'1rem', color:'rgba(255,255,255,0.92)', letterSpacing:'1px' }}>{mech.name}</div>
                                    </div>
                                </div>
                                <div style={{ padding:'22px 20px 24px', background:'rgba(15,12,25,0.6)' }}>
                                    {renderMech()}
                                    {/* Skip button for interactive mechanics */}
                                    {['spin_wheel','coinflip','card_pick','dice_roll','russian_roulette','quiz','greed_game','truth_dare','simon_says'].includes(mechId) && !followUp && !skipped && (
                                        <div style={{ marginTop:20, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                                            <button onClick={onSkip} style={GHOST}>SKIP THIS TASK</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Follow-up overlay */}
                    {followUp && (
                        <div style={{ position:'absolute', inset:0, zIndex:50, background:BG, display:'flex', flexDirection:'column', overflow:'auto' }}>
                            {renderFollowUp()}
                        </div>
                    )}

                    {/* Skip overlay */}
                    {skipOpen && (
                        <SkipOverlay coins={coins} passes={passes} onCoin={doSkip} onPass={doSkip} onCancel={() => setSkipOpen(false)} />
                    )}
                </div>
            </div>

            <style>{`@keyframes vPulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
        </div>
    );
}
