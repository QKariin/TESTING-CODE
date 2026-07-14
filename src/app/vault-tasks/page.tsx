'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const R = 'rgba(160,16,32,';
const G = 'rgba(197,160,89,';

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const cardS: React.CSSProperties = { background: 'rgba(12,10,14,0.95)', border: `1px solid ${R}0.18)`, borderRadius: 14, overflow: 'hidden' };
const btnS: React.CSSProperties = { padding: '14px 28px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', letterSpacing: '3px', color: `${R}0.6)`, background: `${R}0.05)`, border: `1px solid ${R}0.2)`, borderRadius: 8, cursor: 'pointer', width: '100%', WebkitTapHighlightColor: 'transparent' };
const btnSmall: React.CSSProperties = { padding: '6px 14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', letterSpacing: '1px', color: 'rgba(255,255,255,0.3)', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer' };

// ═══════════════════════════════════════════
// FOLLOW-UP: after a reveal (wheel/card/dice/coinflip), spawn the real mechanism
// ═══════════════════════════════════════════
type FollowUp =
    | { type: 'instant' }  // coins, days — no action needed
    | { type: 'writing'; prompt: string; minWords?: number }
    | { type: 'photo'; instruction: string }
    | { type: 'video'; target: number; instruction: string }
    | { type: 'endurance'; duration: number; instruction: string }
    | { type: 'timer'; instruction: string };

function FollowUpTask({ followUp, resultText, onDone }: { followUp: FollowUp; resultText: string; onDone: () => void }) {
    const [photoFile, setPhotoFile] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [videoFiles, setVideoFiles] = useState<string[]>([]);
    const [recording, setRecording] = useState(false);
    const [timerStarted, setTimerStarted] = useState(false);
    const [timerLeft, setTimerLeft] = useState(0);
    const [enduranceFile, setEnduranceFile] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);

    if (followUp.type === 'instant') { onDone(); return null; }

    const revealBar = (
        <div style={{ padding: '10px 18px', background: `${G}0.04)`, borderBottom: `1px solid ${G}0.1)`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: `${G}0.6)`, letterSpacing: '1px' }}>LANDED ON:</span>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{resultText}</span>
        </div>
    );

    // Open camera stream for live preview
    const openCamera = async (mode: 'photo' | 'video') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: mode === 'video',
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (e) {
            console.error('Camera access denied', e);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        setPhotoFile(canvas.toDataURL('image/jpeg'));
        stopCamera();
    };

    const startRecording = () => {
        if (!streamRef.current) return;
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(streamRef.current);
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            setVideoFiles(prev => [...prev, URL.createObjectURL(blob)]);
            setRecording(false);
            stopCamera();
        };
        recorderRef.current = recorder;
        recorder.start();
        setRecording(true);
    };

    const stopRecording = () => {
        recorderRef.current?.stop();
    };

    // Camera preview element
    const cameraPreview = (
        <div style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', borderRadius: 10 }} />
        </div>
    );

    if (followUp.type === 'writing') {
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const min = followUp.minWords || 50;
        return (
            <div>
                {revealBar}
                <div style={{ padding: '16px 18px' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.6 }}>{followUp.prompt}</div>
                    <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Start writing..." rows={5}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${R}0.12)`, borderRadius: 8, padding: '12px 14px', color: 'rgba(255,255,255,0.7)', fontFamily: 'Rajdhani, sans-serif', fontSize: '0.9rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: words >= min ? 'rgba(80,200,120,0.6)' : 'rgba(255,255,255,0.25)', letterSpacing: '2px' }}>{words}/{min} WORDS</span>
                        <button onClick={onDone} disabled={words < min} style={{ ...btnS, width: 'auto', padding: '10px 24px', opacity: words >= min ? 1 : 0.3 }}>SUBMIT</button>
                    </div>
                </div>
            </div>
        );
    }

    if (followUp.type === 'photo') {
        return (
            <div>
                {revealBar}
                <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.6 }}>{followUp.instruction}</div>
                    {!photoFile && !streamRef.current ? (
                        <button onClick={() => openCamera('photo')} style={btnS}>OPEN CAMERA</button>
                    ) : !photoFile ? (
                        <>
                            {cameraPreview}
                            <button onClick={capturePhoto} style={{ ...btnS, background: `${R}0.08)`, borderColor: `${R}0.3)` }}>CAPTURE</button>
                        </>
                    ) : (
                        <>
                            <img src={photoFile} alt="proof" style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />
                            <button onClick={onDone} style={{ ...btnS, color: 'rgba(80,200,120,0.55)', background: 'rgba(80,200,120,0.04)', borderColor: 'rgba(80,200,120,0.15)' }}>SUBMIT PROOF</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (followUp.type === 'video') {
        const allDone = videoFiles.length >= followUp.target;
        return (
            <div>
                {revealBar}
                <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.6 }}>{followUp.instruction}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                        {Array.from({ length: followUp.target }).map((_, i) => (
                            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < videoFiles.length ? '#b82020' : 'rgba(255,255,255,0.08)', border: `1px solid ${i < videoFiles.length ? 'rgba(184,32,32,0.7)' : 'rgba(255,255,255,0.15)'}` }} />
                        ))}
                    </div>
                    {!allDone && !recording && !streamRef.current && (
                        <button onClick={() => openCamera('video')} style={btnS}>OPEN CAMERA #{videoFiles.length + 1}</button>
                    )}
                    {!allDone && streamRef.current && !recording && (
                        <>
                            {cameraPreview}
                            <button onClick={startRecording} style={{ ...btnS, background: `${R}0.08)`, borderColor: `${R}0.3)` }}>START RECORDING</button>
                        </>
                    )}
                    {recording && (
                        <>
                            {cameraPreview}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,40,40,0.8)', animation: 'vPulseRec 1s infinite' }} />
                                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: `${R}0.7)`, letterSpacing: '3px' }}>RECORDING</span>
                            </div>
                            <button onClick={stopRecording} style={{ ...btnS, color: 'rgba(255,40,40,0.6)', borderColor: 'rgba(255,40,40,0.2)' }}>STOP</button>
                        </>
                    )}
                    {allDone && (
                        <button onClick={onDone} style={{ ...btnS, color: 'rgba(80,200,120,0.55)', background: 'rgba(80,200,120,0.04)', borderColor: 'rgba(80,200,120,0.15)' }}>SUBMIT ALL</button>
                    )}
                </div>
            </div>
        );
    }

    if (followUp.type === 'endurance') {
        const startEndurance = async () => {
            // Open camera first, then start timer
            await openCamera('video');
            if (streamRef.current) {
                const chunks: BlobPart[] = [];
                const recorder = new MediaRecorder(streamRef.current);
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    setEnduranceFile(URL.createObjectURL(blob));
                    stopCamera();
                };
                recorderRef.current = recorder;
                recorder.start();
                setRecording(true);
            }
            // Start countdown
            setTimerStarted(true);
            setTimerLeft(followUp.duration);
            timerRef.current = setInterval(() => {
                setTimerLeft(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        // Auto-stop recording when timer ends
                        recorderRef.current?.stop();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };
        const mm = Math.floor(timerLeft / 60); const ss = timerLeft % 60;
        return (
            <div>
                {revealBar}
                <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.6 }}>{followUp.instruction}</div>
                    {!timerStarted ? (
                        <button onClick={startEndurance} style={btnS}>START (OPENS CAMERA + TIMER)</button>
                    ) : timerLeft > 0 ? (
                        <>
                            {cameraPreview}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,40,40,0.8)', animation: 'vPulseRec 1s infinite' }} />
                                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>RECORDING</span>
                            </div>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2.5rem', color: `${R}0.7)`, letterSpacing: '4px' }}>{mm}:{ss.toString().padStart(2, '0')}</div>
                        </>
                    ) : (
                        <>
                            {enduranceFile && <video src={enduranceFile} controls style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />}
                            <button onClick={onDone} style={{ ...btnS, color: 'rgba(80,200,120,0.55)', background: 'rgba(80,200,120,0.04)', borderColor: 'rgba(80,200,120,0.15)' }}>SUBMIT PROOF</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

// ═══════════════════════════════════════════
// MECHANISM 1: TIMED WINDOW PHOTO
// Tasks: Cage Inspection, Mirror Match
// ═══════════════════════════════════════════
function TimedWindowPhoto({ label, icon, instruction, referenceImg }: { label: string; icon: string; instruction: string; referenceImg?: string }) {
    const [status, setStatus] = useState<'waiting' | 'uploaded' | 'approved' | 'rejected'>('waiting');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);

    const handleUpload = () => {
        setPhotoUrl('/demo-proof.jpg');
        setStatus('uploaded');
    };

    if (status === 'approved') return <DoneCard label={label} result="Approved by Queen" />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} status={status === 'uploaded' ? 'PENDING' : status === 'rejected' ? 'REJECTED' : undefined} />
            <div style={{ padding: '20px 18px' }}>
                {/* Reference image if Mirror Match */}
                {referenceImg && (
                    <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: `1px solid ${R}0.15)`, aspectRatio: '1', background: `${R}0.04)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>QUEEN&apos;S REFERENCE PHOTO</span>
                    </div>
                )}
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16, textAlign: 'center' }}>{instruction}</div>

                {status === 'rejected' && (
                    <div style={{ textAlign: 'center', padding: '10px 0 14px', fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,40,40,0.6)', letterSpacing: '2px' }}>REJECTED — SUBMIT AGAIN</div>
                )}

                {(status === 'waiting' || status === 'rejected') && (
                    <label style={{ display: 'block', cursor: 'pointer' }}>
                        <div style={{ ...btnS, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M3 9h2M19 9h2" /></svg>
                            SUBMIT PHOTO
                        </div>
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} />
                    </label>
                )}
                {status === 'uploaded' && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 120, height: 120, borderRadius: 10, background: `${G}0.08)`, border: `1px solid ${G}0.2)`, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={`${G}0.4)`} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
                        </div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: `${G}0.55)`, letterSpacing: '3px' }}>AWAITING QUEEN&apos;S REVIEW</div>
                        {/* Demo buttons */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                            <button onClick={() => setStatus('approved')} style={{ ...btnSmall, color: 'rgba(80,200,120,0.5)', borderColor: 'rgba(80,200,120,0.15)' }}>demo: approve</button>
                            <button onClick={() => setStatus('rejected')} style={{ ...btnSmall, color: 'rgba(255,40,40,0.5)', borderColor: 'rgba(255,40,40,0.15)' }}>demo: reject</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 3: AMBUSH SNAP
// Tasks: Cage Hunting, Countdown Bomb
// ═══════════════════════════════════════════
function AmbushSnap({ label, icon, target }: { label: string; icon: string; target: number }) {
    const [snaps, setSnaps] = useState<('waiting' | 'active' | 'done' | 'missed')[]>(Array(target).fill('waiting'));
    const [activeIdx, setActiveIdx] = useState(-1);
    const [countdown, setCountdown] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const triggerSnap = (idx: number) => {
        const updated = [...snaps]; updated[idx] = 'active'; setSnaps(updated); setActiveIdx(idx);
        setCountdown(120); // 2 min
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); const u = [...snaps]; u[idx] = 'missed'; setSnaps(u); setActiveIdx(-1); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const submitSnap = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const updated = [...snaps]; updated[activeIdx] = 'done'; setSnaps(updated); setActiveIdx(-1);
    };

    const allDone = snaps.every(s => s === 'done');
    if (allDone) return <DoneCard label={label} result={`${target}/${target} snaps submitted`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} progress={`${snaps.filter(s => s === 'done').length}/${target}`} />
            <div style={{ padding: '20px 18px' }}>
                {/* Snap slots */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                    {snaps.map((s, i) => (
                        <div key={i} style={{
                            width: 44, height: 44, borderRadius: 8,
                            background: s === 'done' ? 'rgba(80,200,120,0.06)' : s === 'active' ? `${R}0.1)` : s === 'missed' ? 'rgba(255,40,40,0.06)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${s === 'done' ? 'rgba(80,200,120,0.2)' : s === 'active' ? `${R}0.3)` : s === 'missed' ? 'rgba(255,40,40,0.15)' : 'rgba(255,255,255,0.06)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {s === 'done' && <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>}
                            {s === 'active' && <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.7rem', color: `${R}0.7)` }}>!</span>}
                            {s === 'missed' && <span style={{ color: 'rgba(255,40,40,0.5)', fontSize: '0.9rem' }}>✕</span>}
                            {s === 'waiting' && <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)' }}>{i + 1}</span>}
                        </div>
                    ))}
                </div>

                {activeIdx >= 0 ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', color: `${R}0.7)`, marginBottom: 8 }}>
                            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                        </div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', marginBottom: 14 }}>SNAP NOW OR FAIL</div>
                        <label style={{ display: 'block', cursor: 'pointer' }}>
                            <div style={{ ...btnS, background: `${R}0.08)`, borderColor: `${R}0.3)` }}>SUBMIT SNAP</div>
                            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={submitSnap} />
                        </label>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: 12 }}>WAITING FOR QUEEN&apos;S SIGNAL</div>
                        <button onClick={() => { const next = snaps.findIndex(s => s === 'waiting'); if (next >= 0) triggerSnap(next); }} style={{ ...btnSmall, color: 'rgba(255,255,255,0.3)' }}>demo: trigger snap</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 4: SPIN WHEEL
// Tasks: Temptation Wheel, Confession Wheel, Exposure Roulette
// ═══════════════════════════════════════════
type WheelSegment = { text: string; color: string; followUp?: FollowUp };

function SpinWheel({ label, icon, segments }: { label: string; icon: string; segments: WheelSegment[] }) {
    const [angle, setAngle] = useState(0);
    const [spinning, setSpinning] = useState(false);
    const [resultIdx, setResultIdx] = useState<number | null>(null);
    const [followUpDone, setFollowUpDone] = useState(false);

    const spin = () => {
        if (spinning || resultIdx !== null) return;
        setSpinning(true);
        const spins = 5 + Math.random() * 5;
        const finalAngle = spins * 360 + Math.random() * 360;
        setAngle(finalAngle);
        setTimeout(() => {
            setSpinning(false);
            const seg = 360 / segments.length;
            const normalized = finalAngle % 360;
            const idx = Math.floor((360 - normalized + seg / 2) % 360 / seg);
            setResultIdx(idx % segments.length);
        }, 4000);
    };

    const landed = resultIdx !== null ? segments[resultIdx] : null;

    // Fully done — follow-up completed (or instant)
    if (followUpDone && landed) return <DoneCard label={label} result={landed.text} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            {/* Phase 1: Wheel spin */}
            {resultIdx === null && (
                <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 16px' }}>
                        <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 2, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `12px solid ${R}0.6)` }} />
                        <div style={{ width: 200, height: 200, borderRadius: '50%', border: `1.5px solid ${R}0.15)`, transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none', position: 'relative', overflow: 'hidden' }}>
                            {segments.map((s, i) => { const seg = 360 / segments.length; return <div key={i} style={{ position: 'absolute', width: '50%', height: '50%', top: 0, right: 0, transformOrigin: '0% 100%', transform: `rotate(${i * seg - 90}deg) skewY(-${90 - seg}deg)`, background: i % 2 === 0 ? `${R}0.06)` : 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />; })}
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 40, borderRadius: '50%', background: '#0a0a0e', border: `1px solid ${R}0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                <span style={{ fontSize: '0.8rem', color: `${R}0.65)` }}>{icon}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={spin} disabled={spinning} style={{ ...btnS, opacity: spinning ? 0.5 : 1 }}>
                        {spinning ? 'SPINNING...' : 'SPIN'}
                    </button>
                </div>
            )}
            {/* Phase 2: Follow-up mechanism */}
            {landed && !followUpDone && (
                <FollowUpTask
                    followUp={landed.followUp || { type: 'instant' }}
                    resultText={landed.text}
                    onDone={() => setFollowUpDone(true)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 5: BINARY GAMBLE
// Tasks: Coinflip, Loyalty Test, Temptation Trap
// ═══════════════════════════════════════════
function BinaryGamble({ label, icon, optionA, optionB, variant, followUpA, followUpB }: { label: string; icon: string; optionA: string; optionB: string; variant: 'coinflip' | 'loyalty' | 'trap'; followUpA?: FollowUp; followUpB?: FollowUp }) {
    const [picked, setPicked] = useState<'a' | 'b' | null>(null);
    const [flipping, setFlipping] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [followUpDone, setFollowUpDone] = useState(false);

    const pick = (choice: 'a' | 'b') => {
        if (picked) return;
        if (variant === 'coinflip') {
            setFlipping(true);
            setTimeout(() => {
                const r = Math.random() > 0.5 ? 'a' : 'b';
                setPicked(r);
                setResult(r === 'a' ? optionA : optionB);
                setFlipping(false);
            }, 1500);
        } else {
            setPicked(choice);
            setResult(choice === 'a' ? optionA : optionB);
        }
    };

    const activeFollowUp = picked === 'a' ? followUpA : picked === 'b' ? followUpB : undefined;

    if (followUpDone && result) return <DoneCard label={label} result={result} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            {/* Phase 1: Pick / Flip */}
            {!result && (
                <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                    {variant === 'coinflip' ? (
                        <>
                            <div style={{ width: 100, height: 100, borderRadius: '50%', border: `2px solid ${G}0.25)`, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${G}0.04)`, animation: flipping ? 'vCoinFlip 0.3s linear infinite' : 'none' }}>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: `${G}0.6)` }}>{flipping ? '?' : icon}</span>
                            </div>
                            <button onClick={() => pick('a')} disabled={flipping} style={{ ...btnS, opacity: flipping ? 0.5 : 1 }}>{flipping ? 'FLIPPING...' : 'FLIP COIN'}</button>
                        </>
                    ) : variant === 'trap' ? (
                        <>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 20 }}>A button has appeared. Do you trust it?</div>
                            <button onClick={() => pick('a')} style={{ ...btnS, background: 'rgba(80,200,120,0.06)', borderColor: 'rgba(80,200,120,0.2)', color: 'rgba(80,200,120,0.55)', marginBottom: 10 }}>RELEASE EARLY</button>
                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>or do nothing and wait...</div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => pick('a')} style={{ ...btnS, flex: 1 }}>{optionA.split(':')[0] || 'OPTION A'}</button>
                            <button onClick={() => pick('b')} style={{ ...btnS, flex: 1 }}>{optionB.split(':')[0] || 'OPTION B'}</button>
                        </div>
                    )}
                </div>
            )}
            {/* Phase 2: Follow-up */}
            {result && !followUpDone && (
                <FollowUpTask
                    followUp={activeFollowUp || { type: 'instant' }}
                    resultText={result}
                    onDone={() => setFollowUpDone(true)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 6: CARD PICK
// Tasks: Daily Gamble, Blind Order, Price Tag
// ═══════════════════════════════════════════
type CardDef = { text: string; followUp?: FollowUp };

function CardPick({ label, icon, cards, variant }: { label: string; icon: string; cards: CardDef[]; variant: 'gamble' | 'blind' | 'price' }) {
    const [picked, setPicked] = useState(-1);
    const [revealed, setRevealed] = useState(false);
    const [followUpDone, setFollowUpDone] = useState(false);
    const [skipCost, setSkipCost] = useState(10);

    const pickCard = (idx: number) => {
        if (picked >= 0) return;
        setPicked(idx);
        setTimeout(() => setRevealed(true), 800);
    };

    const pickedCard = picked >= 0 ? cards[picked] : null;

    if (followUpDone && pickedCard) return <DoneCard label={label} result={pickedCard.text} />;

    if (revealed && pickedCard) return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            {/* Show all cards revealed */}
            <div style={{ padding: '20px 18px' }}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                    {cards.map((c, i) => (
                        <div key={i} style={{
                            width: 90, minHeight: 120, borderRadius: 10, padding: '14px 10px',
                            background: i === picked ? `${R}0.08)` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${i === picked ? `${R}0.3)` : 'rgba(255,255,255,0.06)'}`,
                            textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        }}>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: i === picked ? `${R}0.7)` : 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{c.text}</div>
                            {i === picked && <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.6rem', color: `${R}0.5)`, letterSpacing: '2px', marginTop: 6 }}>YOURS</div>}
                        </div>
                    ))}
                </div>
            </div>
            {/* Follow-up mechanism */}
            <FollowUpTask
                followUp={pickedCard.followUp || { type: 'instant' }}
                resultText={pickedCard.text}
                onDone={() => setFollowUpDone(true)}
            />
        </div>
    );

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                {variant === 'blind' ? (
                    <>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>Accept without seeing. No backing out.</div>
                        <div style={{ width: 90, minHeight: 120, borderRadius: 10, background: `${R}0.04)`, border: `1px solid ${R}0.15)`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '2rem', color: `${R}0.3)` }}>?</span>
                        </div>
                        <button onClick={() => pickCard(0)} style={btnS}>ACCEPT ORDER</button>
                    </>
                ) : variant === 'price' ? (
                    <>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>Do it, or pay to skip.</div>
                        <div style={{ width: 120, minHeight: 140, borderRadius: 10, background: `${R}0.04)`, border: `1px solid ${R}0.15)`, margin: '0 auto 16px', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{cards[0].text}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => pickCard(0)} style={{ ...btnS, flex: 1 }}>DO IT</button>
                            <button onClick={() => setSkipCost(prev => prev + 10)} style={{ ...btnS, flex: 1, color: `${G}0.5)`, borderColor: `${G}0.15)` }}>SKIP ({skipCost} coins)</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>Pick a card. Choose wisely.</div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            {cards.map((_, i) => (
                                <button key={i} onClick={() => pickCard(i)} style={{ width: 80, height: 110, borderRadius: 10, background: `${R}0.04)`, border: `1px solid ${R}0.15)`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: `${R}0.3)` }}>{i + 1}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 7: DICE / ROULETTE
// Tasks: Dice Roll, Russian Roulette
// ═══════════════════════════════════════════
type DiceOutcome = { text: string; followUp?: FollowUp };

function DiceRoulette({ label, icon, outcomes, variant }: { label: string; icon: string; outcomes: DiceOutcome[]; variant: 'dice' | 'roulette' }) {
    const [rolling, setRolling] = useState(false);
    const [result, setResult] = useState<{ num: number; outcome: DiceOutcome } | null>(null);
    const [followUpDone, setFollowUpDone] = useState(false);
    const [chamber, setChamber] = useState(0);
    const [pulls, setPulls] = useState(0);
    const [dead, setDead] = useState(false);
    const loadedChamber = useRef(Math.floor(Math.random() * 6));

    const roll = () => {
        if (rolling || result) return;
        setRolling(true);
        setTimeout(() => {
            const num = Math.floor(Math.random() * outcomes.length);
            setResult({ num: num + 1, outcome: outcomes[num] });
            setRolling(false);
        }, 1500);
    };

    const pullTrigger = () => {
        if (dead || rolling) return;
        setRolling(true);
        setChamber(prev => prev + 1);
        setTimeout(() => {
            setRolling(false);
            setPulls(prev => prev + 1);
            if (pulls === loadedChamber.current) setDead(true);
        }, 1000);
    };

    if (followUpDone && result) return <DoneCard label={label} result={`Rolled ${result.num}: ${result.outcome.text}`} />;
    if (dead) return <DoneCard label={label} result="BANG! Loaded chamber hit. Punishment activated." />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            {/* Phase 1: Roll / Pull */}
            {!result && (
                <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                    {variant === 'dice' ? (
                        <>
                            <div style={{ width: 80, height: 80, borderRadius: 12, border: `2px solid ${R}0.2)`, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${R}0.04)` }}>
                                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: `${R}0.6)`, animation: rolling ? 'vShake 0.1s linear infinite' : 'none' }}>{rolling ? '?' : icon}</span>
                            </div>
                            <button onClick={roll} disabled={rolling} style={{ ...btnS, opacity: rolling ? 0.5 : 1 }}>{rolling ? 'ROLLING...' : 'ROLL DICE'}</button>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: i < pulls ? (i === loadedChamber.current ? 'rgba(255,40,40,0.15)' : 'rgba(80,200,120,0.08)') : `${R}0.04)`,
                                        border: `1px solid ${i < pulls ? (i === loadedChamber.current ? 'rgba(255,40,40,0.3)' : 'rgba(80,200,120,0.15)') : `${R}0.12)`}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {i < pulls && i !== loadedChamber.current && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                                        {i < pulls && i === loadedChamber.current && <span style={{ color: 'rgba(255,40,40,0.6)', fontSize: '0.7rem' }}>!</span>}
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: 14 }}>{pulls}/6 CHAMBERS</div>
                            <button onClick={pullTrigger} disabled={rolling} style={{ ...btnS, background: `${R}0.06)`, borderColor: `${R}0.25)`, opacity: rolling ? 0.5 : 1 }}>{rolling ? '...' : 'PULL TRIGGER'}</button>
                        </>
                    )}
                </div>
            )}
            {/* Phase 2: Follow-up */}
            {result && !followUpDone && (
                <FollowUpTask
                    followUp={result.outcome.followUp || { type: 'instant' }}
                    resultText={`Rolled ${result.num}: ${result.outcome.text}`}
                    onDone={() => setFollowUpDone(true)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 8: QUIZ / RIDDLE
// Tasks: Quiz, Queen's Riddle
// ═══════════════════════════════════════════
function QuizRiddle({ label, icon, question, options, correctIdx, timeLimit = 60 }: { label: string; icon: string; question: string; options: string[]; correctIdx: number; timeLimit?: number }) {
    const [answered, setAnswered] = useState(-1);
    const [timeLeft, setTimeLeft] = useState(timeLimit);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        timerRef.current = setInterval(() => setTimeLeft(prev => { if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; } return prev - 1; }), 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const answer = (idx: number) => {
        if (answered >= 0 || timeLeft === 0) return;
        if (timerRef.current) clearInterval(timerRef.current);
        setAnswered(idx);
    };

    const correct = answered === correctIdx;
    if (answered >= 0) return <DoneCard label={label} result={correct ? 'Correct answer' : `Wrong! Correct: ${options[correctIdx]}`} />;
    if (timeLeft === 0) return <DoneCard label={label} result="TIME UP! Failed to answer." />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} status={`${timeLeft}s`} />
            <div style={{ padding: '20px 18px' }}>
                {/* Timer bar */}
                <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(timeLeft / timeLimit) * 100}%`, background: timeLeft < 10 ? 'rgba(255,40,40,0.5)' : `${R}0.4)`, transition: 'width 1s linear', borderRadius: 2 }} />
                </div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 18, textAlign: 'center' }}>{question}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {options.map((opt, i) => (
                        <button key={i} onClick={() => answer(i)} style={{ ...btnS, textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: `${R}0.4)`, width: 20 }}>{String.fromCharCode(65 + i)}</span>
                            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{opt}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 9: WRITING PROMPT
// Tasks: Trial, Journal, Confession, Worship Writing
// ═══════════════════════════════════════════
function WritingPrompt({ label, icon, prompt, minWords = 50 }: { label: string; icon: string; prompt: string; minWords?: number }) {
    const [text, setText] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (submitted) return <DoneCard label={label} result={`${wordCount} words submitted`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '20px 18px' }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 14 }}>{prompt}</div>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write here..."
                    style={{ width: '100%', minHeight: 120, background: 'rgba(0,0,0,0.3)', border: `1px solid ${R}0.1)`, borderRadius: 8, padding: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: wordCount >= minWords ? 'rgba(80,200,120,0.5)' : 'rgba(255,255,255,0.35)' }}>{wordCount} / {minWords} words</span>
                    <button onClick={() => setSubmitted(true)} disabled={wordCount < minWords} style={{ ...btnSmall, opacity: wordCount >= minWords ? 1 : 0.3, color: wordCount >= minWords ? `${R}0.55)` : 'rgba(255,255,255,0.15)' }}>SUBMIT</button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 10: MULTI-STAGE VIDEO PROOF
// Tasks: Edge, Cold Shower, Exercise, Worship Video, Pain Task
// ═══════════════════════════════════════════
function MultiStageVideo({ label, icon, target, instruction }: { label: string; icon: string; target: number; instruction: string }) {
    const [proofs, setProofs] = useState<string[]>([]);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const allDone = proofs.length >= target;

    const openCam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
            setCameraOpen(true);
        } catch (e) { console.error('Camera denied', e); }
    };
    const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOpen(false); };
    const startRec = () => {
        if (!streamRef.current) return;
        const chunks: BlobPart[] = [];
        const rec = new MediaRecorder(streamRef.current);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => { setProofs(prev => [...prev, URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))]); setRecording(false); stopCam(); };
        recorderRef.current = rec; rec.start(); setRecording(true);
    };
    const stopRec = () => { recorderRef.current?.stop(); };

    if (allDone) return <DoneCard label={label} result={`${target}/${target} video proofs submitted`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} progress={`${proofs.length}/${target}`} />
            <div style={{ padding: '20px 18px' }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                    {Array.from({ length: target }).map((_, i) => (
                        <div key={i} style={{ width: 50, height: 50, borderRadius: 8, background: i < proofs.length ? 'rgba(80,200,120,0.06)' : i === proofs.length ? `${R}0.06)` : 'rgba(255,255,255,0.02)', border: `1px solid ${i < proofs.length ? 'rgba(80,200,120,0.2)' : i === proofs.length ? `${R}0.25)` : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {i < proofs.length ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg> : <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.7rem', color: i === proofs.length ? `${R}0.5)` : 'rgba(255,255,255,0.12)' }}>#{i + 1}</span>}
                        </div>
                    ))}
                </div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 14, textAlign: 'center' }}>{instruction}</div>

                {!cameraOpen && !recording && (
                    <button onClick={openCam} style={btnS}>OPEN CAMERA #{proofs.length + 1}</button>
                )}
                {cameraOpen && !recording && (
                    <>
                        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#000' }}><video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} /></div>
                        <button onClick={startRec} style={{ ...btnS, background: `${R}0.08)`, borderColor: `${R}0.3)` }}>START RECORDING</button>
                    </>
                )}
                {recording && (
                    <>
                        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#000' }}><video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} /></div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,40,40,0.8)', animation: 'vPulseRec 1s infinite' }} />
                            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.8rem', color: `${R}0.7)`, letterSpacing: '3px' }}>RECORDING</span>
                        </div>
                        <button onClick={stopRec} style={{ ...btnS, color: 'rgba(255,40,40,0.6)', borderColor: 'rgba(255,40,40,0.2)' }}>STOP</button>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 11: PHOTO PROOF (SINGLE)
// Tasks: Body Writing, Public Task
// ═══════════════════════════════════════════
function PhotoProof({ label, icon, instruction }: { label: string; icon: string; instruction: string }) {
    const [photoFile, setPhotoFile] = useState<string | null>(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const openCam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
            setCameraOpen(true);
        } catch (e) { console.error('Camera denied', e); }
    };
    const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOpen(false); };
    const capture = () => {
        if (!videoRef.current) return;
        const c = document.createElement('canvas'); c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
        c.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        setPhotoFile(c.toDataURL('image/jpeg')); stopCam();
    };

    if (photoFile) return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                <img src={photoFile} alt="proof" style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />
                <DoneCard label={label} result="Photo proof submitted" />
            </div>
        </div>
    );

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>{instruction}</div>
                {!cameraOpen ? (
                    <button onClick={openCam} style={btnS}>OPEN CAMERA</button>
                ) : (
                    <>
                        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#000' }}><video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} /></div>
                        <button onClick={capture} style={{ ...btnS, background: `${R}0.08)`, borderColor: `${R}0.3)` }}>CAPTURE</button>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 12: ENDURANCE TIMER
// Tasks: Corner Time, Positions, Silence
// ═══════════════════════════════════════════
function EnduranceTimer({ label, icon, duration, instruction }: { label: string; icon: string; duration: number; instruction: string }) {
    const [started, setStarted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(duration);
    const [completed, setCompleted] = useState(false);
    const [enduranceFile, setEnduranceFile] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);

    const start = async () => {
        // Open camera + start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
            const chunks: BlobPart[] = [];
            const rec = new MediaRecorder(stream);
            rec.ondataavailable = e => chunks.push(e.data);
            rec.onstop = () => {
                setEnduranceFile(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
                streamRef.current?.getTracks().forEach(t => t.stop());
            };
            recorderRef.current = rec; rec.start();
        } catch (e) { console.error('Camera denied', e); }

        // Start countdown
        setStarted(true);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    recorderRef.current?.stop();
                    setCompleted(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    if (completed) return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '16px 18px', textAlign: 'center' }}>
                {enduranceFile && <video src={enduranceFile} controls style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />}
                <DoneCard label={label} result={`${duration}s endured — video recorded`} />
            </div>
        </div>
    );

    const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
    const pct = ((duration - timeLeft) / duration) * 100;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>{instruction}</div>
                {!started ? (
                    <button onClick={start} style={btnS}>BEGIN (OPENS CAMERA + TIMER)</button>
                ) : (
                    <>
                        {/* Live camera feed */}
                        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: '#000' }}><video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} /></div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,40,40,0.8)', animation: 'vPulseRec 1s infinite' }} />
                            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>RECORDING</span>
                        </div>
                        {/* Circle timer */}
                        <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 16px' }}>
                            <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
                                <circle cx="80" cy="80" r="70" fill="none" stroke={`${R}0.4)`} strokeWidth="4" strokeDasharray={`${2 * Math.PI * 70}`} strokeDashoffset={`${2 * Math.PI * 70 * (1 - pct / 100)}`} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', color: `${R}0.65)` }}>{m}:{String(s).padStart(2, '0')}</span>
                            </div>
                        </div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px' }}>DO NOT LEAVE THIS SCREEN</div>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 13: GREED GAME
// Tasks: Endurance Challenge
// ═══════════════════════════════════════════
function GreedGame({ label, icon, ceiling }: { label: string; icon: string; ceiling: number }) {
    const [count, setCount] = useState(0);
    const [running, setRunning] = useState(false);
    const [stopped, setStopped] = useState(false);
    const [busted, setBusted] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const start = () => {
        setRunning(true);
        timerRef.current = setInterval(() => {
            setCount(prev => {
                if (prev + 1 >= ceiling) { if (timerRef.current) clearInterval(timerRef.current); setBusted(true); setRunning(false); return prev + 1; }
                return prev + 1;
            });
        }, 200);
    };

    const stop = () => { if (timerRef.current) clearInterval(timerRef.current); setRunning(false); setStopped(true); };

    if (busted) return <DoneCard label={label} result="BUSTED! You got greedy. Lost everything." />;
    if (stopped) return <DoneCard label={label} result={`Cashed out at ${count} points`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', color: count > ceiling * 0.7 ? 'rgba(255,40,40,0.7)' : `${G}0.6)`, marginBottom: 8, transition: 'color 0.3s' }}>{count}</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', marginBottom: 16 }}>
                    {running ? 'TAP TO CASH OUT — OR RISK IT ALL' : 'HOW GREEDY ARE YOU?'}
                </div>
                {!running ? (
                    <button onClick={start} style={btnS}>START</button>
                ) : (
                    <button onClick={stop} style={{ ...btnS, background: `${G}0.06)`, borderColor: `${G}0.2)`, color: `${G}0.6)` }}>CASH OUT</button>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 14: CHOOSE YOUR FATE
// Tasks: Truth or Dare, Voting Booth, Streak Breaker
// ═══════════════════════════════════════════
type FateOption = { label: string; desc: string; followUp?: FollowUp };

function ChooseYourFate({ label, icon, optionA, optionB, variant }: { label: string; icon: string; optionA: FateOption; optionB: FateOption; variant: 'truth_dare' | 'vote' | 'streak' }) {
    const [picked, setPicked] = useState<'a' | 'b' | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [followUpDone, setFollowUpDone] = useState(false);

    const chosen = picked === 'a' ? optionA : picked === 'b' ? optionB : null;

    const pick = (choice: 'a' | 'b') => {
        setPicked(choice);
        setTimeout(() => setRevealed(true), 600);
    };

    if (followUpDone && chosen) return <DoneCard label={label} result={`Chose ${chosen.label}: ${chosen.desc}`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            {/* Phase 1: Pick */}
            {!revealed && (
                <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                    {variant === 'streak' ? (
                        <>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 16 }}>Break your streak for 100 coins?</div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => pick('a')} style={{ ...btnS, flex: 1, color: 'rgba(255,40,40,0.5)', borderColor: 'rgba(255,40,40,0.15)' }}>{optionA.label}</button>
                                <button onClick={() => pick('b')} style={{ ...btnS, flex: 1, color: 'rgba(80,200,120,0.5)', borderColor: 'rgba(80,200,120,0.15)' }}>{optionB.label}</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>
                                {variant === 'truth_dare' ? 'Choose blind. No take-backs.' : 'Pick your punishment.'}
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => pick('a')} style={{ ...btnS, flex: 1, height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>{variant === 'truth_dare' ? '?' : '1'}</span>
                                    <span>{optionA.label}</span>
                                </button>
                                <button onClick={() => pick('b')} style={{ ...btnS, flex: 1, height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>{variant === 'truth_dare' ? '?' : '2'}</span>
                                    <span>{optionB.label}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
            {/* Phase 2: Follow-up */}
            {revealed && chosen && !followUpDone && (
                <FollowUpTask
                    followUp={chosen.followUp || { type: 'instant' }}
                    resultText={`${chosen.label}: ${chosen.desc}`}
                    onDone={() => setFollowUpDone(true)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 15: TIMED TASK CHAIN (Simon Says)
// ═══════════════════════════════════════════
function TimedTaskChain({ label, icon, tasks }: { label: string; icon: string; tasks: { text: string; timeLimit: number }[] }) {
    const [started, setStarted] = useState(false);
    const [currentTask, setCurrentTask] = useState(-1);
    const [taskTime, setTaskTime] = useState(0);
    const [results, setResults] = useState<('done' | 'missed')[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const triggerNext = useCallback(() => {
        const next = currentTask + 1;
        if (next >= tasks.length) return;
        setCurrentTask(next);
        setTaskTime(tasks[next].timeLimit);
        timerRef.current = setInterval(() => {
            setTaskTime(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setResults(r => [...r, 'missed']);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [currentTask, tasks]);

    const completeTask = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setResults(r => [...r, 'done']);
    };

    const allDone = results.length === tasks.length;
    if (allDone) return <DoneCard label={label} result={`${results.filter(r => r === 'done').length}/${tasks.length} completed`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} progress={results.length > 0 ? `${results.filter(r => r === 'done').length}/${tasks.length}` : undefined} />
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                {!started ? (
                    <>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>{tasks.length} tasks will appear one by one. Complete each before time runs out.</div>
                        <button onClick={() => { setStarted(true); setTimeout(triggerNext, 500); }} style={btnS}>START CHAIN</button>
                    </>
                ) : currentTask >= 0 && currentTask < tasks.length && results.length === currentTask ? (
                    <>
                        {/* Active task */}
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: `${R}0.5)`, letterSpacing: '2px', marginBottom: 8 }}>TASK {currentTask + 1} OF {tasks.length}</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '1.8rem', color: taskTime < 10 ? 'rgba(255,40,40,0.6)' : `${R}0.6)`, marginBottom: 8 }}>{taskTime}s</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 16, padding: '14px', background: `${R}0.04)`, borderRadius: 10, border: `1px solid ${R}0.12)` }}>{tasks[currentTask].text}</div>
                        <button onClick={completeTask} style={btnS}>DONE</button>
                    </>
                ) : (
                    <>
                        {/* Between tasks or after miss */}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
                            {results.map((r, i) => (
                                <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: r === 'done' ? 'rgba(80,200,120,0.06)' : 'rgba(255,40,40,0.06)', border: `1px solid ${r === 'done' ? 'rgba(80,200,120,0.2)' : 'rgba(255,40,40,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {r === 'done' ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(80,200,120,0.5)" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> : <span style={{ color: 'rgba(255,40,40,0.5)', fontSize: '0.7rem' }}>✕</span>}
                                </div>
                            ))}
                        </div>
                        {results.length < tasks.length && (
                            <button onClick={triggerNext} style={btnS}>NEXT TASK</button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// MECHANISM 16: PAYMENT
// Tasks: Tribute, Bid for Mercy
// ═══════════════════════════════════════════
function Payment({ label, icon, amount, variant }: { label: string; icon: string; amount: number; variant: 'tribute' | 'bid' }) {
    const [paid, setPaid] = useState(false);
    const [bidAmount, setBidAmount] = useState(amount);

    if (paid) return <DoneCard label={label} result={variant === 'bid' ? `Won mercy for ${bidAmount} coins` : `${amount} coins tributed`} />;

    return (
        <div style={cardS}>
            <CardHeader icon={icon} label={label} />
            <div style={{ padding: '20px 18px', textAlign: 'center' }}>
                {variant === 'bid' ? (
                    <>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>You failed a task. Bid coins to erase the failure.</div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2rem', color: `${G}0.6)`, marginBottom: 4 }}>{bidAmount}</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', marginBottom: 14 }}>MINIMUM: {amount}</div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                            <button onClick={() => setBidAmount(prev => Math.max(amount, prev - 5))} style={{ ...btnSmall, width: 40 }}>-5</button>
                            <button onClick={() => setBidAmount(prev => prev + 5)} style={{ ...btnSmall, width: 40 }}>+5</button>
                            <button onClick={() => setBidAmount(prev => prev + 25)} style={{ ...btnSmall, width: 50 }}>+25</button>
                        </div>
                        <button onClick={() => setPaid(true)} style={{ ...btnS, color: `${G}0.55)`, borderColor: `${G}0.2)` }}>PLACE BID</button>
                    </>
                ) : (
                    <>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '2.5rem', color: `${G}0.6)`, marginBottom: 4 }}>{amount}</div>
                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', marginBottom: 16 }}>COINS</div>
                        <button onClick={() => setPaid(true)} style={{ ...btnS, color: `${G}0.55)`, borderColor: `${G}0.2)` }}>PAY TRIBUTE</button>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
function CardHeader({ icon, label, progress, status }: { icon: string; label: string; progress?: string; status?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${R}0.1)` }}>
            <span style={{ fontSize: '1.1rem', opacity: 0.5 }}>{icon}</span>
            <span style={{ flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.5px' }}>{label}</span>
            {progress && <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: `${R}0.6)` }}>{progress}</span>}
            {status && <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: `${G}0.5)`, letterSpacing: '2px', background: `${G}0.06)`, padding: '3px 8px', borderRadius: 4 }}>{status}</span>}
        </div>
    );
}

function DoneCard({ label, result }: { label: string; result: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(80,200,120,0.03)', border: '1px solid rgba(80,200,120,0.12)', borderRadius: 12 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(80,200,120,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'rgba(80,200,120,0.5)', letterSpacing: '0.5px', textDecoration: 'line-through' }}>{label}</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', marginTop: 2 }}>{result}</div>
            </div>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(80,200,120,0.35)', letterSpacing: '2px' }}>DONE</span>
        </div>
    );
}

// ═══════════════════════════════════════════
// MAIN PAGE — DEMO OF ALL 15 MECHANISMS (kneel + chastity check already in vault)
// ═══════════════════════════════════════════
export default function VaultTasksPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0e', padding: '40px 16px 100px', maxWidth: 420, margin: '0 auto' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: `${R}0.7)`, letterSpacing: '4px', textAlign: 'center', marginBottom: 8 }}>WORK</div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textAlign: 'center', marginBottom: 30 }}>DAY 5 ORDERS</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 1. Timed Window Photo */}
                <SectionLabel text="1. TIMED WINDOW PHOTO" />
                <TimedWindowPhoto label="Mirror Match" icon="◇" instruction="Recreate Queen's pose exactly." referenceImg="/ref.jpg" />

                {/* 2. Ambush Snap */}
                <SectionLabel text="2. AMBUSH SNAP" />
                <AmbushSnap label="Cage Hunting" icon="!" target={3} />

                {/* 3. Spin Wheel */}
                <SectionLabel text="3. SPIN WHEEL" />
                <SpinWheel label="Temptation Wheel" icon="♛" segments={[
                    { text: 'Edge 3 times', color: 'red', followUp: { type: 'video', target: 3, instruction: 'Edge to the limit. Stop. Record each time.' } },
                    { text: '+2 days added', color: 'red' },
                    { text: 'Queen grants 50 coins', color: 'gold' },
                    { text: 'Cold shower 1 min', color: 'blue', followUp: { type: 'endurance', duration: 60, instruction: 'Cold water. Film the entire duration.' } },
                    { text: 'Nothing. Suffer.', color: 'gray' },
                    { text: '1 day removed', color: 'green' },
                    { text: 'Hold ice 60s', color: 'blue', followUp: { type: 'endurance', duration: 60, instruction: 'Hold ice against your skin. Camera on.' } },
                    { text: 'Write gratitude essay', color: 'gray', followUp: { type: 'writing', prompt: 'Write why you are grateful to serve Queen Karin today.', minWords: 100 } },
                ]} />

                {/* 4. Binary Gamble */}
                <SectionLabel text="4. BINARY GAMBLE" />
                <BinaryGamble label="Coinflip" icon="$" optionA="Heads: 50 coins" optionB="Tails: +1 day locked" variant="coinflip" followUpB={{ type: 'instant' }} />
                <BinaryGamble label="Loyalty Test" icon="?" optionA="LEFT: Obey Queen" optionB="RIGHT: Take the shortcut" variant="loyalty" />
                <BinaryGamble label="Temptation Trap" icon="!" optionA="Pressed: PUNISHMENT" optionB="" variant="trap" />

                {/* 5. Card Pick */}
                <SectionLabel text="5. CARD PICK" />
                <CardPick label="Daily Gamble" icon="🃏" cards={[
                    { text: '50 coins reward' },
                    { text: '+3 hours locked' },
                    { text: 'Edge & prove it', followUp: { type: 'video', target: 1, instruction: 'Edge to the limit. Record the moment you stop.' } },
                ]} variant="gamble" />
                <CardPick label="Blind Order" icon="?" cards={[
                    { text: 'Cold shower 2 min', followUp: { type: 'endurance', duration: 120, instruction: 'Cold water. Film entire duration.' } },
                ]} variant="blind" />
                <CardPick label="Price Tag" icon="$" cards={[
                    { text: 'Write 500 word essay about your failures', followUp: { type: 'writing', prompt: 'Write about your failures and why you deserve punishment.', minWords: 500 } },
                ]} variant="price" />

                {/* 6. Dice / Roulette */}
                <SectionLabel text="6. DICE / ROULETTE" />
                <DiceRoulette label="Dice Roll" icon="⚄" outcomes={[
                    { text: '20 coins' },
                    { text: 'Edge once', followUp: { type: 'video', target: 1, instruction: 'Edge. Record proof.' } },
                    { text: 'Cold shower', followUp: { type: 'endurance', duration: 60, instruction: 'Cold water. Film it.' } },
                    { text: 'Nothing' },
                    { text: '+1 day' },
                    { text: 'Queen grants mercy' },
                ]} variant="dice" />
                <DiceRoulette label="Russian Roulette" icon="⊕" outcomes={[]} variant="roulette" />

                {/* 7. Quiz / Riddle */}
                <SectionLabel text="7. QUIZ / RIDDLE" />
                <QuizRiddle label="Queen's Quiz" icon="?" question="What is the first rule of serving Queen Karin?" options={['Obey without question', 'Negotiate terms', 'Ask for rewards', 'Set your own limits']} correctIdx={0} timeLimit={30} />

                {/* 8. Writing Prompt */}
                <SectionLabel text="8. WRITING PROMPT" />
                <WritingPrompt label="Daily Trial" icon="✎" prompt="Write 200 words explaining why you don't deserve release today." minWords={200} />
                <WritingPrompt label="Journal" icon="📓" prompt="Record your thoughts, struggles, and devotion today." minWords={100} />

                {/* 9. Multi-Stage Video */}
                <SectionLabel text="9. MULTI-STAGE VIDEO" />
                <MultiStageVideo label="Edge 3 times" icon="✱" target={3} instruction="Edge to the limit. Stop. Record the moment you stop." />
                <MultiStageVideo label="Cold Shower" icon="❆" target={1} instruction="2 minutes under cold water. Film the entire duration." />

                {/* 10. Photo Proof */}
                <SectionLabel text="10. PHOTO PROOF" />
                <PhotoProof label="Body Writing" icon="✍" instruction="Write 'PROPERTY OF QUEEN KARIN' on your inner thigh. Photo proof." />

                {/* 11. Endurance Timer */}
                <SectionLabel text="11. ENDURANCE TIMER" />
                <EnduranceTimer label="Corner Time" icon="□" duration={120} instruction="Face the corner. Camera stays on. 2 minutes." />

                {/* 12. Greed Game */}
                <SectionLabel text="12. GREED GAME" />
                <GreedGame label="Endurance Challenge" icon="↑" ceiling={50} />

                {/* 13. Choose Your Fate */}
                <SectionLabel text="13. CHOOSE YOUR FATE" />
                <ChooseYourFate label="Truth or Dare" icon="?" optionA={{ label: 'TRUTH', desc: 'Confess your most embarrassing moment this week.', followUp: { type: 'writing', prompt: 'Confess your most embarrassing moment this week in detail.', minWords: 80 } }} optionB={{ label: 'DARE', desc: 'Hold ice on your skin for 30 seconds. Video proof.', followUp: { type: 'endurance', duration: 30, instruction: 'Hold ice against your skin. Camera on.' } }} variant="truth_dare" />
                <ChooseYourFate label="Voting Booth" icon="⚖" optionA={{ label: 'Cold shower', desc: '2 minutes cold shower with video proof', followUp: { type: 'endurance', duration: 120, instruction: 'Cold water. Film entire duration.' } }} optionB={{ label: '+2 days locked', desc: 'Two extra days added to your sentence' }} variant="vote" />
                <ChooseYourFate label="Streak Breaker" icon="⚡" optionA={{ label: 'BREAK IT', desc: 'Streak broken. 100 coins gone.' }} optionB={{ label: 'RESIST', desc: 'Streak preserved. +25 bonus coins.' }} variant="streak" />

                {/* 14. Task Chain */}
                <SectionLabel text="14. TIMED TASK CHAIN" />
                <TimedTaskChain label="Simon Says" icon="⚡" tasks={[
                    { text: 'Drop and do 10 pushups', timeLimit: 60 },
                    { text: 'Take a photo of your cage NOW', timeLimit: 45 },
                    { text: 'Write "I obey" 5 times', timeLimit: 30 },
                    { text: 'Hold your breath for 20 seconds', timeLimit: 40 },
                ]} />

                {/* 15. Payment */}
                <SectionLabel text="15. PAYMENT" />
                <Payment label="Tribute" icon="♦" amount={10} variant="tribute" />
                <Payment label="Bid for Mercy" icon="⚖" amount={25} variant="bid" />
            </div>

            <style>{`
                @keyframes vCoinFlip { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
                @keyframes vShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
                @keyframes vFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes vPulseRec { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            `}</style>
        </div>
    );
}

function SectionLabel({ text }: { text: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px' }}>{text}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        </div>
    );
}
