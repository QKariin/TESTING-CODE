'use client';

import { useState, useEffect } from 'react';

const F = "'Rajdhani', sans-serif";
const FC = "'Cinzel', serif";
const GOLD = 'rgba(197,160,89,0.85)';
const GOLD_DIM = 'rgba(197,160,89,0.35)';
const RED = 'rgba(139,0,0,0.7)';
const BG = '#0a0a10';
const CARD_BG = 'rgba(255,255,255,0.018)';
const BORDER = 'rgba(255,255,255,0.05)';

const TASK_TYPES: { type: string; label: string; icon: string }[] = [
    { type: 'kneel', label: 'Kneel', icon: '\u25BD' },
    { type: 'chastity_check', label: 'Chastity Check', icon: '\u25C9' },
    { type: 'spin', label: 'Spin Wheel', icon: '\u25CE' },
    { type: 'card', label: 'Task Card', icon: '\u2660' },
    { type: 'tribute', label: 'Tribute', icon: '\u25C6' },
    { type: 'journal', label: 'Journal', icon: '\u270E' },
    { type: 'worship', label: 'Worship', icon: '\u2661' },
    { type: 'lines', label: 'Lines', icon: '\u2261' },
    { type: 'edge', label: 'Edge', icon: '\u2736' },
    { type: 'denial', label: 'Denial', icon: '\u2718' },
    { type: 'confession', label: 'Confession', icon: '\u2767' },
    { type: 'cold_shower', label: 'Cold Shower', icon: '\u2744' },
    { type: 'exercise', label: 'Exercise', icon: '\u2191' },
    { type: 'corner_time', label: 'Corner Time', icon: '\u25A2' },
    { type: 'body_writing', label: 'Body Writing', icon: '\u270D' },
    { type: 'gratitude', label: 'Gratitude', icon: '\u2605' },
    { type: 'quiz', label: 'Quiz', icon: '?' },
    { type: 'essay', label: 'Essay', icon: '\u2016' },
    { type: 'trial', label: 'Trial', icon: '\u2694' },
];

interface Task { type: string; target: number; label: string; }
type TabType = 'template' | 'config' | 'member';
interface SpinOption { label: string; effect: string; value: number; weight: number; }
interface CardOption { title: string; description: string; category: string; }

const PHASES = [
    { name: 'OBEDIENCE', days: [1,2,3,4,5,6,7], color: 'rgba(197,160,89,0.6)' },
    { name: 'DISCIPLINE', days: [8,9,10,11,12,13,14], color: 'rgba(197,160,89,0.5)' },
    { name: 'ENDURANCE', days: [15,16,17,18,19,20,21], color: 'rgba(139,0,0,0.6)' },
    { name: 'DEVOTION', days: [22,23,24,25,26,27,28,29,30], color: 'rgba(139,0,0,0.8)' },
];

const noArrowStyle: React.CSSProperties = {
    MozAppearance: 'textfield',
    WebkitAppearance: 'none',
    appearance: 'textfield' as any,
};

export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [tab, setTab] = useState<TabType>(initialMember ? 'member' : 'template');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [templateDays, setTemplateDays] = useState<Record<string, Task[]>>({});
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [editTasks, setEditTasks] = useState<Task[]>([]);
    const [spinWheel, setSpinWheel] = useState<SpinOption[]>([]);
    const [cardDeck, setCardDeck] = useState<CardOption[]>([]);
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string, Task[]> | null>(null);
    const [memberSelectedDay, setMemberSelectedDay] = useState<number | null>(null);
    const [memberEditTasks, setMemberEditTasks] = useState<Task[]>([]);

    useEffect(() => {
        loadTemplate();
        loadConfig();
        if (initialMember) setTimeout(() => loadMemberProgram(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vault/program?template=true');
            const json = await res.json();
            const days: Record<string, Task[]> = {};
            if (json.template?.length) {
                for (const row of json.template) days[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
            }
            // If DB is empty, auto-generate defaults
            if (Object.keys(days).length === 0) {
                for (let d = 1; d <= 30; d++) days[String(d)] = _localDefaultTasks(d);
            }
            setTemplateDays(days);
        } catch { }
        setLoading(false);
    };

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/vault/program?config=true');
            const json = await res.json();
            for (const cfg of (json.config || [])) {
                const val = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
                if (cfg.key === 'spin_wheel') setSpinWheel(val);
                if (cfg.key === 'card_deck') setCardDeck(val);
            }
        } catch { }
    };

    const saveTemplate = async () => {
        setSaving(true);
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_template', days: templateDays }) });
        setTimeout(() => setSaving(false), 800);
    };

    const saveConfig = async (key: string, value: any) => {
        setSaving(true);
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_config', key, value }) });
        setTimeout(() => setSaving(false), 800);
    };

    const loadMemberProgram = async () => {
        if (!memberEmail) return;
        setLoading(true);
        const res = await fetch(`/api/vault/program?memberId=${encodeURIComponent(memberEmail)}`);
        const json = await res.json();
        if (json.program?.program) {
            setMemberProgram(typeof json.program.program === 'string' ? JSON.parse(json.program.program) : json.program.program);
        } else setMemberProgram(null);
        setLoading(false);
    };

    const generateMemberProgram = async () => {
        if (!memberEmail) return;
        setLoading(true);
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_program', memberId: memberEmail }) });
        await loadMemberProgram();
        setLoading(false);
    };

    const saveMemberDay = async (day: number, tasks: Task[]) => {
        if (!memberEmail) return;
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_day', memberId: memberEmail, dayNumber: day, tasks }) });
        if (memberProgram) setMemberProgram({ ...memberProgram, [String(day)]: tasks });
    };

    const getIcon = (type: string) => TASK_TYPES.find(t => t.type === type)?.icon || '\u2022';

    // ────────────────────────────── RENDER ──────────────────────────────
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: `1px solid ${BORDER}`, gap: 16 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px', lineHeight: 1 }}>&times;</button>
                <span style={{ fontFamily: FC, fontSize: '0.8rem', color: GOLD, letterSpacing: 5, fontWeight: 700 }}>KEYHOLDER PROGRAM</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 2 }}>
                    {([['template','PROGRAM'],['config','WHEEL & CARDS'],['member','MEMBER']] as [TabType,string][]).map(([t,lbl]) => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '5px 16px', borderRadius: 0, border: 'none', borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`,
                            background: 'transparent', color: tab === t ? GOLD : 'rgba(255,255,255,0.25)',
                            fontFamily: F, fontSize: '0.65rem', letterSpacing: 3, cursor: 'pointer',
                        }}>{lbl}</button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>

                {/* ═══════════════════ PROGRAM TAB ═══════════════════ */}
                {tab === 'template' && (
                    <div style={{ display: 'flex', height: '100%' }}>
                        {/* LEFT: Day list */}
                        <div style={{ width: 280, borderRight: `1px solid ${BORDER}`, overflow: 'auto', flexShrink: 0 }}>
                            {/* Save button */}
                            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
                                <button onClick={saveTemplate} disabled={saving} style={{
                                    width: '100%', padding: '8px 0', border: `1px solid ${GOLD_DIM}`, borderRadius: 4,
                                    background: saving ? 'rgba(197,160,89,0.12)' : 'rgba(197,160,89,0.04)',
                                    color: GOLD, fontFamily: F, fontSize: '0.65rem', letterSpacing: 3, cursor: 'pointer',
                                }}>{saving ? 'SAVED' : 'SAVE PROGRAM'}</button>
                            </div>

                            {PHASES.map(phase => (
                                <div key={phase.name}>
                                    <div style={{ padding: '10px 16px 6px', fontFamily: FC, fontSize: '0.5rem', color: phase.color, letterSpacing: 4, borderBottom: `1px solid ${BORDER}` }}>
                                        {phase.name}
                                    </div>
                                    {phase.days.map(day => {
                                        const tasks = templateDays[String(day)] || [];
                                        const isSelected = selectedDay === day;
                                        return (
                                            <div key={day} onClick={() => { setSelectedDay(day); setEditTasks([...tasks]); }}
                                                style={{
                                                    padding: '8px 16px', cursor: 'pointer', borderBottom: `1px solid ${BORDER}`,
                                                    background: isSelected ? 'rgba(197,160,89,0.06)' : 'transparent',
                                                    borderLeft: isSelected ? `2px solid ${GOLD}` : '2px solid transparent',
                                                }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontFamily: F, fontSize: '0.8rem', color: isSelected ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Day {day}</span>
                                                    <span style={{ fontFamily: F, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{tasks.length} tasks</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                                    {tasks.slice(0, 4).map((t, i) => (
                                                        <span key={i} style={{ fontFamily: F, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>{getIcon(t.type)}</span>
                                                    ))}
                                                    {tasks.length > 4 && <span style={{ fontFamily: F, fontSize: '0.5rem', color: 'rgba(255,255,255,0.15)' }}>+{tasks.length - 4}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* RIGHT: Day detail */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
                            {selectedDay === null ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.12)', fontFamily: F, fontSize: '0.85rem', letterSpacing: 2 }}>
                                    Select a day to view & edit tasks
                                </div>
                            ) : (
                                <DayDetail
                                    day={selectedDay}
                                    tasks={editTasks}
                                    onChange={t => setEditTasks(t)}
                                    onSave={() => {
                                        setTemplateDays({ ...templateDays, [String(selectedDay)]: editTasks });
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════════════ CONFIG TAB ═══════════════════ */}
                {tab === 'config' && (
                    <div style={{ padding: '20px 28px', maxWidth: 800 }}>
                        {/* SPIN WHEEL */}
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                <span style={{ fontFamily: FC, fontSize: '0.6rem', color: GOLD, letterSpacing: 4 }}>SPIN WHEEL</span>
                                <div style={{ flex: 1, height: 1, background: BORDER }} />
                                <button onClick={() => saveConfig('spin_wheel', spinWheel)} style={{
                                    padding: '5px 16px', border: `1px solid ${GOLD_DIM}`, borderRadius: 4,
                                    background: saving ? 'rgba(197,160,89,0.1)' : 'transparent',
                                    color: GOLD, fontFamily: F, fontSize: '0.6rem', letterSpacing: 2, cursor: 'pointer',
                                }}>{saving ? 'SAVED' : 'SAVE'}</button>
                            </div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                {spinWheel.map((opt, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 60px 60px 28px', gap: 8, alignItems: 'center' }}>
                                        <input value={opt.label} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], label: e.target.value }; setSpinWheel(n); }}
                                            style={{ ...inputStyle(), fontSize: '0.75rem' }} placeholder="Label" />
                                        <input value={opt.effect} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], effect: e.target.value }; setSpinWheel(n); }}
                                            style={{ ...inputStyle(), fontSize: '0.7rem' }} placeholder="Effect" />
                                        <input value={opt.value} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], value: Number(e.target.value) }; setSpinWheel(n); }}
                                            style={{ ...inputStyle(), ...noArrowStyle, textAlign: 'center', fontSize: '0.75rem' }} placeholder="Val" />
                                        <input value={opt.weight} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], weight: Number(e.target.value) }; setSpinWheel(n); }}
                                            style={{ ...inputStyle(), ...noArrowStyle, textAlign: 'center', fontSize: '0.75rem' }} placeholder="Wt" />
                                        <button onClick={() => { const n = [...spinWheel]; n.splice(i, 1); setSpinWheel(n); }}
                                            style={{ background: 'none', border: 'none', color: 'rgba(139,0,0,0.5)', cursor: 'pointer', fontSize: '0.8rem' }}>&times;</button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setSpinWheel([...spinWheel, { label: '', effect: 'add_days', value: 1, weight: 1 }])}
                                style={{ marginTop: 8, padding: '5px 14px', border: `1px dashed ${BORDER}`, borderRadius: 4, background: 'transparent', color: 'rgba(255,255,255,0.25)', fontFamily: F, fontSize: '0.6rem', cursor: 'pointer', letterSpacing: 1 }}>+ ADD OPTION</button>
                        </div>

                        {/* CARD DECK */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                                <span style={{ fontFamily: FC, fontSize: '0.6rem', color: GOLD, letterSpacing: 4 }}>TASK CARDS</span>
                                <div style={{ flex: 1, height: 1, background: BORDER }} />
                                <button onClick={() => saveConfig('card_deck', cardDeck)} style={{
                                    padding: '5px 16px', border: `1px solid ${GOLD_DIM}`, borderRadius: 4,
                                    background: 'transparent', color: GOLD, fontFamily: F, fontSize: '0.6rem', letterSpacing: 2, cursor: 'pointer',
                                }}>SAVE</button>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {cardDeck.map((card, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr 2fr 80px 28px', gap: 8, alignItems: 'center' }}>
                                        <input value={card.title} onChange={e => { const n = [...cardDeck]; n[i] = { ...n[i], title: e.target.value }; setCardDeck(n); }}
                                            style={{ ...inputStyle(), fontWeight: 600, fontSize: '0.75rem' }} placeholder="Title" />
                                        <input value={card.description} onChange={e => { const n = [...cardDeck]; n[i] = { ...n[i], description: e.target.value }; setCardDeck(n); }}
                                            style={{ ...inputStyle(), fontSize: '0.7rem' }} placeholder="Description" />
                                        <input value={card.category} onChange={e => { const n = [...cardDeck]; n[i] = { ...n[i], category: e.target.value }; setCardDeck(n); }}
                                            style={{ ...inputStyle(), fontSize: '0.65rem', textAlign: 'center' }} placeholder="Category" />
                                        <button onClick={() => { const n = [...cardDeck]; n.splice(i, 1); setCardDeck(n); }}
                                            style={{ background: 'none', border: 'none', color: 'rgba(139,0,0,0.5)', cursor: 'pointer', fontSize: '0.8rem' }}>&times;</button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setCardDeck([...cardDeck, { title: '', description: '', category: '' }])}
                                style={{ marginTop: 8, padding: '5px 14px', border: `1px dashed ${BORDER}`, borderRadius: 4, background: 'transparent', color: 'rgba(255,255,255,0.25)', fontFamily: F, fontSize: '0.6rem', cursor: 'pointer', letterSpacing: 1 }}>+ ADD CARD</button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ MEMBER TAB ═══════════════════ */}
                {tab === 'member' && (
                    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
                        {/* Search bar */}
                        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
                            <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Member email..."
                                style={{ ...inputStyle(), flex: 1, padding: '8px 14px', fontSize: '0.8rem' }} />
                            <button onClick={loadMemberProgram} style={{ padding: '8px 18px', border: `1px solid ${GOLD_DIM}`, borderRadius: 4, background: 'transparent', color: GOLD, fontFamily: F, fontSize: '0.6rem', letterSpacing: 2, cursor: 'pointer' }}>LOAD</button>
                            <button onClick={generateMemberProgram} style={{ padding: '8px 18px', border: `1px solid rgba(139,0,0,0.3)`, borderRadius: 4, background: 'transparent', color: RED, fontFamily: F, fontSize: '0.6rem', letterSpacing: 2, cursor: 'pointer' }}>GENERATE</button>
                        </div>

                        {!memberProgram && !loading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.12)', fontFamily: F, fontSize: '0.8rem', letterSpacing: 2 }}>
                                Enter email and load their program
                            </div>
                        )}

                        {memberProgram && (
                            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                                {/* LEFT: Day list */}
                                <div style={{ width: 280, borderRight: `1px solid ${BORDER}`, overflow: 'auto', flexShrink: 0 }}>
                                    {PHASES.map(phase => (
                                        <div key={phase.name}>
                                            <div style={{ padding: '10px 16px 6px', fontFamily: FC, fontSize: '0.5rem', color: phase.color, letterSpacing: 4, borderBottom: `1px solid ${BORDER}` }}>
                                                {phase.name}
                                            </div>
                                            {phase.days.map(day => {
                                                const tasks = memberProgram[String(day)] || [];
                                                const isSel = memberSelectedDay === day;
                                                return (
                                                    <div key={day} onClick={() => { setMemberSelectedDay(day); setMemberEditTasks([...tasks]); }}
                                                        style={{
                                                            padding: '8px 16px', cursor: 'pointer', borderBottom: `1px solid ${BORDER}`,
                                                            background: isSel ? 'rgba(197,160,89,0.06)' : 'transparent',
                                                            borderLeft: isSel ? `2px solid ${GOLD}` : '2px solid transparent',
                                                        }}>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ fontFamily: F, fontSize: '0.8rem', color: isSel ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Day {day}</span>
                                                            <span style={{ fontFamily: F, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>{tasks.length} tasks</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                            {tasks.slice(0, 4).map((t, i) => (
                                                                <span key={i} style={{ fontFamily: F, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>{getIcon(t.type)}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {/* RIGHT: Day detail */}
                                <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
                                    {memberSelectedDay === null ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.12)', fontFamily: F, fontSize: '0.85rem', letterSpacing: 2 }}>
                                            Select a day
                                        </div>
                                    ) : (
                                        <DayDetail
                                            day={memberSelectedDay}
                                            tasks={memberEditTasks}
                                            onChange={t => setMemberEditTasks(t)}
                                            onSave={() => saveMemberDay(memberSelectedDay, memberEditTasks)}
                                            isMember
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Global style to hide number spinners */}
            <style>{`
                input[type=number]::-webkit-inner-spin-button,
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
}

// ── Shared input style ──
function inputStyle(): React.CSSProperties {
    return {
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        padding: '5px 10px',
        color: 'rgba(255,255,255,0.7)',
        fontFamily: F,
        fontSize: '0.75rem',
        outline: 'none',
    };
}

// ── Day Detail Panel ──
function DayDetail({ day, tasks, onChange, onSave, isMember }: {
    day: number; tasks: Task[]; onChange: (t: Task[]) => void; onSave: () => void; isMember?: boolean;
}) {
    const phase = day <= 7 ? 'OBEDIENCE' : day <= 14 ? 'DISCIPLINE' : day <= 21 ? 'ENDURANCE' : 'DEVOTION';
    const phaseColor = day <= 7 ? 'rgba(197,160,89,0.6)' : day <= 14 ? 'rgba(197,160,89,0.5)' : day <= 21 ? 'rgba(139,0,0,0.6)' : 'rgba(139,0,0,0.8)';
    const [saved, setSaved] = useState(false);

    const addTask = (type: string) => {
        const info = TASK_TYPES.find(t => t.type === type);
        onChange([...tasks, { type, target: 1, label: info?.label || type }]);
    };

    const removeTask = (idx: number) => {
        const n = [...tasks]; n.splice(idx, 1); onChange(n);
    };

    const updateTask = (idx: number, field: string, value: any) => {
        const n = [...tasks]; n[idx] = { ...n[idx], [field]: value }; onChange(n);
    };

    const handleSave = () => {
        onSave();
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
    };

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontFamily: F, fontSize: '1.4rem', color: '#fff', fontWeight: 700 }}>Day {day}</span>
                <span style={{ fontFamily: FC, fontSize: '0.5rem', color: phaseColor, letterSpacing: 4 }}>{phase}</span>
                <div style={{ flex: 1 }} />
                <button onClick={handleSave} style={{
                    padding: '6px 20px', border: `1px solid ${saved ? 'rgba(80,200,80,0.4)' : GOLD_DIM}`, borderRadius: 4,
                    background: saved ? 'rgba(80,200,80,0.06)' : 'transparent',
                    color: saved ? 'rgba(80,200,80,0.8)' : GOLD, fontFamily: F, fontSize: '0.6rem', letterSpacing: 3, cursor: 'pointer',
                }}>{saved ? 'SAVED' : isMember ? 'SAVE FOR USER' : 'UPDATE'}</button>
            </div>

            <div style={{ width: '100%', height: 1, background: BORDER, marginBottom: 20 }} />

            {/* Task list */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
                {tasks.map((t, i) => {
                    const icon = TASK_TYPES.find(x => x.type === t.type)?.icon || '\u2022';
                    return (
                        <div key={i} style={{
                            display: 'grid', gridTemplateColumns: '28px 1fr 60px 28px', gap: 12, alignItems: 'center',
                            padding: '10px 14px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 6,
                        }}>
                            <span style={{ fontFamily: F, fontSize: '0.9rem', color: 'rgba(197,160,89,0.4)', textAlign: 'center' }}>{icon}</span>
                            <input value={t.label} onChange={e => updateTask(i, 'label', e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontFamily: F, fontSize: '0.8rem', outline: 'none', padding: 0 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontFamily: F, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>x</span>
                                <input type="number" value={t.target} onChange={e => updateTask(i, 'target', Number(e.target.value))}
                                    style={{ ...noArrowStyle, width: 36, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 3, padding: '3px 6px', color: GOLD, fontFamily: F, fontSize: '0.8rem', textAlign: 'center', outline: 'none' }} />
                            </div>
                            <button onClick={() => removeTask(i)}
                                style={{ background: 'none', border: 'none', color: 'rgba(139,0,0,0.4)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>&times;</button>
                        </div>
                    );
                })}
            </div>

            {/* Add task */}
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: FC, fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', letterSpacing: 3, marginBottom: 10 }}>ADD TASK</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TASK_TYPES.map(tt => (
                        <button key={tt.type} onClick={() => addTask(tt.type)} style={{
                            padding: '4px 10px', borderRadius: 4, border: `1px solid ${BORDER}`,
                            background: 'transparent', color: 'rgba(255,255,255,0.3)', fontFamily: F, fontSize: '0.6rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.3)'; e.currentTarget.style.color = 'rgba(197,160,89,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                        >
                            <span style={{ fontSize: '0.7rem' }}>{tt.icon}</span>
                            {tt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Local fallback generator ──
function _localDefaultTasks(day: number): Task[] {
    const kt = day <= 3 ? 4 : day <= 6 ? 6 : day <= 11 ? 8 : day <= 14 ? 10 : day <= 19 ? 12 : day <= 24 ? 14 : day <= 27 ? 16 : day <= 29 ? 18 : 20;
    const tasks: Task[] = [
        { type: 'kneel', target: kt, label: `Kneel ${kt} times` },
        { type: 'chastity_check', target: 1, label: 'Chastity check photo' },
    ];
    if (day === 1) tasks.push({ type: 'journal', target: 1, label: 'Journal: "Why I submitted"' });
    if (day === 2) tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' });
    if (day === 3) tasks.push({ type: 'lines', target: 30, label: 'Write lines x30' });
    if (day === 4) tasks.push({ type: 'tribute', target: 3, label: 'Tribute 3 coins' });
    if (day === 5) tasks.push({ type: 'worship', target: 1, label: 'Worship message' });
    if (day === 6) tasks.push({ type: 'card', target: 1, label: 'Draw a task card' });
    if (day === 7) { tasks.push({ type: 'cold_shower', target: 60, label: 'Cold shower 60s' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    if (day === 8) { tasks.push({ type: 'edge', target: 3, label: 'Edge 3 times' }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
    if (day === 9) { tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'tribute', target: 5, label: 'Tribute 5 coins' }); }
    if (day === 10) { tasks.push({ type: 'lines', target: 50, label: 'Write lines x50' }); tasks.push({ type: 'corner_time', target: 10, label: 'Corner time 10min' }); }
    if (day === 11) tasks.push({ type: 'body_writing', target: 1, label: 'Body writing: OWNED' });
    if (day === 12) { tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); }
    if (day === 13) { tasks.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); tasks.push({ type: 'gratitude', target: 5, label: 'Gratitude list (5 things)' }); }
    if (day === 14) { tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    if (day === 15) { tasks.push({ type: 'exercise', target: 50, label: 'Exercise: 50 pushups' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); }
    if (day === 16) { tasks.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); tasks.push({ type: 'lines', target: 75, label: 'Write lines x75' }); }
    if (day === 17) { tasks.push({ type: 'quiz', target: 1, label: "Quiz: Queen's rules" }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
    if (day === 18) { tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); tasks.push({ type: 'corner_time', target: 15, label: 'Corner time 15min' }); }
    if (day === 19) { tasks.push({ type: 'body_writing', target: 1, label: 'Body writing photo' }); tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); }
    if (day === 20) { tasks.push({ type: 'cold_shower', target: 90, label: 'Cold shower 90s' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); tasks.push({ type: 'edge', target: 5, label: 'Edge 5x' }); }
    if (day === 21) { tasks.push({ type: 'denial', target: 1, label: 'Denial day (no touching 24h)' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); }
    if (day === 22) { tasks.push({ type: 'tribute', target: 15, label: 'Tribute 15 coins' }); tasks.push({ type: 'gratitude', target: 10, label: 'Gratitude list (10 things)' }); }
    if (day === 23) { tasks.push({ type: 'edge', target: 7, label: 'Edge 7 times' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'lines', target: 100, label: 'Write lines x100' }); }
    if (day === 24) { tasks.push({ type: 'exercise', target: 75, label: 'Exercise: 75 pushups' }); tasks.push({ type: 'body_writing', target: 1, label: 'Body writing' }); tasks.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
    if (day === 25) { tasks.push({ type: 'card', target: 1, label: 'Draw a task card' }); tasks.push({ type: 'corner_time', target: 20, label: 'Corner time 20min' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); }
    if (day === 26) { tasks.push({ type: 'cold_shower', target: 120, label: 'Cold shower 120s' }); tasks.push({ type: 'edge', target: 7, label: 'Edge 7x' }); tasks.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); }
    if (day === 27) { tasks.push({ type: 'denial', target: 1, label: 'Denial day' }); tasks.push({ type: 'essay', target: 1, label: "Essay: What I've learned" }); }
    if (day === 28) { tasks.push({ type: 'quiz', target: 1, label: 'Quiz' }); tasks.push({ type: 'confession', target: 1, label: 'Confession' }); tasks.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); tasks.push({ type: 'lines', target: 100, label: 'Lines x100' }); }
    if (day === 29) { tasks.push({ type: 'edge', target: 10, label: 'Edge 10 times' }); tasks.push({ type: 'tribute', target: 20, label: 'Tribute 20 coins' }); tasks.push({ type: 'exercise', target: 100, label: 'Exercise: 100 pushups' }); }
    if (day === 30) { tasks.push({ type: 'journal', target: 1, label: 'Final devotion journal' }); tasks.push({ type: 'worship', target: 1, label: 'Worship message' }); tasks.push({ type: 'gratitude', target: 10, label: 'Gratitude (10 things)' }); tasks.push({ type: 'body_writing', target: 1, label: 'Body writing' }); tasks.push({ type: 'tribute', target: 25, label: 'Tribute 25 coins' }); }
    return tasks;
}
