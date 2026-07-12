'use client';

import { useState, useEffect } from 'react';

const TASK_TYPES = [
    { type: 'kneel', label: 'Kneel', color: '#c5a059' },
    { type: 'chastity_check', label: 'Chastity Check', color: '#e03030' },
    { type: 'spin', label: 'Spin Wheel', color: '#a855f7' },
    { type: 'card', label: 'Task Card', color: '#3b82f6' },
    { type: 'tribute', label: 'Tribute', color: '#c5a059' },
    { type: 'journal', label: 'Journal', color: '#4ade80' },
    { type: 'worship', label: 'Worship Message', color: '#f59e0b' },
    { type: 'lines', label: 'Write Lines', color: '#6b7280' },
    { type: 'edge', label: 'Edge', color: '#ec4899' },
    { type: 'denial', label: 'Denial Day', color: '#dc2626' },
    { type: 'confession', label: 'Confession', color: '#8b5cf6' },
    { type: 'cold_shower', label: 'Cold Shower', color: '#06b6d4' },
    { type: 'exercise', label: 'Exercise', color: '#22c55e' },
    { type: 'corner_time', label: 'Corner Time', color: '#78716c' },
    { type: 'body_writing', label: 'Body Writing', color: '#f97316' },
    { type: 'gratitude', label: 'Gratitude List', color: '#10b981' },
    { type: 'quiz', label: 'Quiz', color: '#6366f1' },
    { type: 'essay', label: 'Essay', color: '#14b8a6' },
    { type: 'trial', label: 'Trial', color: '#ef4444' },
];

interface Task {
    type: string;
    target: number;
    label: string;
}

type TabType = 'template' | 'config' | 'member';

interface SpinOption {
    label: string;
    effect: string;
    value: number;
    weight: number;
}

interface CardOption {
    title: string;
    description: string;
    category: string;
}

export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [tab, setTab] = useState<TabType>(initialMember ? 'member' : 'template');
    const [loading, setLoading] = useState(false);

    // Template state
    const [templateDays, setTemplateDays] = useState<Record<string, Task[]>>({});
    const [editingDay, setEditingDay] = useState<number | null>(null);
    const [editTasks, setEditTasks] = useState<Task[]>([]);

    // Config state
    const [spinWheel, setSpinWheel] = useState<SpinOption[]>([]);
    const [cardDeck, setCardDeck] = useState<CardOption[]>([]);
    const [configLoading, setConfigLoading] = useState(false);

    // Member program state
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string, Task[]> | null>(null);
    const [memberEditDay, setMemberEditDay] = useState<number | null>(null);
    const [memberEditTasks, setMemberEditTasks] = useState<Task[]>([]);

    // Load template on mount
    useEffect(() => {
        loadTemplate();
        loadConfig();
        if (initialMember) {
            // Auto-load member program
            setTimeout(() => loadMemberProgram(), 100);
        }
    }, []);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vault/program?template=true');
            const json = await res.json();
            const days: Record<string, Task[]> = {};
            if (json.template && json.template.length > 0) {
                for (const row of json.template) {
                    days[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                }
            }
            setTemplateDays(days);
        } catch { }
        setLoading(false);
    };

    const loadConfig = async () => {
        setConfigLoading(true);
        try {
            const res = await fetch('/api/vault/program?config=true');
            const json = await res.json();
            for (const cfg of (json.config || [])) {
                const val = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
                if (cfg.key === 'spin_wheel') setSpinWheel(val);
                if (cfg.key === 'card_deck') setCardDeck(val);
            }
        } catch { }
        setConfigLoading(false);
    };

    const saveTemplate = async () => {
        setLoading(true);
        await fetch('/api/vault/program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_template', days: templateDays }),
        });
        setLoading(false);
    };

    const generateDefaultTemplate = async () => {
        // Generate from hardcoded defaults via API
        const res = await fetch('/api/vault/program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate_program', memberId: '__template__' }),
        });
        const json = await res.json();
        if (json.error) {
            // No session for __template__ — generate locally
            const days: Record<string, Task[]> = {};
            for (let d = 1; d <= 30; d++) {
                days[String(d)] = _localDefaultTasks(d);
            }
            setTemplateDays(days);
        }
    };

    const saveConfig = async (key: string, value: any) => {
        await fetch('/api/vault/program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_config', key, value }),
        });
    };

    const loadMemberProgram = async () => {
        if (!memberEmail) return;
        setLoading(true);
        const res = await fetch(`/api/vault/program?memberId=${encodeURIComponent(memberEmail)}`);
        const json = await res.json();
        if (json.program?.program) {
            const p = typeof json.program.program === 'string' ? JSON.parse(json.program.program) : json.program.program;
            setMemberProgram(p);
        } else {
            setMemberProgram(null);
        }
        setLoading(false);
    };

    const generateMemberProgram = async () => {
        if (!memberEmail) return;
        setLoading(true);
        await fetch('/api/vault/program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate_program', memberId: memberEmail }),
        });
        await loadMemberProgram();
        setLoading(false);
    };

    const saveMemberDay = async (day: number, tasks: Task[]) => {
        if (!memberEmail) return;
        await fetch('/api/vault/program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_day', memberId: memberEmail, dayNumber: day, tasks }),
        });
        if (memberProgram) {
            setMemberProgram({ ...memberProgram, [String(day)]: tasks });
        }
    };

    const getTaskColor = (type: string) => {
        return TASK_TYPES.find(t => t.type === type)?.color || '#888';
    };

    const getPhaseLabel = (day: number) => {
        if (day <= 7) return 'OBEDIENCE';
        if (day <= 14) return 'DISCIPLINE';
        if (day <= 21) return 'ENDURANCE';
        return 'DEVOTION';
    };

    const getPhaseColor = (day: number) => {
        if (day <= 7) return '#4ade80';
        if (day <= 14) return '#f59e0b';
        if (day <= 21) return '#ef4444';
        return '#a855f7';
    };

    // ── RENDER ──
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#08080c', overflow: 'hidden' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(197,160,89,0.12)', gap: 16 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px' }}>&times;</button>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.9rem', color: '#c5a059', letterSpacing: 4, fontWeight: 700 }}>KEYHOLDER PROGRAM</span>
                <div style={{ flex: 1 }} />
                {/* TABS */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['template', 'config', 'member'] as TabType[]).map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '6px 14px', borderRadius: 6, border: `1px solid ${tab === t ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            background: tab === t ? 'rgba(197,160,89,0.1)' : 'transparent',
                            color: tab === t ? '#c5a059' : 'rgba(255,255,255,0.4)',
                            fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase'
                        }}>
                            {t === 'template' ? 'PROGRAM' : t === 'config' ? 'WHEEL & CARDS' : 'MEMBER'}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {/* ══════════════ TEMPLATE TAB ══════════════ */}
                {tab === 'template' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>30-DAY MASTER TEMPLATE</span>
                            <button onClick={generateDefaultTemplate} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.05)', color: '#c5a059', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', cursor: 'pointer', letterSpacing: 1 }}>
                                GENERATE DEFAULTS
                            </button>
                            {Object.keys(templateDays).length > 0 && (
                                <button onClick={saveTemplate} disabled={loading} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(80,200,80,0.4)', background: 'rgba(80,200,80,0.08)', color: '#4ade80', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', cursor: 'pointer', letterSpacing: 1 }}>
                                    {loading ? 'SAVING...' : 'SAVE TO DB'}
                                </button>
                            )}
                        </div>

                        {Object.keys(templateDays).length === 0 && !loading && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem' }}>
                                No template yet. Click GENERATE DEFAULTS to create the 30-day program.
                            </div>
                        )}

                        {/* DAY GRID */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                            {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                                const tasks = templateDays[String(day)] || [];
                                const isEditing = editingDay === day;
                                return (
                                    <div key={day} style={{
                                        background: 'rgba(255,255,255,0.02)', border: `1px solid ${isEditing ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                        borderRadius: 8, padding: '10px 12px', position: 'relative'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>Day {day}</span>
                                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: getPhaseColor(day), letterSpacing: 2, opacity: 0.7 }}>{getPhaseLabel(day)}</span>
                                            <div style={{ flex: 1 }} />
                                            <button onClick={() => {
                                                if (isEditing) { setEditingDay(null); } else { setEditingDay(day); setEditTasks([...tasks]); }
                                            }} style={{ background: 'none', border: 'none', color: isEditing ? '#c5a059' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', letterSpacing: 1 }}>
                                                {isEditing ? 'CLOSE' : 'EDIT'}
                                            </button>
                                        </div>

                                        {!isEditing ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {tasks.map((t, i) => (
                                                    <span key={i} style={{
                                                        padding: '2px 8px', borderRadius: 4, fontSize: '0.6rem', letterSpacing: 0.5,
                                                        fontFamily: "'Rajdhani', sans-serif", color: getTaskColor(t.type),
                                                        background: `${getTaskColor(t.type)}15`, border: `1px solid ${getTaskColor(t.type)}30`
                                                    }}>
                                                        {t.label || t.type}
                                                    </span>
                                                ))}
                                                {tasks.length === 0 && <span style={{ color: 'rgba(255,255,255,0.15)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem' }}>Empty</span>}
                                            </div>
                                        ) : (
                                            <TaskEditor
                                                tasks={editTasks}
                                                onChange={setEditTasks}
                                                onSave={() => {
                                                    setTemplateDays({ ...templateDays, [String(day)]: editTasks });
                                                    setEditingDay(null);
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ══════════════ CONFIG TAB (Spin Wheel & Cards) ══════════════ */}
                {tab === 'config' && (
                    <div>
                        {/* SPIN WHEEL */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', color: '#a855f7', letterSpacing: 2 }}>SPIN WHEEL OPTIONS</span>
                                <button onClick={() => saveConfig('spin_wheel', spinWheel)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', cursor: 'pointer', letterSpacing: 1 }}>SAVE</button>
                            </div>
                            {spinWheel.map((opt, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <input value={opt.label} onChange={e => { const nw = [...spinWheel]; nw[i] = { ...nw[i], label: e.target.value }; setSpinWheel(nw); }} placeholder="Label" style={{ flex: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <input value={opt.effect} onChange={e => { const nw = [...spinWheel]; nw[i] = { ...nw[i], effect: e.target.value }; setSpinWheel(nw); }} placeholder="Effect" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <input type="number" value={opt.value} onChange={e => { const nw = [...spinWheel]; nw[i] = { ...nw[i], value: Number(e.target.value) }; setSpinWheel(nw); }} placeholder="Val" style={{ width: 50, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <input type="number" value={opt.weight} onChange={e => { const nw = [...spinWheel]; nw[i] = { ...nw[i], weight: Number(e.target.value) }; setSpinWheel(nw); }} placeholder="Wt" style={{ width: 50, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <button onClick={() => { const nw = [...spinWheel]; nw.splice(i, 1); setSpinWheel(nw); }} style={{ background: 'none', border: 'none', color: '#e03030', cursor: 'pointer', fontSize: '0.9rem' }}>&times;</button>
                                </div>
                            ))}
                            <button onClick={() => setSpinWheel([...spinWheel, { label: '', effect: 'add_days', value: 1, weight: 1 }])} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'transparent', color: '#a855f7', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', cursor: 'pointer' }}>+ ADD OPTION</button>
                        </div>

                        {/* CARD DECK */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem', color: '#3b82f6', letterSpacing: 2 }}>TASK CARD DECK</span>
                                <button onClick={() => saveConfig('card_deck', cardDeck)} style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', cursor: 'pointer', letterSpacing: 1 }}>SAVE</button>
                            </div>
                            {cardDeck.map((card, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <input value={card.title} onChange={e => { const nw = [...cardDeck]; nw[i] = { ...nw[i], title: e.target.value }; setCardDeck(nw); }} placeholder="Title" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <input value={card.description} onChange={e => { const nw = [...cardDeck]; nw[i] = { ...nw[i], description: e.target.value }; setCardDeck(nw); }} placeholder="Description" style={{ flex: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <input value={card.category} onChange={e => { const nw = [...cardDeck]; nw[i] = { ...nw[i], category: e.target.value }; setCardDeck(nw); }} placeholder="Category" style={{ width: 80, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.75rem' }} />
                                    <button onClick={() => { const nw = [...cardDeck]; nw.splice(i, 1); setCardDeck(nw); }} style={{ background: 'none', border: 'none', color: '#e03030', cursor: 'pointer', fontSize: '0.9rem' }}>&times;</button>
                                </div>
                            ))}
                            <button onClick={() => setCardDeck([...cardDeck, { title: '', description: '', category: 'pain' }])} style={{ marginTop: 6, padding: '4px 12px', borderRadius: 4, border: '1px solid rgba(59,130,246,0.3)', background: 'transparent', color: '#3b82f6', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', cursor: 'pointer' }}>+ ADD CARD</button>
                        </div>
                    </div>
                )}

                {/* ══════════════ MEMBER TAB ══════════════ */}
                {tab === 'member' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Member email..." style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 12px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem' }} />
                            <button onClick={loadMemberProgram} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(197,160,89,0.4)', background: 'rgba(197,160,89,0.08)', color: '#c5a059', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', cursor: 'pointer', letterSpacing: 1 }}>LOAD</button>
                            <button onClick={generateMemberProgram} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(80,200,80,0.4)', background: 'rgba(80,200,80,0.08)', color: '#4ade80', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', cursor: 'pointer', letterSpacing: 1 }}>GENERATE</button>
                        </div>

                        {memberProgram === null && !loading && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.2)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem' }}>
                                Enter a locked member's email and click LOAD to see their program, or GENERATE to create one from template.
                            </div>
                        )}

                        {memberProgram && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                                {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                                    const tasks = memberProgram[String(day)] || [];
                                    const isEditing = memberEditDay === day;
                                    return (
                                        <div key={day} style={{
                                            background: 'rgba(255,255,255,0.02)', border: `1px solid ${isEditing ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                            borderRadius: 8, padding: '10px 12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>Day {day}</span>
                                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.55rem', color: getPhaseColor(day), letterSpacing: 2, opacity: 0.7 }}>{getPhaseLabel(day)}</span>
                                                <div style={{ flex: 1 }} />
                                                <button onClick={() => {
                                                    if (isEditing) { setMemberEditDay(null); } else { setMemberEditDay(day); setMemberEditTasks([...tasks]); }
                                                }} style={{ background: 'none', border: 'none', color: isEditing ? '#c5a059' : 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', letterSpacing: 1 }}>
                                                    {isEditing ? 'CLOSE' : 'EDIT'}
                                                </button>
                                            </div>

                                            {!isEditing ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {tasks.map((t, i) => (
                                                        <span key={i} style={{
                                                            padding: '2px 8px', borderRadius: 4, fontSize: '0.6rem',
                                                            fontFamily: "'Rajdhani', sans-serif", color: getTaskColor(t.type),
                                                            background: `${getTaskColor(t.type)}15`, border: `1px solid ${getTaskColor(t.type)}30`
                                                        }}>
                                                            {t.label || t.type}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <TaskEditor
                                                    tasks={memberEditTasks}
                                                    onChange={setMemberEditTasks}
                                                    onSave={() => {
                                                        saveMemberDay(day, memberEditTasks);
                                                        setMemberEditDay(null);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Task Editor Component ──
function TaskEditor({ tasks, onChange, onSave }: { tasks: Task[]; onChange: (t: Task[]) => void; onSave: () => void }) {
    const addTask = (type: string) => {
        const info = TASK_TYPES.find(t => t.type === type);
        onChange([...tasks, { type, target: 1, label: info?.label || type }]);
    };

    const removeTask = (idx: number) => {
        const nw = [...tasks];
        nw.splice(idx, 1);
        onChange(nw);
    };

    const updateTask = (idx: number, field: string, value: any) => {
        const nw = [...tasks];
        nw[idx] = { ...nw[idx], [field]: value };
        onChange(nw);
    };

    return (
        <div>
            {tasks.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', color: TASK_TYPES.find(x => x.type === t.type)?.color || '#888', minWidth: 70 }}>{t.type}</span>
                    <input value={t.label} onChange={e => updateTask(i, 'label', e.target.value)} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '2px 6px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem' }} />
                    <input type="number" value={t.target} onChange={e => updateTask(i, 'target', Number(e.target.value))} style={{ width: 40, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '2px 4px', color: '#fff', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.65rem', textAlign: 'center' }} />
                    <button onClick={() => removeTask(i)} style={{ background: 'none', border: 'none', color: '#e03030', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px' }}>&times;</button>
                </div>
            ))}

            {/* Add task dropdown */}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {TASK_TYPES.map(tt => (
                    <button key={tt.type} onClick={() => addTask(tt.type)} style={{
                        padding: '2px 6px', borderRadius: 3, border: `1px solid ${tt.color}40`, background: 'transparent',
                        color: tt.color, fontFamily: "'Rajdhani', sans-serif", fontSize: '0.5rem', cursor: 'pointer', opacity: 0.7
                    }}>+{tt.label}</button>
                ))}
            </div>

            <button onClick={onSave} style={{ marginTop: 8, padding: '4px 14px', borderRadius: 4, border: '1px solid rgba(80,200,80,0.5)', background: 'rgba(80,200,80,0.1)', color: '#4ade80', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.6rem', cursor: 'pointer', letterSpacing: 1, width: '100%' }}>SAVE DAY</button>
        </div>
    );
}

// Local fallback generator (mirrors API _defaultDayTasks)
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
