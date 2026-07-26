'use client';
import { useState, useCallback, useEffect } from 'react';
import MechRunner, { MECH_ICON } from '@/components/MechRunner';
import { MECH_PRESETS, MECH_BY_ID } from '@/lib/mechanisms';
import { defaultDayTasks } from '@/lib/vault-program-defaults';

const BG = 'linear-gradient(rgba(4,3,10,0.82) 0%,rgba(4,3,10,0.92) 100%),url(/work-bg.jpg) center top/cover no-repeat';
const R = 'rgba(139,0,0,';

// Map old DB shorthand types → MechRunner types
const TYPE_MAP: Record<string, string> = {
    spin: 'spin_wheel',
    card: 'card_pick',
};
const normalizeType = (t: string) => TYPE_MAP[t] || t;

// Get config for a task — uses embedded config first, then MECH_PRESETS fallback
function resolveConfig(task: any): any {
    if (task.config && Object.keys(task.config).length > 0) return task.config;
    const t = normalizeType(task.type);
    return MECH_PRESETS[t]?.[0]?.config ?? {};
}

const PREVIEW_PROFILE = { name: 'Preview', member_id: 'preview@test.com', memberId: 'preview-id', wallet: 1200, skippass: 2 };

const PHASES = [
    { label: 'OBEDIENCE', days: [1,2,3,4,5,6,7], color: '#c5a059' },
    { label: 'DISCIPLINE', days: [8,9,10,11,12,13,14], color: '#8b0000' },
    { label: 'ENDURANCE', days: [15,16,17,18,19,20,21], color: '#9b59b6' },
    { label: 'DEVOTION', days: [22,23,24,25,26,27,28,29,30], color: '#c5a059' },
];

export default function PreviewTasksPage() {
    const [selectedDay, setSelectedDay] = useState(1);
    const [template, setTemplate] = useState<Record<string, any[]> | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTask, setActiveTask] = useState<any | null>(null);
    const [resetKey, setResetKey] = useState(0);

    // Load real template from database
    useEffect(() => {
        fetch('/api/vault/program?template=true')
            .then(r => r.json())
            .then(j => {
                if (j.template && j.template.length > 0) {
                    const prog: Record<string, any[]> = {};
                    for (const row of j.template) {
                        prog[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : (row.tasks || []);
                    }
                    setTemplate(prog);
                } else {
                    // No saved template — use code defaults
                    const prog: Record<string, any[]> = {};
                    for (let d = 1; d <= 30; d++) prog[String(d)] = defaultDayTasks(d);
                    setTemplate(prog);
                }
            })
            .catch(() => {
                // Fetch failed — use code defaults
                const prog: Record<string, any[]> = {};
                for (let d = 1; d <= 30; d++) prog[String(d)] = defaultDayTasks(d);
                setTemplate(prog);
            })
            .finally(() => setLoading(false));
    }, []);

    const dayTasks: any[] = template?.[String(selectedDay)] || [];

    const launchTask = useCallback((task: any) => {
        setResetKey(k => k + 1);
        try { localStorage.removeItem('vault_gamble_results'); localStorage.removeItem('vault_followup'); localStorage.removeItem('ss_state'); } catch {}
        const type = normalizeType(task.type);
        const meta = MECH_ICON[type] || MECH_BY_ID[type] || { icon: '◆', label: task.label || type };
        setActiveTask({
            type,
            done: 0,
            target: task.target || 1,
            label: task.label || meta.label,
            config: resolveConfig(task),
        });
    }, []);

    const phaseForDay = PHASES.find(p => p.days.includes(selectedDay));

    // ── TASK VIEW ──
    if (activeTask) {
        const meta = MECH_ICON[activeTask.type] || { icon: '◆', label: activeTask.label };
        return (
            <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
                {/* Header */}
                <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(197,160,89,0.15)', background: 'rgba(4,3,10,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => setActiveTask(null)} style={{ background: 'none', border: '1px solid rgba(197,160,89,0.2)', borderRadius: 6, color: 'rgba(197,160,89,0.6)', fontSize: '0.8rem', cursor: 'pointer', padding: '6px 10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '1px' }}>←</button>
                    <div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '6px', marginBottom: 2 }}>DAY {selectedDay} · TASK</div>
                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '2px' }}>{activeTask.label}</div>
                    </div>
                </div>

                {/* Task content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px' }}>
                    <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(197,160,89,0.85) 0%, rgba(197,160,89,0.05) 100%)', borderRadius: '2px 2px 0 0' }} />
                    <div style={{ border: '1px solid rgba(197,160,89,0.35)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
                        <div style={{ padding: '18px 20px 16px', background: 'rgba(197,160,89,0.05)', borderBottom: '1px solid rgba(197,160,89,0.1)', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(197,160,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(197,160,89,0.07)', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.95rem', color: 'rgba(197,160,89,0.85)' }}>{meta.icon}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.42rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '5px', marginBottom: 4 }}>NOW</div>
                                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: 'rgba(255,255,255,0.92)', letterSpacing: '1px' }}>{activeTask.label}</div>
                            </div>
                        </div>
                        <div style={{ padding: '22px 20px 24px', background: 'rgba(6,5,14,0.88)', backdropFilter: 'blur(18px)' }}>
                            <MechRunner
                                key={`${activeTask.type}-${resetKey}`}
                                order={activeTask}
                                profile={PREVIEW_PROFILE}
                                previewMode={true}
                                onClose={() => setActiveTask(null)}
                                onComplete={() => setActiveTask(null)}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: `${R}0.4)`, letterSpacing: '4px', pointerEvents: 'none' }}>
                    PREVIEW MODE · NO DATA SAVED
                </div>
            </div>
        );
    }

    // ── DAY LIST VIEW ──
    return (
        <div style={{ minHeight: '100dvh', background: BG, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>

            {/* Header */}
            <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(197,160,89,0.15)', background: 'rgba(4,3,10,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '6px', marginBottom: 2 }}>PROGRAM PREVIEW</div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '2px' }}>
                    Day {selectedDay}
                    {phaseForDay && <span style={{ marginLeft: 10, fontFamily: 'Orbitron, sans-serif', fontSize: '0.38rem', color: `${phaseForDay.color}88`, letterSpacing: '4px' }}>· {phaseForDay.label}</span>}
                </div>
            </div>

            {/* Day picker */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(197,160,89,0.1)', background: 'rgba(4,3,10,0.85)', backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(d => {
                        const phase = PHASES.find(p => p.days.includes(d));
                        const active = d === selectedDay;
                        const hasData = template && (template[String(d)] || []).length > 0;
                        return (
                            <button key={d} onClick={() => setSelectedDay(d)} style={{
                                width: 32, height: 26, fontFamily: 'Orbitron, sans-serif', fontSize: '0.45rem',
                                color: active ? (phase?.color || 'rgba(197,160,89,0.95)') : hasData ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)',
                                background: active ? `${(phase?.color || '#c5a059')}18` : 'transparent',
                                border: `1px solid ${active ? (phase?.color || 'rgba(197,160,89,0.4)') + '55' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s',
                            }}>{d}</button>
                        );
                    })}
                </div>
            </div>

            {/* Task list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 100px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'rgba(197,160,89,0.35)', fontFamily: 'Orbitron, sans-serif', fontSize: '0.55rem', letterSpacing: '4px', paddingTop: 60 }}>LOADING PROGRAM...</div>
                ) : dayTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontFamily: 'Cinzel, serif', fontSize: '0.8rem', paddingTop: 60 }}>No tasks for Day {selectedDay}</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dayTasks.map((task: any, i: number) => {
                            const type = normalizeType(task.type);
                            const meta = MECH_ICON[type] || MECH_BY_ID[type] || { icon: '◆', label: task.label || type };
                            const mechDef = MECH_BY_ID[type];
                            return (
                                <button key={i} onClick={() => launchTask(task)} style={{
                                    display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
                                    background: 'rgba(6,5,14,0.88)', border: '1px solid rgba(197,160,89,0.18)',
                                    borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                                    transition: 'all 0.15s',
                                }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${(mechDef?.color || '#c5a059')}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${(mechDef?.color || '#c5a059')}0a`, flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.9rem', color: `${(mechDef?.color || '#c5a059')}bb` }}>{meta.icon}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', letterSpacing: '0.5px', marginBottom: 4 }}>{task.label || meta.label}</div>
                                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.35rem', color: 'rgba(197,160,89,0.35)', letterSpacing: '3px' }}>TARGET: {task.target || 1}</div>
                                    </div>
                                    <div style={{ color: 'rgba(197,160,89,0.3)', fontSize: '0.8rem' }}>›</div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Preview badge */}
            <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', fontFamily: 'Orbitron, sans-serif', fontSize: '0.3rem', color: `${R}0.4)`, letterSpacing: '4px', pointerEvents: 'none' }}>
                PREVIEW MODE · NO DATA SAVED
            </div>
        </div>
    );
}
