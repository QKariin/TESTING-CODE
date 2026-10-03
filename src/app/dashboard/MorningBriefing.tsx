'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

interface MorningPlan {
    meals: { breakfast: string; lunch: string; dinner: string };
    gym: { enabled: boolean; workout: string };
    tasks: string[];
    notes: string;
}

interface MorningData {
    revenue: { today: number; week: number; month: number; allTime: number };
    activeMembers: number;
    queueCount: number;
    newApps: number;
    recentTributes: { amount: number; name: string; type: string; timestamp: string }[];
    plan: MorningPlan;
    briefing: string;
}

const DEFAULT_PLAN: MorningPlan = {
    meals: { breakfast: '', lunch: '', dinner: '' },
    gym: { enabled: false, workout: '' },
    tasks: ['', '', ''],
    notes: '',
};

function fmt(n: number) {
    if (n === 0) return '—';
    return `€${Math.round(n).toLocaleString('en')}`;
}

function typeLabel(type: string) {
    if (type === 'ENTRANCE') return 'ENTRANCE';
    if (type.includes('CRYPTO')) return 'CRYPTO';
    if (type.includes('PAYPAL')) return 'PAYPAL';
    return 'TRIBUTE';
}

function Divider({ label }: { label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '36px 0 28px' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(197,160,89,0.2))' }} />
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.33rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '5px' }}>{label}</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(197,160,89,0.2))' }} />
        </div>
    );
}

function BigStat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
    return (
        <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{
                fontFamily: "'Cinzel', serif",
                fontSize: '1.9rem',
                fontWeight: 700,
                color: gold && value !== '—' ? '#c5a059' : value === '—' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
                lineHeight: 1,
                letterSpacing: '1px',
            }}>
                {value}
            </div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '4px', marginTop: 10 }}>
                {label}
            </div>
        </div>
    );
}

const fieldStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(197,160,89,0.12)',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.88rem',
    padding: '10px 0',
    outline: 'none',
    width: '100%',
    letterSpacing: '0.5px',
    transition: 'border-color 0.2s',
};

export default function MorningBriefing({ onClose }: { onClose: () => void }) {
    const [data, setData] = useState<MorningData | null>(null);
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<MorningPlan>(DEFAULT_PLAN);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).toUpperCase();

    useEffect(() => {
        fetch('/api/morning-briefing')
            .then(r => r.json())
            .then((d: MorningData) => {
                setData(d);
                if (d.plan) {
                    setPlan({ ...DEFAULT_PLAN, ...d.plan, tasks: d.plan.tasks?.length ? d.plan.tasks : ['', '', ''] });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const savePlan = useCallback((p: MorningPlan) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            fetch('/api/morning-briefing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: p }),
            });
        }, 800);
    }, []);

    const update = (p: MorningPlan) => { setPlan(p); savePlan(p); };

    return (
        <div style={{ padding: '36px 32px 80px', minHeight: '100%', boxSizing: 'border-box' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .mb-input:focus { border-bottom-color: rgba(197,160,89,0.5) !important; }
                .mb-back:hover { border-color: rgba(197,160,89,0.35) !important; color: #c5a059 !important; }
            `}</style>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
                <div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '5px', marginBottom: 14 }}>
                        {dateStr}
                    </div>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.7rem', fontWeight: 700, color: '#fff', letterSpacing: '3px', lineHeight: 1.15 }}>
                        GOOD MORNING,<br />
                        <span style={{ color: '#c5a059' }}>QUEEN KARIN</span>
                    </div>
                </div>
                <button
                    className="mb-back"
                    onClick={onClose}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', letterSpacing: '3px', padding: '9px 18px', cursor: 'pointer', transition: 'all 0.2s', marginTop: 4 }}
                >
                    ← BACK
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 20 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.15)', borderTopColor: 'rgba(197,160,89,0.6)', animation: 'spin 0.9s linear infinite' }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', color: 'rgba(255,255,255,0.12)', letterSpacing: '5px' }}>PREPARING YOUR BRIEFING</div>
                </div>
            ) : (
                <>
                    {/* AI Briefing */}
                    {data?.briefing && (
                        <div style={{ borderLeft: '2px solid rgba(197,160,89,0.25)', paddingLeft: 24, marginBottom: 52, maxWidth: 680 }}>
                            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 2, letterSpacing: '0.3px' }}>
                                {data.briefing}
                            </div>
                        </div>
                    )}

                    {/* Two-column layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', columnGap: 0 }}>

                        {/* ── LEFT: EMPIRE ── */}
                        <div style={{ paddingRight: 48 }}>

                            <Divider label="REVENUE" />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, marginBottom: 48 }}>
                                <BigStat value={fmt(data?.revenue.today || 0)} label="TODAY" gold />
                                <BigStat value={fmt(data?.revenue.week || 0)} label="THIS WEEK" gold />
                                <BigStat value={fmt(data?.revenue.month || 0)} label="THIS MONTH" gold />
                            </div>

                            <Divider label="YOUR EMPIRE" />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, marginBottom: 48 }}>
                                <BigStat value={String(data?.activeMembers || 0)} label="ACTIVE MEMBERS" />
                                <BigStat value={String(data?.queueCount || 0)} label="REVIEW QUEUE" />
                                <BigStat value={String(data?.newApps || 0)} label="APPLICATIONS" />
                            </div>

                            <Divider label="TRIBUTES" />

                            {!data?.recentTributes.length ? (
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '3px', textAlign: 'center', padding: '24px 0' }}>
                                    NO RECENT TRIBUTES
                                </div>
                            ) : (
                                <div>
                                    {data.recentTributes.map((t, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.5px' }}>
                                                {t.name}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexShrink: 0 }}>
                                                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '3px' }}>
                                                    {typeLabel(t.type)}
                                                </span>
                                                <span style={{ fontFamily: "'Cinzel', serif", fontSize: '0.88rem', color: '#c5a059', fontWeight: 700 }}>
                                                    {fmt(t.amount)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vertical divider */}
                        <div style={{ background: 'linear-gradient(to bottom, transparent, rgba(197,160,89,0.15) 30%, rgba(197,160,89,0.15) 70%, transparent)' }} />

                        {/* ── RIGHT: TODAY ── */}
                        <div style={{ paddingLeft: 48 }}>

                            <Divider label="TODAY" />

                            {/* Meals */}
                            <div style={{ marginBottom: 40 }}>
                                {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
                                    <div key={meal} style={{ marginBottom: 24 }}>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '4px', marginBottom: 4 }}>
                                            {meal.toUpperCase()}
                                        </div>
                                        <input
                                            className="mb-input"
                                            style={fieldStyle}
                                            placeholder={`What are you eating?`}
                                            value={plan.meals[meal]}
                                            onChange={e => update({ ...plan, meals: { ...plan.meals, [meal]: e.target.value } })}
                                        />
                                    </div>
                                ))}
                            </div>

                            <Divider label="GYM" />

                            {/* Gym toggle */}
                            <div style={{ marginBottom: 40 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: plan.gym.enabled ? 20 : 0 }}>
                                    {['YES', 'NO'].map(opt => {
                                        const active = opt === 'YES' ? plan.gym.enabled : !plan.gym.enabled;
                                        return (
                                            <button
                                                key={opt}
                                                onClick={() => update({ ...plan, gym: { ...plan.gym, enabled: opt === 'YES' } })}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    fontFamily: "'Cinzel', serif",
                                                    fontSize: '0.9rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '3px',
                                                    color: active ? '#c5a059' : 'rgba(255,255,255,0.12)',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    transition: 'color 0.2s',
                                                }}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                                {plan.gym.enabled && (
                                    <div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '4px', marginBottom: 4 }}>
                                            WORKOUT
                                        </div>
                                        <input
                                            className="mb-input"
                                            style={fieldStyle}
                                            placeholder="Leg day, pull day, cardio..."
                                            value={plan.gym.workout}
                                            onChange={e => update({ ...plan, gym: { ...plan.gym, workout: e.target.value } })}
                                        />
                                    </div>
                                )}
                            </div>

                            <Divider label="TASKS" />

                            {/* Tasks */}
                            <div style={{ marginBottom: 40 }}>
                                {plan.tasks.map((task, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(197,160,89,0.3)', flexShrink: 0 }} />
                                        <input
                                            className="mb-input"
                                            style={{ ...fieldStyle, flex: 1 }}
                                            placeholder="Task..."
                                            value={task}
                                            onChange={e => {
                                                const tasks = [...plan.tasks];
                                                tasks[i] = e.target.value;
                                                update({ ...plan, tasks });
                                            }}
                                        />
                                        {plan.tasks.length > 1 && (
                                            <button
                                                onClick={() => update({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) })}
                                                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '1rem', padding: '0 2px', flexShrink: 0, lineHeight: 1, transition: 'color 0.2s' }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(197,160,89,0.4)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.1)'; }}
                                            >
                                                &#215;
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={() => update({ ...plan, tasks: [...plan.tasks, ''] })}
                                    style={{ background: 'transparent', border: 'none', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '3px', cursor: 'pointer', padding: '14px 0 0', transition: 'color 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(197,160,89,0.7)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(197,160,89,0.3)'; }}
                                >
                                    + ADD TASK
                                </button>
                            </div>

                            <Divider label="NOTES" />

                            <textarea
                                className="mb-input"
                                style={{ ...fieldStyle, resize: 'none', minHeight: 100, lineHeight: 1.8, borderBottom: '1px solid rgba(197,160,89,0.12)' }}
                                placeholder="Anything on your mind today..."
                                value={plan.notes}
                                onChange={e => update({ ...plan, notes: e.target.value })}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
