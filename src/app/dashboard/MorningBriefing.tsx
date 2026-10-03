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
    return `€${n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function typeLabel(type: string) {
    if (type === 'ENTRANCE') return 'ENTRANCE';
    if (type.includes('CRYPTO')) return 'CRYPTO';
    if (type.includes('PAYPAL')) return 'PAYPAL';
    return 'TRIBUTE';
}

export default function MorningBriefing({ onClose }: { onClose: () => void }) {
    const [data, setData] = useState<MorningData | null>(null);
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<MorningPlan>(DEFAULT_PLAN);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    useEffect(() => {
        fetch('/api/morning-briefing')
            .then(r => r.json())
            .then((d: MorningData) => {
                setData(d);
                if (d.plan) setPlan({ ...DEFAULT_PLAN, ...d.plan, tasks: d.plan.tasks?.length ? d.plan.tasks : ['', '', ''] });
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

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(197,160,89,0.15)',
        borderRadius: 6,
        color: '#fff',
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '0.85rem',
        padding: '7px 10px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    const labelStyle: React.CSSProperties = {
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '0.38rem',
        color: 'rgba(197,160,89,0.5)',
        letterSpacing: '2px',
        marginBottom: 5,
        display: 'block',
    };

    const sectionTitle: React.CSSProperties = {
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '0.45rem',
        color: '#c5a059',
        letterSpacing: '3px',
        marginBottom: 12,
        display: 'block',
    };

    return (
        <div style={{ padding: '0 0 40px', minHeight: '100%' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(197,160,89,0.1)' }}>
                <div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '3px', marginBottom: 4 }}>
                        PAGES / DASHBOARD / MORNING BRIEFING
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '1.4rem', color: '#fff', letterSpacing: '2px', fontWeight: 700 }}>
                        Morning Briefing
                    </div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', marginTop: 2 }}>
                        {today}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', letterSpacing: '2px', padding: '7px 14px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(197,160,89,0.4)'; e.currentTarget.style.color = '#c5a059'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                >
                    ← BACK
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(197,160,89,0.15)', borderTopColor: '#c5a059', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px' }}>LOADING YOUR BRIEFING</div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : (
                <>
                    {/* AI Briefing */}
                    {data?.briefing && (
                        <div style={{ background: 'linear-gradient(135deg, rgba(197,160,89,0.06), rgba(197,160,89,0.02))', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 10, padding: '18px 22px', marginBottom: 20 }}>
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '3px', marginBottom: 10 }}>YOUR BRIEFING</div>
                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7, letterSpacing: '0.3px' }}>
                                {data.briefing}
                            </div>
                        </div>
                    )}

                    {/* Two columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                        {/* ── LEFT: EMPIRE ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Revenue */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '16px 18px' }}>
                                <span style={sectionTitle}>REVENUE</span>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                    {[
                                        { label: 'TODAY', value: data?.revenue.today || 0 },
                                        { label: 'THIS WEEK', value: data?.revenue.week || 0 },
                                        { label: 'THIS MONTH', value: data?.revenue.month || 0 },
                                    ].map(({ label, value }) => (
                                        <div key={label} style={{ background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.1)', borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '2px', marginBottom: 6 }}>{label}</div>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '1.1rem', color: value > 0 ? '#c5a059' : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>{fmt(value)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '16px 18px' }}>
                                <span style={sectionTitle}>YOUR EMPIRE</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { label: 'ACTIVE MEMBERS', value: data?.activeMembers || 0, color: '#c5a059' },
                                        { label: 'REVIEW QUEUE', value: data?.queueCount || 0, color: data?.queueCount ? '#e03030' : 'rgba(255,255,255,0.2)' },
                                        { label: 'NEW APPLICATIONS', value: data?.newApps || 0, color: data?.newApps ? '#4ade80' : 'rgba(255,255,255,0.2)' },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px' }}>{label}</span>
                                            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', color, fontWeight: 700 }}>{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recent Tributes */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '16px 18px', flex: 1 }}>
                                <span style={sectionTitle}>RECENT TRIBUTES</span>
                                {data?.recentTributes.length === 0 ? (
                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.45rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center', padding: '20px 0' }}>NO RECENT TRIBUTES</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {data?.recentTributes.map((t, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(197,160,89,0.03)', borderRadius: 6 }}>
                                                <div>
                                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>{t.name}</div>
                                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.35rem', color: 'rgba(197,160,89,0.4)', letterSpacing: '1px', marginTop: 2 }}>{typeLabel(t.type)}</div>
                                                </div>
                                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.88rem', color: '#c5a059', fontWeight: 700 }}>{fmt(t.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── RIGHT: YOUR DAY ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Meals */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '16px 18px' }}>
                                <span style={sectionTitle}>MEALS TODAY</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
                                        <div key={meal}>
                                            <label style={labelStyle}>{meal.toUpperCase()}</label>
                                            <input
                                                style={inputStyle}
                                                placeholder={`What are you eating for ${meal}?`}
                                                value={plan.meals[meal]}
                                                onChange={e => update({ ...plan, meals: { ...plan.meals, [meal]: e.target.value } })}
                                                onFocus={e => { e.target.style.borderColor = 'rgba(197,160,89,0.4)'; }}
                                                onBlur={e => { e.target.style.borderColor = 'rgba(197,160,89,0.15)'; }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Gym */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${plan.gym.enabled ? 'rgba(197,160,89,0.3)' : 'rgba(197,160,89,0.15)'}`, borderRadius: 10, padding: '16px 18px', transition: 'border-color 0.2s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: plan.gym.enabled ? 12 : 0 }}>
                                    <span style={{ ...sectionTitle, marginBottom: 0 }}>GYM</span>
                                    <button
                                        onClick={() => update({ ...plan, gym: { ...plan.gym, enabled: !plan.gym.enabled } })}
                                        style={{
                                            background: plan.gym.enabled ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${plan.gym.enabled ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.1)'}`,
                                            borderRadius: 20,
                                            color: plan.gym.enabled ? '#c5a059' : 'rgba(255,255,255,0.3)',
                                            fontFamily: "'Rajdhani', sans-serif",
                                            fontSize: '0.38rem',
                                            letterSpacing: '2px',
                                            padding: '5px 14px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {plan.gym.enabled ? 'YES' : 'NO'}
                                    </button>
                                </div>
                                {plan.gym.enabled && (
                                    <div>
                                        <label style={labelStyle}>WORKOUT</label>
                                        <input
                                            style={inputStyle}
                                            placeholder="e.g. Leg day, Pull day, Cardio..."
                                            value={plan.gym.workout}
                                            onChange={e => update({ ...plan, gym: { ...plan.gym, workout: e.target.value } })}
                                            onFocus={e => { e.target.style.borderColor = 'rgba(197,160,89,0.4)'; }}
                                            onBlur={e => { e.target.style.borderColor = 'rgba(197,160,89,0.15)'; }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Tasks */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '16px 18px', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <span style={{ ...sectionTitle, marginBottom: 0 }}>TASKS TODAY</span>
                                    <button
                                        onClick={() => update({ ...plan, tasks: [...plan.tasks, ''] })}
                                        style={{ background: 'transparent', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 4, color: 'rgba(197,160,89,0.5)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.7rem', padding: '3px 8px', cursor: 'pointer', lineHeight: 1 }}
                                    >
                                        +
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {plan.tasks.map((task, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(197,160,89,0.3)', flexShrink: 0 }} />
                                            <input
                                                style={{ ...inputStyle, flex: 1 }}
                                                placeholder="Task..."
                                                value={task}
                                                onChange={e => {
                                                    const tasks = [...plan.tasks];
                                                    tasks[i] = e.target.value;
                                                    update({ ...plan, tasks });
                                                }}
                                                onFocus={e => { e.target.style.borderColor = 'rgba(197,160,89,0.4)'; }}
                                                onBlur={e => { e.target.style.borderColor = 'rgba(197,160,89,0.15)'; }}
                                            />
                                            {plan.tasks.length > 1 && (
                                                <button
                                                    onClick={() => update({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) })}
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', flexShrink: 0 }}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(197,160,89,0.15)', borderRadius: 10, padding: '16px 18px' }}>
                                <span style={sectionTitle}>NOTES</span>
                                <textarea
                                    style={{ ...inputStyle, resize: 'none', minHeight: 70, lineHeight: 1.5 }}
                                    placeholder="Anything on your mind today..."
                                    value={plan.notes}
                                    onChange={e => update({ ...plan, notes: e.target.value })}
                                    onFocus={e => { e.target.style.borderColor = 'rgba(197,160,89,0.4)'; }}
                                    onBlur={e => { e.target.style.borderColor = 'rgba(197,160,89,0.15)'; }}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
