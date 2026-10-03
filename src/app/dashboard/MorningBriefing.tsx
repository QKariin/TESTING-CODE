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
    chartData: { label: string; value: number }[];
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
    if (!n) return '€0';
    return `€${Math.round(n).toLocaleString('en')}`;
}

function timeAgo(ts: string) {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function typeLabel(t: string) {
    if (t === 'ENTRANCE') return 'ENTRANCE';
    if (t.includes('CRYPTO')) return 'CRYPTO';
    if (t.includes('PAYPAL')) return 'PAYPAL';
    return 'TRIBUTE';
}

function Panel({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.018)',
            border: '1px solid rgba(197,160,89,0.1)',
            borderRadius: 12,
            overflow: 'hidden',
            ...style,
        }}>
            <div style={{
                padding: '14px 20px 12px',
                borderBottom: '1px solid rgba(197,160,89,0.07)',
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: '0.32rem',
                color: 'rgba(197,160,89,0.45)',
                letterSpacing: '5px',
            }}>
                {title}
            </div>
            <div style={{ padding: '18px 20px 20px' }}>
                {children}
            </div>
        </div>
    );
}

function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
    if (!data?.length) return null;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const W = 480, H = 130;
    const barW = 38, gap = 22;
    const totalW = data.length * (barW + gap) - gap;
    const startX = (W - totalW) / 2;
    const padTop = 22, padBot = 22;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(197,160,89,0.9)" />
                    <stop offset="100%" stopColor="rgba(197,160,89,0.25)" />
                </linearGradient>
                <linearGradient id="barDim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(197,160,89,0.25)" />
                    <stop offset="100%" stopColor="rgba(197,160,89,0.06)" />
                </linearGradient>
            </defs>
            {data.map((d, i) => {
                const x = startX + i * (barW + gap);
                const barH = Math.max(3, ((d.value || 0) / maxVal) * (H - padTop - padBot));
                const y = H - padBot - barH;
                const isToday = i === data.length - 1;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={barW} height={barH} rx={4}
                            fill={isToday ? 'url(#barGrad)' : 'url(#barDim)'}
                        />
                        {d.value > 0 && (
                            <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                                fontFamily="Rajdhani" fontSize="7.5"
                                fill={isToday ? 'rgba(197,160,89,0.9)' : 'rgba(197,160,89,0.5)'}>
                                {d.value >= 1000 ? `€${(d.value / 1000).toFixed(1)}k` : `€${Math.round(d.value)}`}
                            </text>
                        )}
                        <text x={x + barW / 2} y={H - 5} textAnchor="middle"
                            fontFamily="Rajdhani" fontSize="8"
                            fill={isToday ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)'}>
                            {d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(197,160,89,0.12)',
    color: 'rgba(255,255,255,0.75)',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.88rem',
    padding: '9px 0',
    outline: 'none',
    width: '100%',
    letterSpacing: '0.5px',
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

    return (
        <div style={{ minHeight: '100%', boxSizing: 'border-box' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
                .mb-in:focus { border-bottom-color: rgba(197,160,89,0.45) !important; color: rgba(255,255,255,0.95) !important; }
                .mb-back:hover { border-color: rgba(197,160,89,0.3) !important; color: rgba(197,160,89,0.8) !important; }
            `}</style>

            {/* ── HEADER ── */}
            <div style={{ padding: '28px 28px 24px', borderBottom: '1px solid rgba(197,160,89,0.07)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '5px', marginBottom: 10 }}>
                        {dateStr}
                    </div>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.55rem', fontWeight: 700, color: '#fff', letterSpacing: '2px', lineHeight: 1.2 }}>
                        GOOD MORNING,{' '}
                        <span style={{ color: '#c5a059' }}>QUEEN KARIN</span>
                    </div>
                </div>
                <button
                    className="mb-back"
                    onClick={onClose}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.38rem', letterSpacing: '3px', padding: '8px 16px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, marginBottom: 4 }}
                >
                    ← BACK
                </button>
            </div>

            {/* ── AI BRIEFING ── */}
            {!loading && data?.briefing && (
                <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(197,160,89,0.07)', background: 'rgba(197,160,89,0.025)' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        <div style={{ width: 2, background: 'linear-gradient(to bottom, rgba(197,160,89,0.6), rgba(197,160,89,0.1))', borderRadius: 2, flexShrink: 0, alignSelf: 'stretch', minHeight: 40 }} />
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.95, letterSpacing: '0.2px' }}>
                            {data.briefing}
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 20 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(197,160,89,0.15)', borderTopColor: 'rgba(197,160,89,0.7)', animation: 'spin 0.85s linear infinite' }} />
                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(255,255,255,0.1)', letterSpacing: '5px', animation: 'pulse 2s ease-in-out infinite' }}>PREPARING YOUR BRIEFING</div>
                </div>
            ) : (
                <div style={{ padding: '24px 28px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                    {/* ── LEFT COLUMN ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Revenue Chart Panel */}
                        <Panel title="REVENUE — LAST 7 DAYS">
                            <RevenueChart data={data?.chartData || []} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(197,160,89,0.07)' }}>
                                {[
                                    { label: 'TODAY', value: data?.revenue.today || 0 },
                                    { label: 'THIS WEEK', value: data?.revenue.week || 0 },
                                    { label: 'THIS MONTH', value: data?.revenue.month || 0 },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ textAlign: 'center' }}>
                                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '1.3rem', fontWeight: 700, color: value > 0 ? '#c5a059' : 'rgba(255,255,255,0.1)', lineHeight: 1 }}>
                                            {fmt(value)}
                                        </div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '3px', marginTop: 7 }}>
                                            {label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        {/* Tribute Log Panel */}
                        <Panel title="TRIBUTE ACTIVITY" style={{ flex: 1 }}>
                            {!data?.recentTributes.length ? (
                                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.42rem', color: 'rgba(255,255,255,0.08)', letterSpacing: '3px', textAlign: 'center', padding: '28px 0' }}>
                                    NO RECENT TRIBUTES
                                </div>
                            ) : (
                                <div>
                                    {/* Table header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 16px', padding: '0 0 10px', borderBottom: '1px solid rgba(197,160,89,0.07)', marginBottom: 4 }}>
                                        {['NAME', 'TYPE', 'AMOUNT', 'WHEN'].map(h => (
                                            <div key={h} style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '3px' }}>{h}</div>
                                        ))}
                                    </div>
                                    {data.recentTributes.map((t, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 16px', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {t.name}
                                            </div>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '2px', whiteSpace: 'nowrap' }}>
                                                {typeLabel(t.type)}
                                            </div>
                                            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '0.82rem', color: '#c5a059', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                {fmt(t.amount)}
                                            </div>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                {timeAgo(t.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </div>

                    {/* ── RIGHT COLUMN ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Empire Status Panel */}
                        <Panel title="EMPIRE STATUS">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                                {[
                                    { value: data?.activeMembers ?? 0, label: 'ACTIVE MEMBERS', accent: false },
                                    { value: data?.queueCount ?? 0, label: 'REVIEW QUEUE', accent: (data?.queueCount || 0) > 0 },
                                    { value: data?.newApps ?? 0, label: 'APPLICATIONS', accent: (data?.newApps || 0) > 0 },
                                ].map(({ value, label, accent }) => (
                                    <div key={label} style={{ textAlign: 'center', padding: '4px 0' }}>
                                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '2rem', fontWeight: 700, color: accent ? '#c5a059' : 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
                                            {value}
                                        </div>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(255,255,255,0.18)', letterSpacing: '3px', marginTop: 8 }}>
                                            {label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        {/* Today Plan Panel */}
                        <Panel title="TODAY" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                                {/* Meals */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '4px', marginBottom: 12 }}>
                                        MEALS
                                    </div>
                                    {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
                                        <div key={meal} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', marginBottom: 4 }}>
                                            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.32rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '2px' }}>
                                                {meal.toUpperCase()}
                                            </div>
                                            <input
                                                className="mb-in"
                                                style={inputStyle}
                                                placeholder="—"
                                                value={plan.meals[meal]}
                                                onChange={e => update({ ...plan, meals: { ...plan.meals, [meal]: e.target.value } })}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div style={{ height: 1, background: 'rgba(197,160,89,0.07)', margin: '4px 0 20px' }} />

                                {/* Gym */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '4px', marginBottom: 12 }}>
                                        GYM
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: plan.gym.enabled ? 12 : 0 }}>
                                        {['YES', 'NO'].map(opt => {
                                            const active = opt === 'YES' ? plan.gym.enabled : !plan.gym.enabled;
                                            return (
                                                <button key={opt} onClick={() => update({ ...plan, gym: { ...plan.gym, enabled: opt === 'YES' } })}
                                                    style={{ background: 'transparent', border: 'none', fontFamily: "'Cinzel', serif", fontSize: '0.88rem', fontWeight: 700, letterSpacing: '2px', color: active ? '#c5a059' : 'rgba(255,255,255,0.1)', cursor: 'pointer', padding: 0, transition: 'color 0.2s' }}>
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {plan.gym.enabled && (
                                        <input className="mb-in" style={inputStyle} placeholder="Leg day, cardio, push..." value={plan.gym.workout}
                                            onChange={e => update({ ...plan, gym: { ...plan.gym, workout: e.target.value } })} />
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ height: 1, background: 'rgba(197,160,89,0.07)', margin: '4px 0 20px' }} />

                                {/* Tasks */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '4px' }}>TASKS</div>
                                        <button onClick={() => update({ ...plan, tasks: [...plan.tasks, ''] })}
                                            style={{ background: 'transparent', border: 'none', fontFamily: "'Rajdhani', sans-serif", fontSize: '0.3rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '2px', cursor: 'pointer', padding: 0 }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(197,160,89,0.8)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(197,160,89,0.3)'; }}>
                                            + ADD
                                        </button>
                                    </div>
                                    {plan.tasks.map((task, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 2 }}>
                                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(197,160,89,0.35)', flexShrink: 0 }} />
                                            <input className="mb-in" style={{ ...inputStyle, flex: 1 }} placeholder="Task..." value={task}
                                                onChange={e => { const tasks = [...plan.tasks]; tasks[i] = e.target.value; update({ ...plan, tasks }); }} />
                                            {plan.tasks.length > 1 && (
                                                <button onClick={() => update({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) })}
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', flexShrink: 0, transition: 'color 0.2s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(197,160,89,0.5)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.1)'; }}>
                                                    &#215;
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div style={{ height: 1, background: 'rgba(197,160,89,0.07)', margin: '4px 0 20px' }} />

                                {/* Notes */}
                                <div>
                                    <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.28rem', color: 'rgba(197,160,89,0.3)', letterSpacing: '4px', marginBottom: 12 }}>NOTES</div>
                                    <textarea className="mb-in"
                                        style={{ ...inputStyle, resize: 'none', minHeight: 80, lineHeight: 1.7, borderBottom: '1px solid rgba(197,160,89,0.12)', display: 'block' }}
                                        placeholder="Anything on your mind today..."
                                        value={plan.notes}
                                        onChange={e => update({ ...plan, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            )}
        </div>
    );
}
