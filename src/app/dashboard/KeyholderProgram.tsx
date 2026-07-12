'use client';

import { useState, useEffect, useRef } from 'react';

const F = "'Rajdhani', sans-serif";
const FC = "'Cinzel', serif";
const GOLD = '#c5a059';
const GOLD_DIM = 'rgba(197,160,89,0.25)';
const RED = 'rgba(160,20,30,0.85)';
const RED_DIM = 'rgba(139,0,0,0.15)';
const BG = '#08080c';
const SURFACE = 'rgba(255,255,255,0.025)';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = 'rgba(255,255,255,0.7)';
const TEXT_DIM = 'rgba(255,255,255,0.25)';

const TASK_META: Record<string, { label: string; icon: string; color: string; glow: string; configKey?: string }> = {
    kneel:          { label: 'KNEEL',        icon: '🧎', color: '#c5a059', glow: '197,160,89' },
    chastity_check: { label: 'CHASTITY',     icon: '🔒', color: '#8b0000', glow: '139,0,0' },
    spin:           { label: 'SPIN WHEEL',   icon: '🎰', color: '#9b59b6', glow: '155,89,182', configKey: 'spin_wheel' },
    card:           { label: 'TASK CARD',    icon: '🃏', color: '#2ecc71', glow: '46,204,113', configKey: 'card_deck' },
    tribute:        { label: 'TRIBUTE',      icon: '💰', color: '#f39c12', glow: '243,156,18' },
    journal:        { label: 'JOURNAL',      icon: '📖', color: '#3498db', glow: '52,152,219' },
    worship:        { label: 'WORSHIP',      icon: '🙏', color: '#e74c3c', glow: '231,76,60' },
    lines:          { label: 'WRITE LINES',  icon: '✍️', color: '#1abc9c', glow: '26,188,156', configKey: 'lines_texts' },
    edge:           { label: 'EDGE',         icon: '🔥', color: '#e91e63', glow: '233,30,99' },
    denial:         { label: 'DENIAL',       icon: '⛔', color: '#c0392b', glow: '192,57,43' },
    confession:     { label: 'CONFESSION',   icon: '💬', color: '#8e44ad', glow: '142,68,173' },
    cold_shower:    { label: 'COLD SHOWER',  icon: '🧊', color: '#00bcd4', glow: '0,188,212' },
    exercise:       { label: 'EXERCISE',     icon: '💪', color: '#4caf50', glow: '76,175,80', configKey: 'exercises' },
    corner_time:    { label: 'CORNER TIME',  icon: '⏱️', color: '#607d8b', glow: '96,125,139' },
    body_writing:   { label: 'BODY WRITING', icon: '🖊️', color: '#ff5722', glow: '255,87,34', configKey: 'body_writing' },
    gratitude:      { label: 'GRATITUDE',    icon: '⭐', color: '#ffc107', glow: '255,193,7' },
    quiz:           { label: 'QUIZ',         icon: '❓', color: '#00bcd4', glow: '0,188,212', configKey: 'quiz_questions' },
    essay:          { label: 'ESSAY',        icon: '📝', color: '#795548', glow: '121,85,72' },
    trial:          { label: 'TRIAL',        icon: '⚔️', color: '#9c27b0', glow: '156,39,176' },
};

const PHASES = [
    { name: 'OBEDIENCE', sub: 'Foundation', days: [1,2,3,4,5,6,7], color: 'rgba(197,160,89,0.7)' },
    { name: 'DISCIPLINE', sub: 'Building', days: [8,9,10,11,12,13,14], color: 'rgba(180,40,40,0.7)' },
    { name: 'ENDURANCE', sub: 'Testing', days: [15,16,17,18,19,20,21], color: 'rgba(156,39,176,0.7)' },
    { name: 'DEVOTION', sub: 'Proving', days: [22,23,24,25,26,27,28,29,30], color: 'rgba(197,160,89,0.9)' },
];

const CONFIG_SECTIONS = [
    { key: 'spin_wheel', title: 'SPIN WHEEL', desc: 'What they land on' },
    { key: 'card_deck', title: 'TASK CARDS', desc: 'Random task draws' },
    { key: 'lines_texts', title: 'WRITING LINES', desc: 'Repeated text' },
    { key: 'body_writing', title: 'BODY WRITING', desc: 'Words on body' },
    { key: 'quiz_questions', title: 'QUIZ', desc: 'Rule questions' },
    { key: 'exercises', title: 'EXERCISES', desc: 'Physical tasks' },
];

interface Task { type: string; target: number; label: string; }
type ViewMode = 'program' | 'config' | 'member';

/* ── DEFAULT 30-DAY FORMULA ── */
function _kt(d: number): number {
    if (d <= 3) return 4; if (d <= 6) return 6; if (d <= 11) return 8;
    if (d <= 14) return 10; if (d <= 19) return 12; if (d <= 24) return 14;
    if (d <= 27) return 16; if (d <= 29) return 18; return 20;
}
function _ddt(d: number): Task[] {
    const t: Task[] = [{ type: 'kneel', target: _kt(d), label: `Kneel ${_kt(d)} times` }];
    if (d===1) t.push({ type: 'journal', target: 1, label: 'Journal: "Why I submitted"' });
    if (d===2) t.push({ type: 'spin', target: 1, label: 'Spin the wheel' });
    if (d===3) t.push({ type: 'lines', target: 30, label: 'Write lines ×30' });
    if (d===4) t.push({ type: 'tribute', target: 3, label: 'Tribute 3 coins' });
    if (d===5) t.push({ type: 'worship', target: 1, label: 'Worship message' });
    if (d===6) t.push({ type: 'card', target: 1, label: 'Draw a task card' });
    if (d===7) { t.push({ type: 'cold_shower', target: 60, label: 'Cold shower 60s' }); t.push({ type: 'confession', target: 1, label: 'Weekly confession' }); }
    if (d===8) { t.push({ type: 'edge', target: 3, label: 'Edge 3 times' }); t.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
    if (d===9) { t.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); t.push({ type: 'tribute', target: 5, label: 'Tribute 5 coins' }); }
    if (d===10) { t.push({ type: 'lines', target: 50, label: 'Write lines ×50' }); t.push({ type: 'corner_time', target: 10, label: 'Corner time 10min' }); }
    if (d===11) t.push({ type: 'body_writing', target: 1, label: 'Body writing: OWNED' });
    if (d===12) { t.push({ type: 'card', target: 1, label: 'Draw a task card' }); t.push({ type: 'worship', target: 1, label: 'Worship message' }); }
    if (d===13) { t.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); t.push({ type: 'gratitude', target: 5, label: 'Gratitude list (5)' }); }
    if (d===14) { t.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); t.push({ type: 'confession', target: 1, label: 'Confession' }); }
    if (d===15) { t.push({ type: 'exercise', target: 50, label: '50 pushups' }); t.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); }
    if (d===16) { t.push({ type: 'edge', target: 5, label: 'Edge 5 times' }); t.push({ type: 'lines', target: 75, label: 'Write lines ×75' }); }
    if (d===17) { t.push({ type: 'quiz', target: 1, label: "Quiz: Queen's rules" }); t.push({ type: 'journal', target: 1, label: 'Journal entry' }); }
    if (d===18) { t.push({ type: 'tribute', target: 10, label: 'Tribute 10 coins' }); t.push({ type: 'corner_time', target: 15, label: 'Corner time 15min' }); }
    if (d===19) { t.push({ type: 'body_writing', target: 1, label: 'Body writing photo' }); t.push({ type: 'card', target: 1, label: 'Draw a task card' }); }
    if (d===20) { t.push({ type: 'cold_shower', target: 90, label: 'Cold shower 90s' }); t.push({ type: 'worship', target: 1, label: 'Worship message' }); t.push({ type: 'edge', target: 5, label: 'Edge 5×' }); }
    if (d===21) { t.push({ type: 'denial', target: 1, label: 'Denial day (24h)' }); t.push({ type: 'confession', target: 1, label: 'Confession' }); }
    if (d===22) { t.push({ type: 'tribute', target: 15, label: 'Tribute 15 coins' }); t.push({ type: 'gratitude', target: 10, label: 'Gratitude (10)' }); }
    if (d===23) { t.push({ type: 'edge', target: 7, label: 'Edge 7 times' }); t.push({ type: 'spin', target: 1, label: 'Spin the wheel' }); t.push({ type: 'lines', target: 100, label: 'Lines ×100' }); }
    if (d===24) { t.push({ type: 'exercise', target: 75, label: '75 pushups' }); t.push({ type: 'body_writing', target: 1, label: 'Body writing' }); t.push({ type: 'journal', target: 1, label: 'Journal' }); }
    if (d===25) { t.push({ type: 'card', target: 1, label: 'Task card' }); t.push({ type: 'corner_time', target: 20, label: 'Corner 20min' }); t.push({ type: 'worship', target: 1, label: 'Worship' }); }
    if (d===26) { t.push({ type: 'cold_shower', target: 120, label: 'Cold shower 120s' }); t.push({ type: 'edge', target: 7, label: 'Edge 7×' }); t.push({ type: 'tribute', target: 10, label: 'Tribute 10' }); }
    if (d===27) { t.push({ type: 'denial', target: 1, label: 'Denial day' }); t.push({ type: 'essay', target: 1, label: 'Essay: "What I learned"' }); }
    if (d===28) { t.push({ type: 'quiz', target: 1, label: 'Quiz' }); t.push({ type: 'confession', target: 1, label: 'Confession' }); t.push({ type: 'spin', target: 1, label: 'Spin' }); t.push({ type: 'lines', target: 100, label: 'Lines ×100' }); }
    if (d===29) { t.push({ type: 'edge', target: 10, label: 'Edge 10×' }); t.push({ type: 'tribute', target: 20, label: 'Tribute 20' }); t.push({ type: 'exercise', target: 100, label: '100 pushups' }); }
    if (d===30) { t.push({ type: 'journal', target: 1, label: 'Final devotion' }); t.push({ type: 'worship', target: 1, label: 'Worship' }); t.push({ type: 'gratitude', target: 10, label: 'Gratitude (10)' }); t.push({ type: 'body_writing', target: 1, label: 'Body writing' }); t.push({ type: 'tribute', target: 25, label: 'Tribute 25' }); }
    return t;
}
function _genDefaults(): Record<string, Task[]> {
    const d: Record<string, Task[]> = {};
    for (let i = 1; i <= 30; i++) d[String(i)] = _ddt(i);
    return d;
}

/* ══════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════ */
export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [view, setView] = useState<ViewMode>(initialMember ? 'member' : 'program');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [templateDays, setTemplateDays] = useState<Record<string, Task[]>>(_genDefaults());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [lockedMembers, setLockedMembers] = useState<any[]>([]);
    const [configSection, setConfigSection] = useState('spin_wheel');
    const [configData, setConfigData] = useState<Record<string, any>>({});
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string, Task[]> | null>(null);
    const [memberSelectedDay, setMemberSelectedDay] = useState<number | null>(null);
    const [memberInfo, setMemberInfo] = useState<any>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    useEffect(() => {
        loadTemplate(); loadConfig(); loadLockedMembers();
        if (initialMember) setTimeout(() => loadMemberProgram(), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadLockedMembers = async () => {
        try { const r = await fetch('/api/vault/program?listLocked=true'); const j = await r.json(); if (j.locked) setLockedMembers(j.locked); } catch {}
    };
    const loadTemplate = async () => {
        try {
            const r = await fetch('/api/vault/program?template=true'); const j = await r.json();
            if (j.template && j.template.length > 0) {
                const days: Record<string, Task[]> = {};
                for (const row of j.template) { days[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks; }
                setTemplateDays(days);
            }
            // else keep the defaults that were set in useState
        } catch {}
    };
    const loadConfig = async () => {
        try { const r = await fetch('/api/vault/program?config=true'); const j = await r.json();
            if (j.config) { const m: Record<string, any> = {}; for (const row of j.config) { m[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value; } setConfigData(m); }
        } catch {}
    };
    const loadMemberProgram = async () => {
        if (!memberEmail) return; setLoading(true);
        try { const r = await fetch(`/api/vault/program?memberId=${encodeURIComponent(memberEmail)}`); const j = await r.json();
            if (j.program?.program) { setMemberProgram(typeof j.program.program === 'string' ? JSON.parse(j.program.program) : j.program.program); } else { setMemberProgram(null); }
            setMemberInfo(lockedMembers.find((m: any) => m.memberId.toLowerCase() === memberEmail.toLowerCase()) || null);
        } catch {} setLoading(false);
    };
    const generateMemberProgram = async () => {
        if (!memberEmail) return; setSaving(true);
        try { await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_program', memberId: memberEmail }) }); await loadMemberProgram(); } catch {} setSaving(false);
    };
    const saveTemplate = async () => {
        setSaving(true);
        try { await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_template', days: templateDays }) }); } catch {} setSaving(false);
    };
    const saveConfig = async (key: string, value: any) => {
        setSaving(true);
        try { await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_config', key, value }) }); } catch {} setSaving(false);
    };
    const saveMemberDay = async (dayNum: number, tasks: Task[]) => {
        if (!memberEmail) return; setSaving(true);
        try { await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_day', memberId: memberEmail, dayNumber: dayNum, tasks }) }); } catch {} setSaving(false);
    };

    const getDays = () => view === 'member' && memberProgram ? memberProgram : templateDays;
    const setDays = (d: Record<string, Task[]>) => { if (view === 'member') setMemberProgram(d); else setTemplateDays(d); };
    const getSel = () => view === 'member' ? memberSelectedDay : selectedDay;
    const setSel = (d: number | null) => { if (view === 'member') setMemberSelectedDay(d); else setSelectedDay(d); };

    const updateTask = (dayNum: number, idx: number, field: string, value: any) => {
        const days = { ...getDays() }; const tasks = [...(days[String(dayNum)] || [])];
        tasks[idx] = { ...tasks[idx], [field]: value }; days[String(dayNum)] = tasks; setDays(days);
    };
    const addTask = (dayNum: number, type: string) => {
        const meta = TASK_META[type]; const days = { ...getDays() }; const tasks = [...(days[String(dayNum)] || [])];
        tasks.push({ type, target: 1, label: meta?.label || type }); days[String(dayNum)] = tasks; setDays(days);
    };
    const removeTask = (dayNum: number, idx: number) => {
        const days = { ...getDays() }; const tasks = [...(days[String(dayNum)] || [])]; tasks.splice(idx, 1); days[String(dayNum)] = tasks; setDays(days);
    };
    const moveTask = (dayNum: number, from: number, to: number) => {
        if (from === to) return; const days = { ...getDays() }; const tasks = [...(days[String(dayNum)] || [])]; const [m] = tasks.splice(from, 1); tasks.splice(to, 0, m); days[String(dayNum)] = tasks; setDays(days);
    };

    const sel = getSel();
    const days = getDays();

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: F }}>
            <style>{`
                input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
                input[type=number]{-moz-appearance:textfield}
                .kdc{transition:all .35s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
                .kdc:hover{transform:translateY(-5px) scale(1.02);box-shadow:0 14px 40px rgba(0,0,0,.5)}
                .ktc{transition:all .25s cubic-bezier(.4,0,.2,1);cursor:grab;position:relative;overflow:hidden}
                .ktc:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.4)}
                .ktc:active{cursor:grabbing;transform:scale(1.03);z-index:100}
                .kmc{transition:all .35s cubic-bezier(.4,0,.2,1)}
                .kmc:hover{transform:translateY(-5px);box-shadow:0 16px 50px rgba(0,0,0,.6)}
                @keyframes kPulse{0%,100%{box-shadow:0 0 15px rgba(197,160,89,.06)}50%{box-shadow:0 0 35px rgba(197,160,89,.13)}}
                @keyframes kFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
                @keyframes kSlide{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
                .kfade{animation:kFade .4s ease forwards}
                .kslide{animation:kSlide .35s ease forwards}
                .kpulse{animation:kPulse 4s ease-in-out infinite}
                .kdrag{border-color:${GOLD}!important;box-shadow:0 0 25px rgba(197,160,89,.15)!important}
                .kscr::-webkit-scrollbar{width:3px}.kscr::-webkit-scrollbar-track{background:transparent}.kscr::-webkit-scrollbar-thumb{background:rgba(197,160,89,.12);border-radius:4px}
                .kbtn{transition:all .2s ease}.kbtn:hover{transform:scale(1.04);box-shadow:0 4px 16px rgba(0,0,0,.3)}
            `}</style>

            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${BORDER}`, gap: 14, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: GOLD, fontSize: '1.3rem', cursor: 'pointer', padding: 0 }}>←</button>
                <h1 style={{ fontFamily: FC, fontSize: '0.75rem', color: GOLD, letterSpacing: 6, margin: 0, flex: 1 }}>KEYHOLDER PROGRAM</h1>
                <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: 3 }}>
                    {(['program','config','member'] as ViewMode[]).map(v => (
                        <button key={v} onClick={() => setView(v)} style={{
                            padding: '7px 18px', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: F,
                            fontSize: '.58rem', letterSpacing: 3, fontWeight: 600, transition: 'all .25s',
                            background: view === v ? (v === 'config' ? RED_DIM : 'rgba(197,160,89,.1)') : 'transparent',
                            color: view === v ? (v === 'config' ? RED : GOLD) : TEXT_DIM,
                        }}>{v.toUpperCase()}</button>
                    ))}
                </div>
            </div>

            {/* LOCKED MEMBERS STRIP */}
            {lockedMembers.length > 0 && (
                <div style={{ display: 'flex', gap: 16, padding: '14px 24px', overflowX: 'auto', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }} className="kscr">
                    {lockedMembers.map((m: any) => (
                        <div key={m.memberId} className="kmc"
                            onClick={() => { setMemberEmail(m.memberId); setView('member'); setTimeout(() => loadMemberProgram(), 80); }}
                            style={{
                                minWidth: 220, borderRadius: 16, cursor: 'pointer', overflow: 'hidden',
                                border: `1px solid ${memberEmail === m.memberId ? GOLD_DIM : BORDER}`,
                                background: 'linear-gradient(145deg, rgba(20,18,25,.95), rgba(10,8,14,.98))',
                            }}>
                            <div style={{ height: 80, position: 'relative', overflow: 'hidden' }}>
                                {m.avatar ? (
                                    <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.3) saturate(.5)' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(139,0,0,.3), rgba(30,20,40,.8))' }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 15%, rgba(10,8,14,.95) 100%)' }} />
                                <div style={{ position: 'absolute', top: 8, right: 10, background: 'rgba(0,0,0,.7)', borderRadius: 8, padding: '3px 10px', border: `1px solid ${GOLD_DIM}` }}>
                                    <span style={{ fontFamily: F, fontSize: '.6rem', color: GOLD, fontWeight: 700 }}>DAY {m.daysIn}</span>
                                </div>
                                {/* Avatar circle */}
                                {m.avatar && (
                                    <div style={{ position: 'absolute', bottom: -16, left: 14, width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', border: `2px solid rgba(197,160,89,.3)` }}>
                                        <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '10px 14px 12px', paddingLeft: m.avatar ? 60 : 14 }}>
                                <div style={{ fontFamily: FC, fontSize: '.6rem', color: 'rgba(255,255,255,.9)', letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {m.name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                                    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ width: `${m.lockDays ? (m.daysIn/m.lockDays)*100 : 0}%`, height: '100%', background: `linear-gradient(90deg, ${GOLD}, rgba(139,0,0,.8))`, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontFamily: F, fontSize: '.42rem', color: TEXT_DIM, whiteSpace: 'nowrap' }}>{m.daysIn}/{m.lockDays}d</span>
                                </div>
                                <div style={{ fontFamily: F, fontSize: '.42rem', color: m.todayPerfect ? GOLD : TEXT_DIM, marginTop: 3 }}>
                                    {m.todayPerfect ? '✦ PERFECT' : `${m.todayDone}/${m.todayTotal} today`}
                                    {m.streak > 0 && <span style={{ color: 'rgba(255,100,50,.7)', marginLeft: 6 }}>🔥{m.streak}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MAIN */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {view === 'program' && <ProgramView days={templateDays} sel={selectedDay} setSel={setSelectedDay} updateTask={updateTask} addTask={addTask} removeTask={removeTask} moveTask={moveTask} saveTemplate={saveTemplate} saving={saving} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
                {view === 'config' && <ConfigView configData={configData} setConfigData={setConfigData} configSection={configSection} setConfigSection={setConfigSection} onSave={saveConfig} saving={saving} />}
                {view === 'member' && <MemberView email={memberEmail} setEmail={setMemberEmail} program={memberProgram} sel={memberSelectedDay} setSel={setMemberSelectedDay} info={memberInfo} locked={lockedMembers} onLoad={loadMemberProgram} onGenerate={generateMemberProgram} updateTask={updateTask} addTask={addTask} removeTask={removeTask} moveTask={moveTask} saveMemberDay={saveMemberDay} saving={saving} loading={loading} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
            </div>
        </div>
    );
}

/* ═══════════════════ PROGRAM VIEW ═══════════════════ */
function ProgramView({ days, sel, setSel, updateTask, addTask, removeTask, moveTask, saveTemplate, saving, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: sel ? '35%' : '100%', transition: 'width .4s ease', overflowY: 'auto', padding: '18px 22px' }} className="kscr">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <div style={{ fontFamily: FC, fontSize: '.6rem', color: 'rgba(255,255,255,.5)', letterSpacing: 4 }}>MASTER TEMPLATE</div>
                        <div style={{ fontFamily: F, fontSize: '.42rem', color: TEXT_DIM, marginTop: 2 }}>🔒 Chastity check auto-included every day. Click day to edit.</div>
                    </div>
                    <button onClick={saveTemplate} className="kbtn" style={{ padding: '10px 26px', borderRadius: 10, border: `1px solid ${GOLD_DIM}`, cursor: 'pointer', background: 'rgba(197,160,89,.06)', color: GOLD, fontFamily: F, fontSize: '.55rem', letterSpacing: 3, fontWeight: 600 }}>
                        {saving ? 'SAVING...' : 'SAVE'}
                    </button>
                </div>
                {PHASES.map(phase => (
                    <div key={phase.name} style={{ marginBottom: 24 }} className="kfade">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 4 }}>
                            <div style={{ width: 4, height: 22, borderRadius: 2, background: phase.color }} />
                            <span style={{ fontFamily: FC, fontSize: '.55rem', color: phase.color, letterSpacing: 5 }}>{phase.name}</span>
                            <span style={{ fontFamily: F, fontSize: '.42rem', color: TEXT_DIM, letterSpacing: 2 }}>{phase.sub}</span>
                            <div style={{ flex: 1, height: 1, background: BORDER }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: sel ? 'repeat(auto-fill,minmax(110px,1fr))' : 'repeat(auto-fill,minmax(170px,1fr))', gap: 10 }}>
                            {phase.days.map(d => <DayCard key={d} d={d} tasks={days[String(d)]||[]} isActive={sel===d} compact={!!sel} onClick={() => setSel(sel===d ? null : d)} />)}
                        </div>
                    </div>
                ))}
            </div>
            {sel && <TaskPanel dayNum={sel} tasks={days[String(sel)]||[]} onClose={() => setSel(null)} updateTask={(i: number,f: string,v: any) => updateTask(sel,i,f,v)} addTask={(t: string) => addTask(sel,t)} removeTask={(i: number) => removeTask(sel,i)} moveTask={(a: number,b: number) => moveTask(sel,a,b)} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
        </div>
    );
}

/* ═══════════════════ DAY CARD ═══════════════════ */
function DayCard({ d, tasks, isActive, compact, onClick }: { d: number; tasks: Task[]; isActive: boolean; compact: boolean; onClick: () => void }) {
    const total = tasks.length + 1; // +1 chastity
    return (
        <div className={`kdc ${isActive ? 'kpulse' : ''}`} onClick={onClick} style={{
            borderRadius: 14, cursor: 'pointer',
            border: `1px solid ${isActive ? GOLD_DIM : BORDER}`,
            background: isActive ? 'linear-gradient(145deg, rgba(197,160,89,.07), rgba(10,8,14,.98))' : 'linear-gradient(145deg, rgba(18,16,22,.98), rgba(10,8,14,.99))',
            padding: compact ? '10px 12px' : '14px 16px',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: compact ? 4 : 8 }}>
                <div>
                    <div style={{ fontFamily: FC, fontSize: compact ? '.85rem' : '1.2rem', color: isActive ? GOLD : 'rgba(255,255,255,.5)', lineHeight: 1 }}>{d}</div>
                    {!compact && <div style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 2, marginTop: 2 }}>DAY</div>}
                </div>
                <span style={{ fontFamily: F, fontSize: '.45rem', color: isActive ? GOLD : TEXT_DIM, fontWeight: 600, background: isActive ? 'rgba(197,160,89,.08)' : 'rgba(255,255,255,.03)', padding: '2px 8px', borderRadius: 10 }}>{total}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: compact ? '.55rem' : '.7rem', opacity: .5 }}>🔒</span>
                {tasks.slice(0, compact ? 3 : 6).map((t: Task, i: number) => (
                    <span key={i} style={{ fontSize: compact ? '.55rem' : '.7rem', opacity: .65 }} title={t.label}>{TASK_META[t.type]?.icon || '•'}</span>
                ))}
                {tasks.length > (compact ? 3 : 6) && <span style={{ fontSize: '.4rem', color: TEXT_DIM, alignSelf: 'center' }}>+{tasks.length - (compact ? 3 : 6)}</span>}
            </div>
        </div>
    );
}

/* ═══════════════════ TASK PANEL (right side — big cards) ═══════════════════ */
function TaskPanel({ dayNum, tasks, onClose, updateTask, addTask, removeTask, moveTask, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    const phase = PHASES.find(p => p.days.includes(dayNum));
    const [addOpen, setAddOpen] = useState(false);

    return (
        <div className="kslide" style={{ width: '65%', borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: `linear-gradient(180deg, rgba(14,12,18,.99), ${BG})`, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 28px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                        <span style={{ fontFamily: FC, fontSize: '2rem', color: 'rgba(255,255,255,.85)', lineHeight: 1 }}>Day {dayNum}</span>
                        <span style={{ fontFamily: FC, fontSize: '.48rem', color: phase?.color, letterSpacing: 4 }}>{phase?.name}</span>
                    </div>
                    <div style={{ fontFamily: F, fontSize: '.42rem', color: TEXT_DIM, letterSpacing: 2, marginTop: 3 }}>Drag cards to reorder • {tasks.length + 1} tasks total</div>
                </div>
                <button onClick={onClose} className="kbtn" style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 16px', cursor: 'pointer', color: TEXT_DIM, fontFamily: F, fontSize: '.48rem', letterSpacing: 2 }}>CLOSE</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }} className="kscr">
                {/* CONSTANT: Chastity check */}
                <div style={{ padding: '18px 22px', borderRadius: 18, marginBottom: 12, background: 'linear-gradient(135deg, rgba(139,0,0,.1), rgba(139,0,0,.02))', border: '1px solid rgba(139,0,0,.18)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 10, right: 14, fontFamily: F, fontSize: '.38rem', color: 'rgba(139,0,0,.5)', letterSpacing: 3 }}>CONSTANT</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,0,0,.1)', border: '1px solid rgba(139,0,0,.2)', fontSize: '1.5rem' }}>🔒</div>
                        <div>
                            <div style={{ fontFamily: F, fontSize: '.95rem', color: 'rgba(255,255,255,.75)', fontWeight: 700, letterSpacing: 1 }}>CHASTITY CHECK</div>
                            <div style={{ fontFamily: F, fontSize: '.45rem', color: 'rgba(139,0,0,.5)', letterSpacing: 2, marginTop: 2 }}>Photo proof • every single day • not removable</div>
                        </div>
                    </div>
                </div>

                {/* Editable task cards */}
                {tasks.map((task: Task, idx: number) => {
                    const meta = TASK_META[task.type] || { label: task.type, icon: '•', color: '#666', glow: '100,100,100' };
                    const hasConfig = !!meta.configKey;
                    const cfgItems = hasConfig ? (configData[meta.configKey!] || []) : [];

                    return (
                        <div key={idx}
                            draggable onDragStart={() => setDragIdx(idx)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('kdrag'); }}
                            onDragLeave={(e) => e.currentTarget.classList.remove('kdrag')}
                            onDrop={(e) => { e.currentTarget.classList.remove('kdrag'); if (dragIdx !== null) moveTask(dragIdx, idx); setDragIdx(null); }}
                            onDragEnd={() => setDragIdx(null)}
                            className="ktc"
                            style={{
                                borderRadius: 18, marginBottom: 12, opacity: dragIdx === idx ? .25 : 1,
                                border: `1px solid rgba(${meta.glow},.18)`,
                                background: `linear-gradient(135deg, rgba(${meta.glow},.08), rgba(${meta.glow},.015))`,
                            }}>
                            {/* Main row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px' }}>
                                <div style={{ color: `rgba(${meta.glow},.3)`, fontSize: '.75rem', cursor: 'grab', userSelect: 'none' }}>⠿</div>
                                <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(${meta.glow},.1)`, border: `1px solid rgba(${meta.glow},.15)`, fontSize: '1.5rem', flexShrink: 0 }}>{meta.icon}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <input value={task.label} onChange={(e) => updateTask(idx, 'label', e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontFamily: F, fontSize: '.95rem', color: 'rgba(255,255,255,.8)', fontWeight: 700, letterSpacing: .5 }} />
                                    <div style={{ fontFamily: F, fontSize: '.4rem', color: `rgba(${meta.glow},.7)`, letterSpacing: 3, marginTop: 2 }}>
                                        {meta.label}
                                        {hasConfig && (
                                            <span onClick={(e) => { e.stopPropagation(); setConfigSection(meta.configKey!); setView('config'); }} style={{ color: GOLD, marginLeft: 10, cursor: 'pointer', textDecoration: 'underline', letterSpacing: 2 }}>EDIT OPTIONS →</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <span style={{ fontFamily: F, fontSize: '.32rem', color: TEXT_DIM, letterSpacing: 2 }}>TARGET</span>
                                    <input type="number" value={task.target} onChange={(e) => updateTask(idx, 'target', parseInt(e.target.value) || 1)} style={{ width: 52, height: 42, textAlign: 'center', borderRadius: 10, background: 'rgba(0,0,0,.3)', border: `1px solid rgba(${meta.glow},.2)`, color: GOLD, fontFamily: F, fontSize: '1.1rem', fontWeight: 700, outline: 'none' }} />
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); removeTask(idx); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,60,60,.2)', fontSize: '1.2rem', padding: '4px 8px', transition: 'color .2s' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,60,60,.8)')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,60,60,.2)')}>×</button>
                            </div>

                            {/* Config preview (if configurable) */}
                            {hasConfig && cfgItems.length > 0 && (
                                <div style={{ padding: '0 22px 14px', borderTop: `1px solid rgba(${meta.glow},.06)`, marginTop: -4, paddingTop: 10 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {cfgItems.slice(0, 6).map((item: any, i: number) => {
                                            const lbl = typeof item === 'string' ? item : (item.label || item.title || item.question || item.type || '');
                                            return <span key={i} style={{ fontFamily: F, fontSize: '.42rem', color: `rgba(${meta.glow},.5)`, background: `rgba(${meta.glow},.06)`, padding: '3px 8px', borderRadius: 6, border: `1px solid rgba(${meta.glow},.08)` }}>{lbl}</span>;
                                        })}
                                        {cfgItems.length > 6 && <span style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM, alignSelf: 'center' }}>+{cfgItems.length - 6} more</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Add task */}
                <div style={{ marginTop: 14 }}>
                    <button onClick={() => setAddOpen(!addOpen)} className="kbtn" style={{ width: '100%', padding: '16px', borderRadius: 16, cursor: 'pointer', border: `2px dashed ${addOpen ? GOLD_DIM : 'rgba(255,255,255,.06)'}`, background: addOpen ? 'rgba(197,160,89,.03)' : 'transparent', color: addOpen ? GOLD : TEXT_DIM, fontFamily: F, fontSize: '.58rem', letterSpacing: 3, fontWeight: 600 }}>+ ADD TASK CARD</button>
                    {addOpen && (
                        <div className="kfade" style={{ marginTop: 10, padding: 16, borderRadius: 16, background: 'rgba(10,8,14,.98)', border: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                            {Object.entries(TASK_META).filter(([t]) => t !== 'chastity_check').map(([type, meta]) => (
                                <button key={type} onClick={() => { addTask(type); setAddOpen(false); }} className="kbtn" style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px', borderRadius: 14,
                                    border: `1px solid rgba(${meta.glow},.15)`, cursor: 'pointer',
                                    background: `linear-gradient(135deg, rgba(${meta.glow},.08), rgba(${meta.glow},.02))`,
                                    fontFamily: F, fontSize: '.55rem', fontWeight: 600, color: `rgba(${meta.glow},.8)`, textAlign: 'left',
                                }}>
                                    <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
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

/* ═══════════════════ CONFIG VIEW ═══════════════════ */
function ConfigView({ configData, setConfigData, configSection, setConfigSection, onSave, saving }: any) {
    const section = CONFIG_SECTIONS.find(s => s.key === configSection)!;
    const data = configData[configSection] || [];
    const updateItem = (idx: number, field: string, value: any) => {
        const n = [...data]; if (field === '_s') n[idx] = value; else n[idx] = { ...n[idx], [field]: value };
        setConfigData({ ...configData, [configSection]: n });
    };
    const addItem = () => {
        const n = [...data];
        if (configSection === 'spin_wheel') n.push({ label: 'New option', effect: 'nothing', value: 0, weight: 1 });
        else if (configSection === 'card_deck') n.push({ title: 'New card', description: '', category: 'control' });
        else if (configSection === 'lines_texts') n.push('New line');
        else if (configSection === 'body_writing') n.push('WORD');
        else if (configSection === 'quiz_questions') n.push({ question: '', answer: '' });
        else if (configSection === 'exercises') n.push({ type: 'pushups', count: 20 });
        setConfigData({ ...configData, [configSection]: n });
    };
    const removeItem = (idx: number) => { const n = [...data]; n.splice(idx, 1); setConfigData({ ...configData, [configSection]: n }); };

    const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', color: 'rgba(255,255,255,.8)', fontFamily: F, fontSize: '.72rem', outline: 'none', width: '100%' };
    const numInp: React.CSSProperties = { ...inp, width: 75, textAlign: 'center' as const, fontSize: '.9rem', color: GOLD, fontWeight: 700 };

    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 220, borderRight: `1px solid ${BORDER}`, overflowY: 'auto', padding: '18px 0' }} className="kscr">
                {CONFIG_SECTIONS.map(s => (
                    <div key={s.key} onClick={() => setConfigSection(s.key)} style={{ padding: '14px 22px', cursor: 'pointer', borderLeft: `3px solid ${configSection === s.key ? GOLD : 'transparent'}`, background: configSection === s.key ? 'rgba(197,160,89,.04)' : 'transparent', transition: 'all .2s' }}>
                        <div style={{ fontFamily: FC, fontSize: '.48rem', color: configSection === s.key ? GOLD : TEXT, letterSpacing: 3 }}>{s.title}</div>
                        <div style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, marginTop: 2 }}>{s.desc}</div>
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }} className="kscr">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <div style={{ fontFamily: FC, fontSize: '.65rem', color: GOLD, letterSpacing: 4 }}>{section?.title}</div>
                        <div style={{ fontFamily: F, fontSize: '.42rem', color: TEXT_DIM, marginTop: 2 }}>{section?.desc} • {data.length} items</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={addItem} className="kbtn" style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'pointer', background: SURFACE, color: TEXT, fontFamily: F, fontSize: '.48rem', letterSpacing: 2 }}>+ ADD</button>
                        <button onClick={() => onSave(configSection, data)} className="kbtn" style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${GOLD_DIM}`, cursor: 'pointer', background: 'rgba(197,160,89,.06)', color: GOLD, fontFamily: F, fontSize: '.48rem', letterSpacing: 2 }}>{saving ? 'SAVING...' : 'SAVE'}</button>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.map((item: any, idx: number) => {
                        if (configSection === 'lines_texts' || configSection === 'body_writing') {
                            return (<div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
                                <span style={{ fontFamily: FC, fontSize: '.48rem', color: TEXT_DIM, width: 22 }}>{idx+1}</span>
                                <input value={item} onChange={e => updateItem(idx, '_s', e.target.value)} style={{ ...inp, flex: 1 }} />
                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                            </div>);
                        }
                        if (configSection === 'spin_wheel') {
                            return (<div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
                                <input value={item.label||''} onChange={e => updateItem(idx,'label',e.target.value)} placeholder="Label" style={{ ...inp, flex: 1 }} />
                                <input value={item.effect||''} onChange={e => updateItem(idx,'effect',e.target.value)} placeholder="Effect" style={{ ...inp, width: 100 }} />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <span style={{ fontFamily: F, fontSize: '.28rem', color: TEXT_DIM, letterSpacing: 1 }}>VAL</span>
                                    <input type="number" value={item.value??0} onChange={e => updateItem(idx,'value',parseInt(e.target.value)||0)} style={numInp} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <span style={{ fontFamily: F, fontSize: '.28rem', color: TEXT_DIM, letterSpacing: 1 }}>WT</span>
                                    <input type="number" value={item.weight??1} onChange={e => updateItem(idx,'weight',parseInt(e.target.value)||1)} style={numInp} />
                                </div>
                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                            </div>);
                        }
                        if (configSection === 'card_deck') {
                            return (<div key={idx} style={{ padding: '16px 18px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                                    <input value={item.title||''} onChange={e => updateItem(idx,'title',e.target.value)} placeholder="Title" style={{ ...inp, flex: 1, fontWeight: 700, fontSize: '.78rem' }} />
                                    <input value={item.category||''} onChange={e => updateItem(idx,'category',e.target.value)} placeholder="Category" style={{ ...inp, width: 100, fontSize: '.55rem' }} />
                                    <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                                </div>
                                <textarea value={item.description||''} onChange={e => updateItem(idx,'description',e.target.value)} placeholder="Description..." rows={2} style={{ ...inp, resize: 'vertical', fontSize: '.6rem', lineHeight: 1.5 }} />
                            </div>);
                        }
                        if (configSection === 'quiz_questions') {
                            return (<div key={idx} style={{ display: 'flex', gap: 10, padding: '14px 18px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}`, alignItems: 'center' }}>
                                <input value={item.question||''} onChange={e => updateItem(idx,'question',e.target.value)} placeholder="Question" style={{ ...inp, flex: 2 }} />
                                <input value={item.answer||''} onChange={e => updateItem(idx,'answer',e.target.value)} placeholder="Answer" style={{ ...inp, flex: 1 }} />
                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                            </div>);
                        }
                        if (configSection === 'exercises') {
                            return (<div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}` }}>
                                <input value={item.type||''} onChange={e => updateItem(idx,'type',e.target.value)} placeholder="Type" style={{ ...inp, flex: 1 }} />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <span style={{ fontFamily: F, fontSize: '.28rem', color: TEXT_DIM, letterSpacing: 1 }}>COUNT</span>
                                    <input type="number" value={item.count??10} onChange={e => updateItem(idx,'count',parseInt(e.target.value)||1)} style={numInp} />
                                </div>
                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                            </div>);
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════ MEMBER VIEW ═══════════════════ */
function MemberView({ email, setEmail, program, sel, setSel, info, locked, onLoad, onGenerate, updateTask, addTask, removeTask, moveTask, saveMemberDay, saving, loading, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!email ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="kscr">
                    <div style={{ fontFamily: FC, fontSize: '.6rem', color: GOLD, letterSpacing: 4, marginBottom: 20 }}>SELECT MEMBER</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                        {locked.map((m: any, i: number) => (
                            <div key={m.memberId} className="kmc kfade" onClick={() => { setEmail(m.memberId); setTimeout(onLoad, 80); }} style={{
                                borderRadius: 18, cursor: 'pointer', overflow: 'hidden', border: `1px solid ${BORDER}`,
                                background: 'linear-gradient(145deg, rgba(20,18,25,.95), rgba(10,8,14,.98))', animationDelay: `${i*.06}s`,
                            }}>
                                <div style={{ height: 100, position: 'relative', overflow: 'hidden' }}>
                                    {m.avatar ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.3) saturate(.5)' }} /> : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(139,0,0,.25), rgba(30,20,40,.8))' }} />}
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 15%, rgba(10,8,14,.95) 100%)' }} />
                                    <div style={{ position: 'absolute', bottom: 12, left: 16 }}>
                                        <div style={{ fontFamily: FC, fontSize: '.7rem', color: 'rgba(255,255,255,.9)', letterSpacing: 2 }}>{m.name}</div>
                                        <div style={{ fontFamily: F, fontSize: '.42rem', color: GOLD, marginTop: 2 }}>Day {m.daysIn} / {m.lockDays}</div>
                                    </div>
                                </div>
                                <div style={{ padding: '10px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginRight: 10 }}>
                                        <div style={{ width: `${m.lockDays?(m.daysIn/m.lockDays)*100:0}%`, height: '100%', background: `linear-gradient(90deg, ${GOLD}, rgba(139,0,0,.8))`, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontFamily: F, fontSize: '.42rem', color: m.todayPerfect ? '#4caf50' : TEXT_DIM }}>{m.todayPerfect ? '✦ PERFECT' : `${m.todayDone}/${m.todayTotal}`}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {locked.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: TEXT_DIM, fontFamily: F, fontSize: '.55rem' }}>No locked members</div>}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: sel ? '35%' : '100%', transition: 'width .4s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <button onClick={() => { setEmail(''); setSel(null); }} style={{ background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontSize: '1rem' }}>←</button>
                            {info?.avatar && <img src={info.avatar} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: `1px solid ${BORDER}` }} />}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: FC, fontSize: '.6rem', color: 'rgba(255,255,255,.85)', letterSpacing: 2 }}>{info?.name || email.split('@')[0]}</div>
                                <div style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM }}>Day {info?.daysIn||'?'} of {info?.lockDays||'?'}</div>
                            </div>
                            {!program ? (
                                <button onClick={onGenerate} className="kbtn" style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${RED}`, cursor: 'pointer', background: RED_DIM, color: RED, fontFamily: F, fontSize: '.5rem', letterSpacing: 2 }}>{saving?'GENERATING...':'GENERATE PROGRAM'}</button>
                            ) : (
                                <button onClick={() => { if (sel) saveMemberDay(sel, program[String(sel)]||[]); }} className="kbtn" style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${GOLD_DIM}`, cursor: 'pointer', background: 'rgba(197,160,89,.06)', color: GOLD, fontFamily: F, fontSize: '.5rem', letterSpacing: 2, opacity: sel?1:.3 }}>{saving?'SAVING...':'SAVE DAY'}</button>
                            )}
                        </div>
                        {program ? (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }} className="kscr">
                                {PHASES.map(phase => (
                                    <div key={phase.name} style={{ marginBottom: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingLeft: 4 }}>
                                            <div style={{ width: 3, height: 16, borderRadius: 2, background: phase.color }} />
                                            <span style={{ fontFamily: FC, fontSize: '.42rem', color: phase.color, letterSpacing: 4 }}>{phase.name}</span>
                                            <div style={{ flex: 1, height: 1, background: BORDER }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: sel?'1fr 1fr':'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
                                            {phase.days.map(d => {
                                                const tasks = program[String(d)]||[];
                                                const isA = sel===d;
                                                const isC = info?.daysIn===d;
                                                return (<div key={d} className="kdc" onClick={() => setSel(isA?null:d)} style={{ borderRadius: 12, cursor: 'pointer', padding: '10px 12px', border: `1px solid ${isA?GOLD_DIM:isC?'rgba(139,0,0,.4)':BORDER}`, background: isA?'rgba(197,160,89,.04)':isC?'rgba(139,0,0,.04)':SURFACE }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                        <span style={{ fontFamily: FC, fontSize: '.8rem', color: isA?GOLD:isC?RED:'rgba(255,255,255,.5)' }}>{d}</span>
                                                        {isC && <span style={{ fontFamily: F, fontSize: '.32rem', color: RED, letterSpacing: 2 }}>TODAY</span>}
                                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>{tasks.length+1}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                                        <span style={{ fontSize: '.5rem', opacity: .5 }}>🔒</span>
                                                        {tasks.slice(0,3).map((t: Task,i: number) => <span key={i} style={{ fontSize: '.5rem', opacity: .6 }}>{TASK_META[t.type]?.icon||'•'}</span>)}
                                                        {tasks.length>3 && <span style={{ fontSize: '.35rem', color: TEXT_DIM }}>+{tasks.length-3}</span>}
                                                    </div>
                                                </div>);
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 12, opacity: .2 }}>⛓</div>
                                    <div style={{ fontFamily: F, fontSize: '.55rem', color: TEXT_DIM, letterSpacing: 2 }}>{loading?'LOADING...':'NO PROGRAM FOUND'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                    {sel && program && <TaskPanel dayNum={sel} tasks={program[String(sel)]||[]} onClose={() => setSel(null)} updateTask={(i: number,f: string,v: any) => updateTask(sel,i,f,v)} addTask={(t: string) => addTask(sel,t)} removeTask={(i: number) => removeTask(sel,i)} moveTask={(a: number,b: number) => moveTask(sel,a,b)} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
                </div>
            )}
        </div>
    );
}
