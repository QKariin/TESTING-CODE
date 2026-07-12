'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── DESIGN TOKENS ── */
const F = "'Rajdhani', sans-serif";
const FC = "'Cinzel', serif";
const GOLD = '#c5a059';
const GOLD_DIM = 'rgba(197,160,89,0.25)';
const GOLD_GLOW = 'rgba(197,160,89,0.35)';
const RED = 'rgba(160,20,30,0.85)';
const RED_DIM = 'rgba(139,0,0,0.15)';
const BG = '#08080c';
const SURFACE = 'rgba(255,255,255,0.025)';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = 'rgba(255,255,255,0.7)';
const TEXT_DIM = 'rgba(255,255,255,0.25)';

/* ── TASK TYPE METADATA ── */
const TASK_META: Record<string, { label: string; icon: string; color: string; configKey?: string }> = {
    kneel: { label: 'Kneel', icon: '◇', color: '#c5a059' },
    chastity_check: { label: 'Chastity', icon: '◈', color: '#8b0000' },
    spin: { label: 'Spin', icon: '◎', color: '#9b59b6', configKey: 'spin_wheel' },
    card: { label: 'Card', icon: '♠', color: '#2ecc71', configKey: 'card_deck' },
    tribute: { label: 'Tribute', icon: '◆', color: '#f39c12' },
    journal: { label: 'Journal', icon: '✎', color: '#3498db' },
    worship: { label: 'Worship', icon: '♡', color: '#e74c3c' },
    lines: { label: 'Lines', icon: '≡', color: '#1abc9c', configKey: 'lines_texts' },
    edge: { label: 'Edge', icon: '✶', color: '#e91e63' },
    denial: { label: 'Denial', icon: '✖', color: '#c0392b' },
    confession: { label: 'Confess', icon: '❧', color: '#8e44ad' },
    cold_shower: { label: 'Cold', icon: '❄', color: '#00bcd4' },
    exercise: { label: 'Exercise', icon: '↑', color: '#4caf50', configKey: 'exercises' },
    corner_time: { label: 'Corner', icon: '▢', color: '#607d8b' },
    body_writing: { label: 'Body', icon: '✍', color: '#ff5722', configKey: 'body_writing' },
    gratitude: { label: 'Grateful', icon: '★', color: '#ffc107' },
    quiz: { label: 'Quiz', icon: '?', color: '#00bcd4', configKey: 'quiz_questions' },
    essay: { label: 'Essay', icon: '‖', color: '#795548' },
    trial: { label: 'Trial', icon: '⚔', color: '#9c27b0' },
};

const PHASES = [
    { name: 'OBEDIENCE', sub: 'Foundation', days: [1,2,3,4,5,6,7], color: 'rgba(197,160,89,0.6)' },
    { name: 'DISCIPLINE', sub: 'Building', days: [8,9,10,11,12,13,14], color: 'rgba(139,0,0,0.6)' },
    { name: 'ENDURANCE', sub: 'Testing', days: [15,16,17,18,19,20,21], color: 'rgba(156,39,176,0.6)' },
    { name: 'DEVOTION', sub: 'Proving', days: [22,23,24,25,26,27,28,29,30], color: 'rgba(197,160,89,0.8)' },
];

const CONFIG_SECTIONS = [
    { key: 'spin_wheel', title: 'SPIN WHEEL', desc: 'What they land on when spinning' },
    { key: 'card_deck', title: 'TASK CARDS', desc: 'Random cards they draw' },
    { key: 'lines_texts', title: 'WRITING LINES', desc: 'Text they write repeatedly' },
    { key: 'body_writing', title: 'BODY WRITING', desc: 'Words written on body' },
    { key: 'quiz_questions', title: 'QUIZ', desc: 'Questions about the rules' },
    { key: 'exercises', title: 'EXERCISES', desc: 'Physical tasks' },
];

interface Task { type: string; target: number; label: string; }
type ViewMode = 'program' | 'config' | 'member';

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [view, setView] = useState<ViewMode>(initialMember ? 'member' : 'program');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [templateDays, setTemplateDays] = useState<Record<string, Task[]>>({});
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [lockedMembers, setLockedMembers] = useState<any[]>([]);
    // Config state
    const [configSection, setConfigSection] = useState('spin_wheel');
    const [configData, setConfigData] = useState<Record<string, any>>({});
    // Member state
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string, Task[]> | null>(null);
    const [memberSelectedDay, setMemberSelectedDay] = useState<number | null>(null);
    const [memberInfo, setMemberInfo] = useState<any>(null);
    // Drag state
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    useEffect(() => {
        loadTemplate();
        loadConfig();
        loadLockedMembers();
        if (initialMember) setTimeout(() => loadMemberProgram(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadLockedMembers = async () => {
        try {
            const res = await fetch('/api/vault/program?listLocked=true');
            const json = await res.json();
            if (json.locked) setLockedMembers(json.locked);
        } catch { }
    };

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vault/program?template=true');
            const json = await res.json();
            if (json.template && json.template.length > 0) {
                const days: Record<string, Task[]> = {};
                for (const row of json.template) {
                    const tasks = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                    days[String(row.day_number)] = tasks;
                }
                setTemplateDays(days);
            } else {
                // Load defaults from generate endpoint
                const r2 = await fetch('/api/vault/program', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save_template', days: {} }),
                });
            }
        } catch { }
        setLoading(false);
    };

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/vault/program?config=true');
            const json = await res.json();
            if (json.config) {
                const map: Record<string, any> = {};
                for (const row of json.config) {
                    map[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                }
                setConfigData(map);
            }
        } catch { }
    };

    const loadMemberProgram = async () => {
        if (!memberEmail) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/vault/program?memberId=${encodeURIComponent(memberEmail)}`);
            const json = await res.json();
            if (json.program?.program) {
                const p = typeof json.program.program === 'string' ? JSON.parse(json.program.program) : json.program.program;
                setMemberProgram(p);
            } else {
                setMemberProgram(null);
            }
            // Get member info from locked list
            const info = lockedMembers.find(m => m.memberId.toLowerCase() === memberEmail.toLowerCase());
            setMemberInfo(info || null);
        } catch { }
        setLoading(false);
    };

    const generateMemberProgram = async () => {
        if (!memberEmail) return;
        setSaving(true);
        try {
            await fetch('/api/vault/program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate_program', memberId: memberEmail }),
            });
            await loadMemberProgram();
        } catch { }
        setSaving(false);
    };

    const saveTemplate = async () => {
        setSaving(true);
        try {
            await fetch('/api/vault/program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_template', days: templateDays }),
            });
        } catch { }
        setSaving(false);
    };

    const saveConfig = async (key: string, value: any) => {
        setSaving(true);
        try {
            await fetch('/api/vault/program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_config', key, value }),
            });
        } catch { }
        setSaving(false);
    };

    const saveMemberDay = async (dayNum: number, tasks: Task[]) => {
        if (!memberEmail) return;
        setSaving(true);
        try {
            await fetch('/api/vault/program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_day', memberId: memberEmail, dayNumber: dayNum, tasks }),
            });
        } catch { }
        setSaving(false);
    };

    // Get current days/tasks for active view
    const activeDays = view === 'member' && memberProgram ? memberProgram : templateDays;
    const activeSelectedDay = view === 'member' ? memberSelectedDay : selectedDay;
    const setActiveSelectedDay = view === 'member' ? setMemberSelectedDay : setSelectedDay;
    const activeTasks = activeSelectedDay ? (activeDays[String(activeSelectedDay)] || []) : [];

    const updateTask = (dayNum: number, idx: number, field: string, value: any) => {
        const days = view === 'member' ? { ...memberProgram } : { ...templateDays };
        const tasks = [...(days[String(dayNum)] || [])];
        tasks[idx] = { ...tasks[idx], [field]: value };
        days[String(dayNum)] = tasks;
        if (view === 'member') setMemberProgram(days as any);
        else setTemplateDays(days);
    };

    const addTask = (dayNum: number, type: string) => {
        const meta = TASK_META[type];
        const days = view === 'member' ? { ...memberProgram } : { ...templateDays };
        const tasks = [...(days[String(dayNum)] || [])];
        tasks.push({ type, target: 1, label: meta?.label || type });
        days[String(dayNum)] = tasks;
        if (view === 'member') setMemberProgram(days as any);
        else setTemplateDays(days);
    };

    const removeTask = (dayNum: number, idx: number) => {
        const days = view === 'member' ? { ...memberProgram } : { ...templateDays };
        const tasks = [...(days[String(dayNum)] || [])];
        tasks.splice(idx, 1);
        days[String(dayNum)] = tasks;
        if (view === 'member') setMemberProgram(days as any);
        else setTemplateDays(days);
    };

    const moveTask = (dayNum: number, fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        const days = view === 'member' ? { ...memberProgram } : { ...templateDays };
        const tasks = [...(days[String(dayNum)] || [])];
        const [moved] = tasks.splice(fromIdx, 1);
        tasks.splice(toIdx, 0, moved);
        days[String(dayNum)] = tasks;
        if (view === 'member') setMemberProgram(days as any);
        else setTemplateDays(days);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: F }}>
            {/* Global style overrides */}
            <style>{`
                input[type=number]::-webkit-outer-spin-button,
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
                .kh-day-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .kh-day-card:hover { transform: translateY(-4px) scale(1.02); }
                .kh-task-pill { transition: all 0.2s ease; }
                .kh-task-pill:hover { transform: scale(1.03); }
                .kh-member-card { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
                .kh-member-card:hover { transform: translateY(-6px); }
                .kh-glow { animation: khGlow 3s ease-in-out infinite; }
                @keyframes khGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(197,160,89,0.08); }
                    50% { box-shadow: 0 0 40px rgba(197,160,89,0.15); }
                }
                @keyframes khFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes khSlideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
                .kh-fade { animation: khFadeIn 0.4s ease forwards; }
                .kh-slide { animation: khSlideIn 0.35s ease forwards; }
                .kh-drag-over { border-color: ${GOLD} !important; background: rgba(197,160,89,0.06) !important; }
                .kh-scroll::-webkit-scrollbar { width: 4px; }
                .kh-scroll::-webkit-scrollbar-track { background: transparent; }
                .kh-scroll::-webkit-scrollbar-thumb { background: rgba(197,160,89,0.15); border-radius: 4px; }
            `}</style>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, gap: 16, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: GOLD, fontSize: '1.4rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
                <h1 style={{ fontFamily: FC, fontSize: '0.85rem', color: GOLD, letterSpacing: 6, margin: 0, flex: 1 }}>KEYHOLDER PROGRAM</h1>
                {/* View tabs */}
                <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 3 }}>
                    {(['program', 'config', 'member'] as ViewMode[]).map(v => (
                        <button key={v} onClick={() => setView(v)} style={{
                            padding: '8px 20px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: F,
                            fontSize: '0.65rem', letterSpacing: 3, fontWeight: 600, transition: 'all 0.25s ease',
                            background: view === v ? (v === 'config' ? RED_DIM : 'rgba(197,160,89,0.1)') : 'transparent',
                            color: view === v ? (v === 'config' ? RED : GOLD) : TEXT_DIM,
                        }}>{v === 'program' ? 'PROGRAM' : v === 'config' ? 'CONFIG' : 'MEMBERS'}</button>
                    ))}
                </div>
            </div>

            {/* ── LOCKED MEMBERS STRIP ── */}
            {lockedMembers.length > 0 && (
                <div style={{ display: 'flex', gap: 14, padding: '14px 24px', overflowX: 'auto', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }} className="kh-scroll">
                    {lockedMembers.map((m, i) => (
                        <div key={m.memberId} className="kh-member-card"
                            onClick={() => { setMemberEmail(m.memberId); setView('member'); setTimeout(() => loadMemberProgram(), 50); }}
                            style={{
                                minWidth: 180, padding: 0, borderRadius: 14, cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                border: `1px solid ${memberEmail === m.memberId ? GOLD_DIM : BORDER}`,
                                background: `linear-gradient(145deg, rgba(20,18,25,0.95), rgba(12,10,16,0.98))`,
                                animationDelay: `${i * 0.08}s`,
                            }}>
                            {/* Photo header */}
                            <div style={{ height: 70, position: 'relative', overflow: 'hidden' }}>
                                {m.avatar ? (
                                    <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.4) saturate(0.6)' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, rgba(139,0,0,0.3), rgba(30,20,40,0.8))` }} />
                                )}
                                {/* Gradient overlay */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%, rgba(12,10,16,0.95) 100%)' }} />
                                {/* Day badge */}
                                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '2px 8px', border: `1px solid ${GOLD_DIM}` }}>
                                    <span style={{ fontFamily: F, fontSize: '0.6rem', color: GOLD, fontWeight: 700 }}>DAY {m.daysIn}</span>
                                </div>
                            </div>
                            {/* Info */}
                            <div style={{ padding: '8px 14px 12px' }}>
                                <div style={{ fontFamily: FC, fontSize: '0.6rem', color: 'rgba(255,255,255,0.85)', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>
                                    {m.name}
                                </div>
                                {/* Progress bar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${m.lockDays ? (m.daysIn / m.lockDays) * 100 : 0}%`, height: '100%',
                                            background: `linear-gradient(90deg, ${GOLD}, rgba(139,0,0,0.8))`,
                                            borderRadius: 2, transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                    <span style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM }}>{m.daysIn}/{m.lockDays}</span>
                                </div>
                                {/* Today's completion */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                    <span style={{ fontFamily: F, fontSize: '0.5rem', color: m.todayPerfect ? GOLD : TEXT_DIM }}>
                                        {m.todayPerfect ? '✦ PERFECT' : `${m.todayDone}/${m.todayTotal} today`}
                                    </span>
                                    {m.streak > 0 && (
                                        <span style={{ fontFamily: F, fontSize: '0.45rem', color: 'rgba(255,100,50,0.7)' }}>🔥{m.streak}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── MAIN CONTENT ── */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {view === 'program' && <ProgramView
                    days={templateDays} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
                    onUpdateTask={(d: number, i: number, f: string, v: any) => updateTask(d, i, f, v)} onAddTask={addTask} onRemoveTask={removeTask}
                    onMoveTask={moveTask} onSave={saveTemplate} saving={saving} loading={loading}
                    dragIdx={dragIdx} setDragIdx={setDragIdx}
                />}
                {view === 'config' && <ConfigView
                    configData={configData} setConfigData={setConfigData}
                    configSection={configSection} setConfigSection={setConfigSection}
                    onSave={saveConfig} saving={saving}
                />}
                {view === 'member' && <MemberView
                    email={memberEmail} setEmail={setMemberEmail}
                    program={memberProgram} selectedDay={memberSelectedDay} setSelectedDay={setMemberSelectedDay}
                    info={memberInfo} lockedMembers={lockedMembers}
                    onLoad={loadMemberProgram} onGenerate={generateMemberProgram}
                    onUpdateTask={(d: number, i: number, f: string, v: any) => updateTask(d, i, f, v)} onAddTask={addTask} onRemoveTask={removeTask}
                    onMoveTask={moveTask} onSaveDay={saveMemberDay} saving={saving} loading={loading}
                    dragIdx={dragIdx} setDragIdx={setDragIdx}
                />}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════
   PROGRAM VIEW — Day cards grid + detail panel
   ══════════════════════════════════════════ */
function ProgramView({ days, selectedDay, setSelectedDay, onUpdateTask, onAddTask, onRemoveTask, onMoveTask, onSave, saving, loading, dragIdx, setDragIdx }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* LEFT: Day cards grid */}
            <div style={{ width: selectedDay ? '42%' : '100%', transition: 'width 0.4s ease', overflowY: 'auto', padding: '20px 24px' }} className="kh-scroll">
                {/* Save button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontFamily: FC, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: 4 }}>MASTER TEMPLATE</div>
                        <div style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, marginTop: 2 }}>30-day program formula for all new members</div>
                    </div>
                    <button onClick={onSave} style={{
                        padding: '10px 28px', borderRadius: 8, border: `1px solid ${GOLD_DIM}`, cursor: 'pointer',
                        background: 'rgba(197,160,89,0.06)', color: GOLD, fontFamily: F, fontSize: '0.6rem', letterSpacing: 3, fontWeight: 600,
                    }}>{saving ? 'SAVING...' : 'SAVE PROGRAM'}</button>
                </div>

                {/* Phase groups */}
                {PHASES.map((phase, pi) => (
                    <div key={phase.name} style={{ marginBottom: 28 }} className="kh-fade" >
                        {/* Phase header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingLeft: 4 }}>
                            <div style={{ width: 3, height: 22, borderRadius: 2, background: phase.color }} />
                            <span style={{ fontFamily: FC, fontSize: '0.6rem', color: phase.color, letterSpacing: 5 }}>{phase.name}</span>
                            <span style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, letterSpacing: 2 }}>{phase.sub}</span>
                            <div style={{ flex: 1, height: 1, background: BORDER }} />
                        </div>

                        {/* Day cards grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                            {phase.days.map(d => {
                                const tasks = days[String(d)] || [];
                                const isActive = selectedDay === d;
                                return (
                                    <div key={d} className="kh-day-card kh-glow" onClick={() => setSelectedDay(isActive ? null : d)} style={{
                                        borderRadius: 14, cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                        border: `1px solid ${isActive ? GOLD_DIM : BORDER}`,
                                        background: isActive
                                            ? `linear-gradient(145deg, rgba(197,160,89,0.06), rgba(12,10,16,0.98))`
                                            : `linear-gradient(145deg, rgba(20,18,25,0.95), rgba(12,10,16,0.98))`,
                                    }}>
                                        {/* Card header with day number */}
                                        <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontFamily: FC, fontSize: '1.1rem', color: isActive ? GOLD : 'rgba(255,255,255,0.6)', lineHeight: 1 }}>{d}</div>
                                                <div style={{ fontFamily: F, fontSize: '0.45rem', color: TEXT_DIM, letterSpacing: 2, marginTop: 2 }}>DAY</div>
                                            </div>
                                            <div style={{
                                                background: `rgba(${isActive ? '197,160,89' : '255,255,255'},0.06)`, borderRadius: 20,
                                                padding: '3px 10px', fontFamily: F, fontSize: '0.5rem', color: isActive ? GOLD : TEXT_DIM,
                                            }}>{tasks.length} tasks</div>
                                        </div>
                                        {/* Task pills preview */}
                                        <div style={{ padding: '0 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {tasks.slice(0, 6).map((t: Task, i: number) => {
                                                const meta = TASK_META[t.type] || { icon: '•', color: '#666' };
                                                return (
                                                    <div key={i} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '3px 8px', borderRadius: 6, fontSize: '0.48rem', fontFamily: F,
                                                        background: `${meta.color}12`, color: `${meta.color}cc`,
                                                        border: `1px solid ${meta.color}22`,
                                                    }}>
                                                        <span style={{ fontSize: '0.5rem' }}>{meta.icon}</span>
                                                        {t.target > 1 && <span style={{ fontWeight: 700 }}>×{t.target}</span>}
                                                    </div>
                                                );
                                            })}
                                            {tasks.length > 6 && (
                                                <div style={{ padding: '3px 8px', borderRadius: 6, fontSize: '0.45rem', fontFamily: F, color: TEXT_DIM }}>
                                                    +{tasks.length - 6}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* RIGHT: Detail panel */}
            {selectedDay && (
                <DayDetailPanel
                    dayNum={selectedDay} tasks={days[String(selectedDay)] || []}
                    onClose={() => setSelectedDay(null)}
                    onUpdateTask={(i: number, f: string, v: any) => onUpdateTask(selectedDay, i, f, v)}
                    onAddTask={(type: string) => onAddTask(selectedDay, type)}
                    onRemoveTask={(i: number) => onRemoveTask(selectedDay, i)}
                    onMoveTask={(from: number, to: number) => onMoveTask(selectedDay, from, to)}
                    dragIdx={dragIdx} setDragIdx={setDragIdx}
                />
            )}
        </div>
    );
}

/* ══════════════════════════════════════════
   DAY DETAIL PANEL — Right side overlay
   ══════════════════════════════════════════ */
function DayDetailPanel({ dayNum, tasks, onClose, onUpdateTask, onAddTask, onRemoveTask, onMoveTask, dragIdx, setDragIdx }: any) {
    const phase = PHASES.find(p => p.days.includes(dayNum));
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    return (
        <div className="kh-slide" style={{
            width: '58%', borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column',
            background: `linear-gradient(180deg, rgba(15,13,20,0.98), ${BG})`, overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                        <span style={{ fontFamily: FC, fontSize: '2.4rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>Day {dayNum}</span>
                        <span style={{ fontFamily: FC, fontSize: '0.55rem', color: phase?.color || TEXT_DIM, letterSpacing: 4 }}>{phase?.name}</span>
                    </div>
                    <div style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, letterSpacing: 2, marginTop: 4 }}>{phase?.sub} phase</div>
                </div>
                <button onClick={onClose} style={{
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8,
                    padding: '8px 16px', cursor: 'pointer', color: TEXT_DIM, fontFamily: F, fontSize: '0.55rem', letterSpacing: 2,
                }}>CLOSE</button>
            </div>

            {/* Task list — draggable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }} className="kh-scroll">
                {tasks.map((task: Task, idx: number) => {
                    const meta = TASK_META[task.type] || { label: task.type, icon: '•', color: '#666' };
                    return (
                        <div key={idx}
                            draggable
                            onDragStart={() => setDragIdx(idx)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('kh-drag-over'); }}
                            onDragLeave={(e) => { e.currentTarget.classList.remove('kh-drag-over'); }}
                            onDrop={(e) => { e.currentTarget.classList.remove('kh-drag-over'); if (dragIdx !== null) onMoveTask(dragIdx, idx); setDragIdx(null); }}
                            className="kh-task-pill"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', marginBottom: 8,
                                borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, cursor: 'grab',
                                opacity: dragIdx === idx ? 0.4 : 1,
                            }}>
                            {/* Drag handle */}
                            <div style={{ color: TEXT_DIM, fontSize: '0.7rem', cursor: 'grab', userSelect: 'none' }}>⠿</div>

                            {/* Icon */}
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: `${meta.color}15`, border: `1px solid ${meta.color}30`, fontSize: '1rem', flexShrink: 0,
                            }}>{meta.icon}</div>

                            {/* Label — editable */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <input
                                    value={task.label}
                                    onChange={(e) => onUpdateTask(idx, 'label', e.target.value)}
                                    style={{
                                        background: 'transparent', border: 'none', outline: 'none', width: '100%',
                                        fontFamily: F, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600,
                                    }}
                                />
                                <div style={{ fontFamily: F, fontSize: '0.45rem', color: meta.color, letterSpacing: 2, marginTop: 1, textTransform: 'uppercase' }}>
                                    {meta.label}
                                    {meta.configKey && <span style={{ color: TEXT_DIM, marginLeft: 6 }}>• configurable</span>}
                                </div>
                            </div>

                            {/* Target input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, letterSpacing: 1 }}>×</span>
                                <input type="number" value={task.target}
                                    onChange={(e) => onUpdateTask(idx, 'target', parseInt(e.target.value) || 1)}
                                    style={{
                                        width: 44, height: 36, textAlign: 'center', borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`,
                                        color: GOLD, fontFamily: F, fontSize: '1rem', fontWeight: 700, outline: 'none',
                                    }}
                                />
                            </div>

                            {/* Delete */}
                            <button onClick={(e) => { e.stopPropagation(); onRemoveTask(idx); }} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,60,60,0.3)',
                                fontSize: '0.9rem', padding: '4px 6px', transition: 'color 0.2s',
                            }} onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,60,60,0.8)')}
                               onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,60,60,0.3)')}>×</button>
                        </div>
                    );
                })}

                {/* Add task area */}
                <div style={{ marginTop: 20, position: 'relative' }}>
                    <button onClick={() => setAddMenuOpen(!addMenuOpen)} style={{
                        width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
                        border: `1px dashed ${addMenuOpen ? GOLD_DIM : BORDER}`,
                        background: addMenuOpen ? 'rgba(197,160,89,0.03)' : 'transparent',
                        color: addMenuOpen ? GOLD : TEXT_DIM, fontFamily: F, fontSize: '0.6rem', letterSpacing: 3,
                        transition: 'all 0.25s ease',
                    }}>+ ADD TASK</button>

                    {addMenuOpen && (
                        <div className="kh-fade" style={{
                            marginTop: 8, padding: 16, borderRadius: 14, background: 'rgba(15,13,20,0.98)',
                            border: `1px solid ${BORDER}`, display: 'flex', flexWrap: 'wrap', gap: 6,
                        }}>
                            {Object.entries(TASK_META).map(([type, meta]) => (
                                <button key={type} onClick={() => { onAddTask(type); setAddMenuOpen(false); }} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                                    borderRadius: 8, border: `1px solid ${meta.color}25`, cursor: 'pointer',
                                    background: `${meta.color}08`, color: `${meta.color}cc`,
                                    fontFamily: F, fontSize: '0.55rem', fontWeight: 600, transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${meta.color}18`; e.currentTarget.style.borderColor = `${meta.color}40`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = `${meta.color}08`; e.currentTarget.style.borderColor = `${meta.color}25`; }}
                                >
                                    <span>{meta.icon}</span>
                                    <span>{meta.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════
   CONFIG VIEW — Spin, Cards, Lines, etc.
   ══════════════════════════════════════════ */
function ConfigView({ configData, setConfigData, configSection, setConfigSection, onSave, saving }: any) {
    const section = CONFIG_SECTIONS.find(s => s.key === configSection)!;
    const data = configData[configSection] || [];

    const updateItem = (idx: number, field: string, value: any) => {
        const newData = [...data];
        if (field === '_string') {
            // Plain string arrays (lines_texts, body_writing)
            newData[idx] = value;
        } else {
            newData[idx] = { ...newData[idx], [field]: value };
        }
        setConfigData({ ...configData, [configSection]: newData });
    };

    const addItem = () => {
        const newData = [...data];
        if (configSection === 'spin_wheel') newData.push({ label: 'New option', effect: 'nothing', value: 0, weight: 1 });
        else if (configSection === 'card_deck') newData.push({ title: 'New card', description: '', category: 'control' });
        else if (configSection === 'lines_texts') newData.push('New line text');
        else if (configSection === 'body_writing') newData.push('WORD');
        else if (configSection === 'quiz_questions') newData.push({ question: '', answer: '' });
        else if (configSection === 'exercises') newData.push({ type: 'pushups', count: 20 });
        setConfigData({ ...configData, [configSection]: newData });
    };

    const removeItem = (idx: number) => {
        const newData = [...data];
        newData.splice(idx, 1);
        setConfigData({ ...configData, [configSection]: newData });
    };

    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left: Section selector */}
            <div style={{ width: 240, borderRight: `1px solid ${BORDER}`, overflowY: 'auto', padding: '20px 0' }} className="kh-scroll">
                {CONFIG_SECTIONS.map(s => (
                    <div key={s.key} onClick={() => setConfigSection(s.key)} style={{
                        padding: '14px 24px', cursor: 'pointer', borderLeft: `3px solid ${configSection === s.key ? GOLD : 'transparent'}`,
                        background: configSection === s.key ? 'rgba(197,160,89,0.04)' : 'transparent',
                        transition: 'all 0.2s ease',
                    }}>
                        <div style={{ fontFamily: FC, fontSize: '0.55rem', color: configSection === s.key ? GOLD : TEXT, letterSpacing: 3 }}>{s.title}</div>
                        <div style={{ fontFamily: F, fontSize: '0.45rem', color: TEXT_DIM, marginTop: 2 }}>{s.desc}</div>
                    </div>
                ))}
            </div>

            {/* Right: Config editor */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="kh-scroll">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontFamily: FC, fontSize: '0.75rem', color: GOLD, letterSpacing: 4 }}>{section?.title}</div>
                        <div style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, marginTop: 2 }}>{section?.desc}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={addItem} style={{
                            padding: '8px 20px', borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'pointer',
                            background: SURFACE, color: TEXT, fontFamily: F, fontSize: '0.55rem', letterSpacing: 2,
                        }}>+ ADD</button>
                        <button onClick={() => onSave(configSection, data)} style={{
                            padding: '8px 20px', borderRadius: 8, border: `1px solid ${GOLD_DIM}`, cursor: 'pointer',
                            background: 'rgba(197,160,89,0.06)', color: GOLD, fontFamily: F, fontSize: '0.55rem', letterSpacing: 2,
                        }}>{saving ? 'SAVING...' : 'SAVE'}</button>
                    </div>
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.map((item: any, idx: number) => (
                        <ConfigItem key={idx} section={configSection} item={item} idx={idx}
                            onUpdate={updateItem} onRemove={removeItem} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ConfigItem({ section, item, idx, onUpdate, onRemove }: any) {
    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px',
        color: 'rgba(255,255,255,0.8)', fontFamily: F, fontSize: '0.7rem', outline: 'none', width: '100%',
    };
    const smallInput: React.CSSProperties = { ...inputStyle, width: 80, textAlign: 'center' as const, fontSize: '0.8rem', color: GOLD, fontWeight: 700 };

    if (section === 'lines_texts' || section === 'body_writing') {
        return (
            <div className="kh-task-pill" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`,
            }}>
                <span style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, width: 20 }}>{idx + 1}</span>
                <input value={item} onChange={(e) => onUpdate(idx, '_string', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,0.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
            </div>
        );
    }

    if (section === 'spin_wheel') {
        return (
            <div className="kh-task-pill" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`,
            }}>
                <input value={item.label || ''} onChange={(e) => onUpdate(idx, 'label', e.target.value)} placeholder="Label" style={{ ...inputStyle, flex: 1 }} />
                <input value={item.effect || ''} onChange={(e) => onUpdate(idx, 'effect', e.target.value)} placeholder="Effect" style={{ ...inputStyle, width: 120 }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: F, fontSize: '0.35rem', color: TEXT_DIM, letterSpacing: 1 }}>VAL</span>
                    <input type="number" value={item.value ?? 0} onChange={(e) => onUpdate(idx, 'value', parseInt(e.target.value) || 0)} style={smallInput} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: F, fontSize: '0.35rem', color: TEXT_DIM, letterSpacing: 1 }}>WT</span>
                    <input type="number" value={item.weight ?? 1} onChange={(e) => onUpdate(idx, 'weight', parseInt(e.target.value) || 1)} style={smallInput} />
                </div>
                <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,0.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
            </div>
        );
    }

    if (section === 'card_deck') {
        return (
            <div className="kh-task-pill" style={{
                padding: '14px 18px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`,
            }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                    <input value={item.title || ''} onChange={(e) => onUpdate(idx, 'title', e.target.value)} placeholder="Title" style={{ ...inputStyle, flex: 1, fontWeight: 700, fontSize: '0.75rem' }} />
                    <input value={item.category || ''} onChange={(e) => onUpdate(idx, 'category', e.target.value)} placeholder="Category" style={{ ...inputStyle, width: 120, fontSize: '0.6rem' }} />
                    <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,0.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                </div>
                <textarea value={item.description || ''} onChange={(e) => onUpdate(idx, 'description', e.target.value)} placeholder="Description..."
                    rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: F, fontSize: '0.6rem', lineHeight: 1.5 }} />
            </div>
        );
    }

    if (section === 'quiz_questions') {
        return (
            <div className="kh-task-pill" style={{
                display: 'flex', gap: 12, padding: '14px 18px', borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, alignItems: 'center',
            }}>
                <input value={item.question || ''} onChange={(e) => onUpdate(idx, 'question', e.target.value)} placeholder="Question" style={{ ...inputStyle, flex: 2 }} />
                <input value={item.answer || ''} onChange={(e) => onUpdate(idx, 'answer', e.target.value)} placeholder="Answer" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,0.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
            </div>
        );
    }

    if (section === 'exercises') {
        return (
            <div className="kh-task-pill" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`,
            }}>
                <input value={item.type || ''} onChange={(e) => onUpdate(idx, 'type', e.target.value)} placeholder="Type" style={{ ...inputStyle, flex: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: F, fontSize: '0.35rem', color: TEXT_DIM, letterSpacing: 1 }}>COUNT</span>
                    <input type="number" value={item.count ?? 10} onChange={(e) => onUpdate(idx, 'count', parseInt(e.target.value) || 1)} style={smallInput} />
                </div>
                <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,0.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
            </div>
        );
    }

    return null;
}

/* ══════════════════════════════════════════
   MEMBER VIEW — Per-user program editor
   ══════════════════════════════════════════ */
function MemberView({ email, setEmail, program, selectedDay, setSelectedDay, info, lockedMembers, onLoad, onGenerate, onUpdateTask, onAddTask, onRemoveTask, onMoveTask, onSaveDay, saving, loading, dragIdx, setDragIdx }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Member selector — if no email yet, show locked member cards */}
            {!email && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="kh-scroll">
                    <div style={{ fontFamily: FC, fontSize: '0.7rem', color: GOLD, letterSpacing: 4, marginBottom: 20 }}>SELECT MEMBER</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                        {lockedMembers.map((m: any, i: number) => (
                            <div key={m.memberId} className="kh-member-card kh-fade" onClick={() => { setEmail(m.memberId); setTimeout(onLoad, 50); }}
                                style={{
                                    borderRadius: 16, cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                    border: `1px solid ${BORDER}`,
                                    background: `linear-gradient(145deg, rgba(20,18,25,0.95), rgba(12,10,16,0.98))`,
                                    animationDelay: `${i * 0.06}s`,
                                }}>
                                <div style={{ height: 90, position: 'relative', overflow: 'hidden' }}>
                                    {m.avatar ? (
                                        <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.35) saturate(0.5)' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, rgba(139,0,0,0.25), rgba(30,20,40,0.8))` }} />
                                    )}
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 20%, rgba(12,10,16,0.95) 100%)' }} />
                                    <div style={{ position: 'absolute', bottom: 10, left: 16 }}>
                                        <div style={{ fontFamily: FC, fontSize: '0.7rem', color: 'rgba(255,255,255,0.9)', letterSpacing: 2 }}>{m.name}</div>
                                    </div>
                                </div>
                                <div style={{ padding: '10px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontFamily: F, fontSize: '0.55rem', color: GOLD }}>Day {m.daysIn}/{m.lockDays}</span>
                                    <span style={{ fontFamily: F, fontSize: '0.45rem', color: m.todayPerfect ? '#4caf50' : TEXT_DIM }}>
                                        {m.todayPerfect ? 'PERFECT' : `${m.todayDone}/${m.todayTotal}`}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {lockedMembers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 60, color: TEXT_DIM, fontFamily: F, fontSize: '0.6rem' }}>
                            No locked members
                        </div>
                    )}
                </div>
            )}

            {/* Member program view */}
            {email && (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Header + day cards */}
                    <div style={{ width: selectedDay ? '42%' : '100%', transition: 'width 0.4s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Member header */}
                        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                            <button onClick={() => { setEmail(''); setSelectedDay(null); }} style={{
                                background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontSize: '1rem',
                            }}>←</button>
                            {info?.avatar && (
                                <img src={info.avatar} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: `1px solid ${BORDER}` }} />
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: FC, fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', letterSpacing: 2 }}>
                                    {info?.name || email.split('@')[0]}
                                </div>
                                <div style={{ fontFamily: F, fontSize: '0.45rem', color: TEXT_DIM }}>
                                    Day {info?.daysIn || '?'} of {info?.lockDays || '?'} • {info?.tier || 'vault'}
                                </div>
                            </div>
                            {!program ? (
                                <button onClick={onGenerate} style={{
                                    padding: '8px 20px', borderRadius: 8, border: `1px solid ${RED}`, cursor: 'pointer',
                                    background: RED_DIM, color: RED, fontFamily: F, fontSize: '0.55rem', letterSpacing: 2,
                                }}>{saving ? 'GENERATING...' : 'GENERATE PROGRAM'}</button>
                            ) : (
                                <button onClick={() => { if (selectedDay) onSaveDay(selectedDay, program[String(selectedDay)] || []); }} style={{
                                    padding: '8px 20px', borderRadius: 8, border: `1px solid ${GOLD_DIM}`, cursor: 'pointer',
                                    background: 'rgba(197,160,89,0.06)', color: GOLD, fontFamily: F, fontSize: '0.55rem', letterSpacing: 2,
                                    opacity: selectedDay ? 1 : 0.3,
                                }}>{saving ? 'SAVING...' : 'SAVE DAY'}</button>
                            )}
                        </div>

                        {/* Day cards */}
                        {program ? (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }} className="kh-scroll">
                                {PHASES.map(phase => (
                                    <div key={phase.name} style={{ marginBottom: 24 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingLeft: 4 }}>
                                            <div style={{ width: 3, height: 18, borderRadius: 2, background: phase.color }} />
                                            <span style={{ fontFamily: FC, fontSize: '0.5rem', color: phase.color, letterSpacing: 4 }}>{phase.name}</span>
                                            <div style={{ flex: 1, height: 1, background: BORDER }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 1fr' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                                            {phase.days.map(d => {
                                                const tasks = program[String(d)] || [];
                                                const isActive = selectedDay === d;
                                                const isCurrent = info?.daysIn === d;
                                                return (
                                                    <div key={d} className="kh-day-card" onClick={() => setSelectedDay(isActive ? null : d)} style={{
                                                        borderRadius: 12, cursor: 'pointer', overflow: 'hidden', padding: '12px 14px',
                                                        border: `1px solid ${isActive ? GOLD_DIM : isCurrent ? 'rgba(139,0,0,0.4)' : BORDER}`,
                                                        background: isActive ? 'rgba(197,160,89,0.04)' : isCurrent ? 'rgba(139,0,0,0.04)' : SURFACE,
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                            <span style={{ fontFamily: FC, fontSize: '0.9rem', color: isActive ? GOLD : isCurrent ? RED : 'rgba(255,255,255,0.5)' }}>{d}</span>
                                                            {isCurrent && <span style={{ fontFamily: F, fontSize: '0.4rem', color: RED, letterSpacing: 2 }}>TODAY</span>}
                                                            <span style={{ fontFamily: F, fontSize: '0.45rem', color: TEXT_DIM }}>{tasks.length}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                            {tasks.slice(0, 5).map((t: Task, i: number) => {
                                                                const meta = TASK_META[t.type] || { icon: '•', color: '#666' };
                                                                return <span key={i} style={{ fontSize: '0.5rem', color: `${meta.color}99` }}>{meta.icon}</span>;
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.2 }}>⛓</div>
                                    <div style={{ fontFamily: F, fontSize: '0.6rem', color: TEXT_DIM, letterSpacing: 2 }}>
                                        {loading ? 'LOADING...' : 'NO PROGRAM FOUND'}
                                    </div>
                                    <div style={{ fontFamily: F, fontSize: '0.5rem', color: TEXT_DIM, marginTop: 4 }}>
                                        Generate a program from the master template
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Day detail */}
                    {selectedDay && program && (
                        <DayDetailPanel
                            dayNum={selectedDay} tasks={program[String(selectedDay)] || []}
                            onClose={() => setSelectedDay(null)}
                            onUpdateTask={(i: number, f: string, v: any) => onUpdateTask(selectedDay, i, f, v)}
                            onAddTask={(type: string) => onAddTask(selectedDay, type)}
                            onRemoveTask={(i: number) => onRemoveTask(selectedDay, i)}
                            onMoveTask={(from: number, to: number) => onMoveTask(selectedDay, from, to)}
                            dragIdx={dragIdx} setDragIdx={setDragIdx}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
