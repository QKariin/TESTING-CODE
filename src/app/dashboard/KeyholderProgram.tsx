'use client';

import { useState, useEffect } from 'react';

const F = "'Rajdhani', sans-serif";
const FC = "'Cinzel', serif";
const GOLD = 'rgba(197,160,89,0.9)';
const GOLD_DIM = 'rgba(197,160,89,0.25)';
const RED = 'rgba(160,20,30,0.75)';
const RED_DIM = 'rgba(139,0,0,0.15)';
const BG = '#07070c';
const CARD_BG = 'rgba(255,255,255,0.02)';
const BORDER = 'rgba(255,255,255,0.05)';
const BORDER_HOVER = 'rgba(197,160,89,0.25)';
const TEXT = 'rgba(255,255,255,0.65)';
const TEXT_DIM = 'rgba(255,255,255,0.22)';

const TASK_TYPES: { type: string; label: string; icon: string; configKey?: string }[] = [
    { type: 'kneel', label: 'Kneel', icon: '\u25BD' },
    { type: 'chastity_check', label: 'Chastity Check', icon: '\u25C9' },
    { type: 'spin', label: 'Spin Wheel', icon: '\u25CE', configKey: 'spin_wheel' },
    { type: 'card', label: 'Task Card', icon: '\u2660', configKey: 'card_deck' },
    { type: 'tribute', label: 'Tribute', icon: '\u25C6' },
    { type: 'journal', label: 'Journal', icon: '\u270E' },
    { type: 'worship', label: 'Worship', icon: '\u2661' },
    { type: 'lines', label: 'Lines', icon: '\u2261', configKey: 'lines_texts' },
    { type: 'edge', label: 'Edge', icon: '\u2736' },
    { type: 'denial', label: 'Denial', icon: '\u2718' },
    { type: 'confession', label: 'Confession', icon: '\u2767' },
    { type: 'cold_shower', label: 'Cold Shower', icon: '\u2744' },
    { type: 'exercise', label: 'Exercise', icon: '\u2191', configKey: 'exercises' },
    { type: 'corner_time', label: 'Corner Time', icon: '\u25A2' },
    { type: 'body_writing', label: 'Body Writing', icon: '\u270D', configKey: 'body_writing' },
    { type: 'gratitude', label: 'Gratitude', icon: '\u2605' },
    { type: 'quiz', label: 'Quiz', icon: '?', configKey: 'quiz_questions' },
    { type: 'essay', label: 'Essay', icon: '\u2016' },
    { type: 'trial', label: 'Trial', icon: '\u2694' },
];

const CONFIG_SECTIONS: { key: string; title: string; description: string }[] = [
    { key: 'spin_wheel', title: 'SPIN WHEEL', description: 'What the slave lands on when they spin. Weight = probability.' },
    { key: 'card_deck', title: 'TASK CARDS', description: 'Cards the slave draws randomly. Each card is a task they must complete.' },
    { key: 'lines_texts', title: 'WRITING LINES', description: 'What text they have to write repeatedly.' },
    { key: 'body_writing', title: 'BODY WRITING', description: 'What words they write on their body for photo proof.' },
    { key: 'quiz_questions', title: 'QUIZ QUESTIONS', description: 'Questions they must answer correctly about Queen\'s rules.' },
    { key: 'exercises', title: 'EXERCISES', description: 'Physical tasks: type and count.' },
];

interface Task { type: string; target: number; label: string; }
type TabType = 'template' | 'config' | 'member';
interface SpinOption { label: string; effect: string; value: number; weight: number; }
interface CardOption { title: string; description: string; category: string; }

const PHASES = [
    { name: 'OBEDIENCE', sub: 'Foundation', days: [1,2,3,4,5,6,7] },
    { name: 'DISCIPLINE', sub: 'Building', days: [8,9,10,11,12,13,14] },
    { name: 'ENDURANCE', sub: 'Testing', days: [15,16,17,18,19,20,21] },
    { name: 'DEVOTION', sub: 'Proving', days: [22,23,24,25,26,27,28,29,30] },
];

export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [tab, setTab] = useState<TabType>(initialMember ? 'member' : 'template');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [templateDays, setTemplateDays] = useState<Record<string, Task[]>>({});
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [editTasks, setEditTasks] = useState<Task[]>([]);
    const [spinWheel, setSpinWheel] = useState<SpinOption[]>([]);
    const [cardDeck, setCardDeck] = useState<CardOption[]>([]);
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string, Task[]> | null>(null);
    const [memberSelectedDay, setMemberSelectedDay] = useState<number>(1);
    const [memberEditTasks, setMemberEditTasks] = useState<Task[]>([]);
    const [configSection, setConfigSection] = useState<string>('spin_wheel');
    const [linesTexts, setLinesTexts] = useState<string[]>([]);
    const [bodyWriting, setBodyWriting] = useState<string[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<{ question: string; answer: string }[]>([]);
    const [exercises, setExercises] = useState<{ type: string; count: number }[]>([]);

    useEffect(() => {
        loadTemplate();
        loadConfig();
        if (initialMember) setTimeout(() => loadMemberProgram(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-select day 1 tasks when template loads
    useEffect(() => {
        if (templateDays['1']) setEditTasks([...templateDays['1']]);
    }, [templateDays]);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vault/program?template=true');
            const json = await res.json();
            const days: Record<string, Task[]> = {};
            if (json.template?.length) {
                for (const row of json.template) days[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
            }
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
                if (cfg.key === 'lines_texts') setLinesTexts(val);
                if (cfg.key === 'body_writing') setBodyWriting(val);
                if (cfg.key === 'quiz_questions') setQuizQuestions(val);
                if (cfg.key === 'exercises') setExercises(val);
            }
        } catch { }
    };

    const saveTemplate = async () => {
        setSaving(true);
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_template', days: templateDays }) });
        setTimeout(() => setSaving(false), 1200);
    };

    const saveConfig = async (key: string, value: any) => {
        setSaving(true);
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_config', key, value }) });
        setTimeout(() => setSaving(false), 1200);
    };

    const loadMemberProgram = async () => {
        if (!memberEmail) return;
        setLoading(true);
        const res = await fetch(`/api/vault/program?memberId=${encodeURIComponent(memberEmail)}`);
        const json = await res.json();
        if (json.program?.program) {
            const p = typeof json.program.program === 'string' ? JSON.parse(json.program.program) : json.program.program;
            setMemberProgram(p);
            if (p['1']) setMemberEditTasks([...p['1']]);
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
        setSaving(true);
        await fetch('/api/vault/program', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update_day', memberId: memberEmail, dayNumber: day, tasks }) });
        if (memberProgram) setMemberProgram({ ...memberProgram, [String(day)]: tasks });
        setTimeout(() => setSaving(false), 1200);
    };

    const getIcon = (type: string) => TASK_TYPES.find(t => t.type === type)?.icon || '\u2022';

    const jumpToConfig = (configKey: string) => {
        setTab('config');
        setConfigSection(configKey as any);
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '22px 32px', borderBottom: `1px solid ${BORDER}`, background: 'linear-gradient(180deg, rgba(15,12,8,0.6), rgba(7,7,12,0.8))' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontSize: '1.4rem', padding: '0 16px 0 0', lineHeight: 1 }}>&larr;</button>
                <span style={{ fontFamily: FC, fontSize: '1.1rem', color: GOLD, letterSpacing: 7, fontWeight: 700 }}>KEYHOLDER PROGRAM</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 0 }}>
                    {([['template','PROGRAM'],['config','WHEEL & CARDS'],['member','MEMBER']] as [TabType,string][]).map(([t,lbl]) => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '10px 28px', border: 'none', borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`,
                            background: 'transparent', color: tab === t ? GOLD : 'rgba(255,255,255,0.2)',
                            fontFamily: F, fontSize: '0.85rem', letterSpacing: 3, cursor: 'pointer',
                            transition: 'color 0.2s',
                        }}>{lbl}</button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

                {/* ═══════════════════ PROGRAM TAB ═══════════════════ */}
                {tab === 'template' && (<>
                    {/* LEFT SIDEBAR */}
                    <div style={{ width: 320, borderRight: `1px solid ${BORDER}`, overflow: 'auto', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ padding: '20px 24px' }}>
                            <button onClick={saveTemplate} disabled={saving} style={{
                                width: '100%', padding: '14px 0', border: `1px solid ${saving ? 'rgba(80,200,80,0.3)' : GOLD_DIM}`, borderRadius: 6,
                                background: saving ? 'rgba(80,200,80,0.05)' : 'rgba(197,160,89,0.03)',
                                color: saving ? 'rgba(80,200,80,0.8)' : GOLD, fontFamily: F, fontSize: '0.85rem', letterSpacing: 4, cursor: 'pointer',
                                transition: 'all 0.3s',
                            }}>{saving ? 'SAVED' : 'SAVE PROGRAM'}</button>
                        </div>

                        {PHASES.map((phase, pi) => (
                            <div key={phase.name}>
                                <div style={{ padding: '18px 24px 10px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                    <span style={{ fontFamily: FC, fontSize: '0.65rem', color: pi < 2 ? GOLD : RED, letterSpacing: 5 }}>{phase.name}</span>
                                    <span style={{ fontFamily: F, fontSize: '0.55rem', color: TEXT_DIM, letterSpacing: 1 }}>{phase.sub}</span>
                                </div>
                                <div style={{ height: 1, background: BORDER, margin: '0 20px 4px' }} />

                                {phase.days.map(day => {
                                    const tasks = templateDays[String(day)] || [];
                                    const isSel = selectedDay === day;
                                    return (
                                        <div key={day} onClick={() => { setSelectedDay(day); setEditTasks([...tasks]); }}
                                            style={{
                                                padding: '14px 24px', cursor: 'pointer',
                                                background: isSel ? 'rgba(197,160,89,0.04)' : 'transparent',
                                                borderLeft: isSel ? `3px solid ${GOLD}` : '3px solid transparent',
                                                transition: 'all 0.15s',
                                            }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontFamily: F, fontSize: '1.1rem', color: isSel ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: 1 }}>Day {day}</span>
                                                <span style={{ fontFamily: F, fontSize: '0.75rem', color: TEXT_DIM, marginLeft: 'auto', letterSpacing: 1 }}>{tasks.length}</span>
                                            </div>
                                            {/* Task preview icons */}
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                {tasks.map((t, i) => (
                                                    <span key={i} style={{ fontSize: '0.85rem', color: isSel ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.12)' }}>{getIcon(t.type)}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* RIGHT DETAIL */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '36px 48px' }}>
                        <DayDetail
                            day={selectedDay}
                            tasks={editTasks}
                            onChange={t => setEditTasks(t)}
                            onSave={() => setTemplateDays({ ...templateDays, [String(selectedDay)]: editTasks })}
                            onJumpConfig={jumpToConfig}
                            saving={saving}
                        />
                    </div>
                </>)}

                {/* ═══════════════════ CONFIG TAB ═══════════════════ */}
                {tab === 'config' && (<>
                    {/* LEFT: Section list */}
                    <div style={{ width: 280, borderRight: `1px solid ${BORDER}`, overflow: 'auto', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ padding: '20px 24px 12px' }}>
                            <span style={{ fontFamily: FC, fontSize: '0.6rem', color: TEXT_DIM, letterSpacing: 5 }}>CONFIGURE</span>
                        </div>
                        {CONFIG_SECTIONS.map(sec => (
                            <div key={sec.key} onClick={() => setConfigSection(sec.key)}
                                style={{
                                    padding: '16px 24px', cursor: 'pointer',
                                    background: configSection === sec.key ? 'rgba(197,160,89,0.04)' : 'transparent',
                                    borderLeft: configSection === sec.key ? `3px solid ${GOLD}` : '3px solid transparent',
                                    transition: 'all 0.15s',
                                }}>
                                <span style={{ fontFamily: F, fontSize: '0.9rem', color: configSection === sec.key ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1 }}>{sec.title}</span>
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: Config editor */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '36px 48px' }}>
                        {(() => {
                            const sec = CONFIG_SECTIONS.find(s => s.key === configSection);
                            if (!sec) return null;
                            return (
                                <div style={{ maxWidth: 900 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
                                        <div>
                                            <div style={{ fontFamily: FC, fontSize: '0.9rem', color: GOLD, letterSpacing: 6 }}>{sec.title}</div>
                                            <div style={{ fontFamily: F, fontSize: '0.85rem', color: TEXT_DIM, marginTop: 8 }}>{sec.description}</div>
                                        </div>
                                        <div style={{ flex: 1 }} />
                                        <button onClick={() => {
                                            if (configSection === 'spin_wheel') saveConfig('spin_wheel', spinWheel);
                                            if (configSection === 'card_deck') saveConfig('card_deck', cardDeck);
                                            if (configSection === 'lines_texts') saveConfig('lines_texts', linesTexts);
                                            if (configSection === 'body_writing') saveConfig('body_writing', bodyWriting);
                                            if (configSection === 'quiz_questions') saveConfig('quiz_questions', quizQuestions);
                                            if (configSection === 'exercises') saveConfig('exercises', exercises);
                                        }} style={{
                                            padding: '10px 28px', border: `1px solid ${saving ? 'rgba(80,200,80,0.3)' : GOLD_DIM}`, borderRadius: 6,
                                            background: 'transparent', color: saving ? 'rgba(80,200,80,0.8)' : GOLD,
                                            fontFamily: F, fontSize: '0.7rem', letterSpacing: 3, cursor: 'pointer',
                                        }}>{saving ? 'SAVED' : 'SAVE'}</button>
                                    </div>
                                    <div style={{ height: 1, background: `linear-gradient(90deg, ${GOLD_DIM}, transparent)`, marginBottom: 24 }} />

                                    {/* ── SPIN WHEEL ── */}
                                    {configSection === 'spin_wheel' && (<>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 70px 70px 36px', gap: 12, padding: '0 16px 8px' }}>
                                            {['LABEL','EFFECT','VALUE','WEIGHT',''].map((h,i) => (
                                                <span key={i} style={{ fontFamily: F, fontSize: '0.6rem', color: TEXT_DIM, letterSpacing: 2, textAlign: i > 1 && i < 4 ? 'center' : 'left' }}>{h}</span>
                                            ))}
                                        </div>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {spinWheel.map((opt, i) => (
                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 70px 70px 36px', gap: 12, alignItems: 'center', padding: '12px 16px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                                                    <input value={opt.label} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], label: e.target.value }; setSpinWheel(n); }} style={{ ...iS(), fontSize: '0.85rem' }} />
                                                    <input value={opt.effect} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], effect: e.target.value }; setSpinWheel(n); }} style={{ ...iS(), fontSize: '0.8rem', color: 'rgba(197,160,89,0.5)' }} />
                                                    <input value={opt.value} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], value: Number(e.target.value) }; setSpinWheel(n); }} style={{ ...iS(), textAlign: 'center', fontSize: '0.9rem', color: GOLD }} />
                                                    <input value={opt.weight} onChange={e => { const n = [...spinWheel]; n[i] = { ...n[i], weight: Number(e.target.value) }; setSpinWheel(n); }} style={{ ...iS(), textAlign: 'center', fontSize: '0.9rem' }} />
                                                    <XBtn onClick={() => { const n = [...spinWheel]; n.splice(i, 1); setSpinWheel(n); }} />
                                                </div>
                                            ))}
                                        </div>
                                        <AddBtn onClick={() => setSpinWheel([...spinWheel, { label: '', effect: 'add_days', value: 1, weight: 1 }])} label="+ ADD OPTION" />
                                    </>)}

                                    {/* ── CARD DECK ── */}
                                    {configSection === 'card_deck' && (<>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {cardDeck.map((card, i) => (
                                                <div key={i} style={{ padding: '16px 20px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <input value={card.title} onChange={e => { const n = [...cardDeck]; n[i] = { ...n[i], title: e.target.value }; setCardDeck(n); }} style={{ ...iS(), fontWeight: 700, fontSize: '0.9rem', color: '#fff', width: '100%', marginBottom: 8 }} placeholder="Card title" />
                                                            <input value={card.description} onChange={e => { const n = [...cardDeck]; n[i] = { ...n[i], description: e.target.value }; setCardDeck(n); }} style={{ ...iS(), fontSize: '0.8rem', width: '100%', color: TEXT }} placeholder="Description" />
                                                        </div>
                                                        <input value={card.category} onChange={e => { const n = [...cardDeck]; n[i] = { ...n[i], category: e.target.value }; setCardDeck(n); }} style={{ ...iS(), width: 90, fontSize: '0.7rem', textAlign: 'center', color: 'rgba(197,160,89,0.5)' }} placeholder="Category" />
                                                        <XBtn onClick={() => { const n = [...cardDeck]; n.splice(i, 1); setCardDeck(n); }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <AddBtn onClick={() => setCardDeck([...cardDeck, { title: '', description: '', category: '' }])} label="+ ADD CARD" />
                                    </>)}

                                    {/* ── LINES TEXTS ── */}
                                    {configSection === 'lines_texts' && (<>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {linesTexts.map((txt, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                                                    <span style={{ fontFamily: F, fontSize: '0.7rem', color: TEXT_DIM, width: 24, textAlign: 'center' }}>{i + 1}</span>
                                                    <input value={txt} onChange={e => { const n = [...linesTexts]; n[i] = e.target.value; setLinesTexts(n); }} style={{ ...iS(), flex: 1, fontSize: '0.9rem' }} placeholder="Text they must write..." />
                                                    <XBtn onClick={() => { const n = [...linesTexts]; n.splice(i, 1); setLinesTexts(n); }} />
                                                </div>
                                            ))}
                                        </div>
                                        <AddBtn onClick={() => setLinesTexts([...linesTexts, ''])} label="+ ADD LINE" />
                                    </>)}

                                    {/* ── BODY WRITING ── */}
                                    {configSection === 'body_writing' && (<>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {bodyWriting.map((txt, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                                                    <input value={txt} onChange={e => { const n = [...bodyWriting]; n[i] = e.target.value; setBodyWriting(n); }} style={{ ...iS(), flex: 1, fontSize: '1rem', fontWeight: 700, letterSpacing: 3, color: '#fff' }} placeholder="Word to write..." />
                                                    <XBtn onClick={() => { const n = [...bodyWriting]; n.splice(i, 1); setBodyWriting(n); }} />
                                                </div>
                                            ))}
                                        </div>
                                        <AddBtn onClick={() => setBodyWriting([...bodyWriting, ''])} label="+ ADD WORD" />
                                    </>)}

                                    {/* ── QUIZ QUESTIONS ── */}
                                    {configSection === 'quiz_questions' && (<>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {quizQuestions.map((q, i) => (
                                                <div key={i} style={{ padding: '16px 20px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                        <span style={{ fontFamily: F, fontSize: '0.8rem', color: GOLD, marginTop: 4, flexShrink: 0 }}>Q{i + 1}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <input value={q.question} onChange={e => { const n = [...quizQuestions]; n[i] = { ...n[i], question: e.target.value }; setQuizQuestions(n); }} style={{ ...iS(), fontSize: '0.9rem', color: '#fff', width: '100%', marginBottom: 10 }} placeholder="Question..." />
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span style={{ fontFamily: F, fontSize: '0.6rem', color: TEXT_DIM, letterSpacing: 2 }}>ANSWER</span>
                                                                <input value={q.answer} onChange={e => { const n = [...quizQuestions]; n[i] = { ...n[i], answer: e.target.value }; setQuizQuestions(n); }} style={{ ...iS(), fontSize: '0.8rem', color: 'rgba(80,200,80,0.7)', flex: 1 }} placeholder="Correct answer..." />
                                                            </div>
                                                        </div>
                                                        <XBtn onClick={() => { const n = [...quizQuestions]; n.splice(i, 1); setQuizQuestions(n); }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <AddBtn onClick={() => setQuizQuestions([...quizQuestions, { question: '', answer: '' }])} label="+ ADD QUESTION" />
                                    </>)}

                                    {/* ── EXERCISES ── */}
                                    {configSection === 'exercises' && (<>
                                        <div style={{ display: 'grid', gap: 6 }}>
                                            {exercises.map((ex, i) => (
                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 36px', gap: 12, alignItems: 'center', padding: '12px 16px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                                                    <input value={ex.type} onChange={e => { const n = [...exercises]; n[i] = { ...n[i], type: e.target.value }; setExercises(n); }} style={{ ...iS(), fontSize: '0.9rem' }} placeholder="Exercise type..." />
                                                    <input value={ex.count} onChange={e => { const n = [...exercises]; n[i] = { ...n[i], count: Number(e.target.value) }; setExercises(n); }} style={{ ...iS(), textAlign: 'center', fontSize: '0.9rem', color: GOLD }} placeholder="Count" />
                                                    <XBtn onClick={() => { const n = [...exercises]; n.splice(i, 1); setExercises(n); }} />
                                                </div>
                                            ))}
                                        </div>
                                        <AddBtn onClick={() => setExercises([...exercises, { type: '', count: 10 }])} label="+ ADD EXERCISE" />
                                    </>)}
                                </div>
                            );
                        })()}
                    </div>
                </>)}

                {/* ═══════════════════ MEMBER TAB ═══════════════════ */}
                {tab === 'member' && (<>
                    {/* Search + left panel */}
                    <div style={{ width: 320, borderRight: `1px solid ${BORDER}`, overflow: 'auto', flexShrink: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
                            <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Member email..."
                                style={{ ...iS(), width: '100%', padding: '10px 14px', fontSize: '0.8rem', marginBottom: 8, boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={loadMemberProgram} style={{
                                    flex: 1, padding: '10px 0', border: `1px solid ${GOLD_DIM}`, borderRadius: 6,
                                    background: 'transparent', color: GOLD, fontFamily: F, fontSize: '0.65rem', letterSpacing: 3, cursor: 'pointer',
                                }}>LOAD</button>
                                <button onClick={generateMemberProgram} style={{
                                    flex: 1, padding: '10px 0', border: `1px solid rgba(139,0,0,0.25)`, borderRadius: 6,
                                    background: 'transparent', color: RED, fontFamily: F, fontSize: '0.65rem', letterSpacing: 3, cursor: 'pointer',
                                }}>GENERATE</button>
                            </div>
                        </div>

                        {memberProgram ? (
                            <div style={{ flex: 1, overflow: 'auto' }}>
                                {PHASES.map((phase, pi) => (
                                    <div key={phase.name}>
                                        <div style={{ padding: '18px 24px 10px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                                            <span style={{ fontFamily: FC, fontSize: '0.65rem', color: pi < 2 ? GOLD : RED, letterSpacing: 5 }}>{phase.name}</span>
                                        </div>
                                        <div style={{ height: 1, background: BORDER, margin: '0 20px 4px' }} />
                                        {phase.days.map(day => {
                                            const tasks = memberProgram[String(day)] || [];
                                            const isSel = memberSelectedDay === day;
                                            return (
                                                <div key={day} onClick={() => { setMemberSelectedDay(day); setMemberEditTasks([...tasks]); }}
                                                    style={{
                                                        padding: '14px 24px', cursor: 'pointer',
                                                        background: isSel ? 'rgba(197,160,89,0.04)' : 'transparent',
                                                        borderLeft: isSel ? `3px solid ${GOLD}` : '3px solid transparent',
                                                    }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <span style={{ fontFamily: F, fontSize: '0.95rem', color: isSel ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: 700 }}>Day {day}</span>
                                                        <span style={{ fontFamily: F, fontSize: '0.65rem', color: TEXT_DIM, marginLeft: 'auto' }}>{tasks.length}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                        {tasks.map((t, i) => (
                                                            <span key={i} style={{ fontSize: '0.85rem', color: isSel ? 'rgba(197,160,89,0.4)' : 'rgba(255,255,255,0.12)' }}>{getIcon(t.type)}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_DIM, fontFamily: F, fontSize: '0.75rem', letterSpacing: 1, padding: 20, textAlign: 'center' }}>
                                {loading ? 'Loading...' : 'Enter email and load program'}
                            </div>
                        )}
                    </div>

                    {/* RIGHT DETAIL */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '36px 48px' }}>
                        {memberProgram ? (
                            <DayDetail
                                day={memberSelectedDay}
                                tasks={memberEditTasks}
                                onChange={t => setMemberEditTasks(t)}
                                onSave={() => saveMemberDay(memberSelectedDay, memberEditTasks)}
                                onJumpConfig={jumpToConfig}
                                isMember
                                saving={saving}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: TEXT_DIM, fontFamily: F, fontSize: '0.85rem', letterSpacing: 2 }}>
                                Load a member to edit their program
                            </div>
                        )}
                    </div>
                </>)}
            </div>

            <style>{`
                input[type=number]::-webkit-inner-spin-button,
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
}

// ── Shared input style ──
function iS(): React.CSSProperties {
    return {
        background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`,
        padding: '4px 0', color: 'rgba(255,255,255,0.6)', fontFamily: F, fontSize: '0.8rem', outline: 'none',
    };
}

// ── Day Detail Panel ──
function DayDetail({ day, tasks, onChange, onSave, onJumpConfig, isMember, saving }: {
    day: number; tasks: Task[]; onChange: (t: Task[]) => void; onSave: () => void;
    onJumpConfig?: (key: string) => void; isMember?: boolean; saving?: boolean;
}) {
    const phase = PHASES.find(p => p.days.includes(day))!;
    const phaseIdx = PHASES.indexOf(phase);
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
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div>
            {/* ── DAY HEADER ── */}
            <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 8 }}>
                    <span style={{ fontFamily: F, fontSize: '2.8rem', color: '#fff', fontWeight: 800, letterSpacing: 3, lineHeight: 1 }}>Day {day}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontFamily: FC, fontSize: '0.7rem', color: phaseIdx < 2 ? GOLD : RED, letterSpacing: 6 }}>{phase.name}</span>
                        <span style={{ fontFamily: F, fontSize: '0.75rem', color: TEXT_DIM }}>{phase.sub} phase</span>
                    </div>
                    <div style={{ flex: 1 }} />
                    <button onClick={handleSave} style={{
                        padding: '12px 32px', border: `1px solid ${saved ? 'rgba(80,200,80,0.3)' : GOLD_DIM}`, borderRadius: 6,
                        background: saved ? 'rgba(80,200,80,0.04)' : 'transparent',
                        color: saved ? 'rgba(80,200,80,0.8)' : GOLD, fontFamily: F, fontSize: '0.8rem', letterSpacing: 4, cursor: 'pointer',
                        transition: 'all 0.3s',
                    }}>{saved ? 'SAVED' : saving ? 'SAVING...' : isMember ? 'SAVE FOR USER' : 'UPDATE'}</button>
                </div>
                <div style={{ height: 1, background: `linear-gradient(90deg, ${phaseIdx < 2 ? GOLD_DIM : 'rgba(139,0,0,0.2)'}, transparent)`, marginTop: 14 }} />
            </div>

            {/* ── TASK LIST ── */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 44 }}>
                {tasks.length === 0 && (
                    <div style={{ padding: '32px 0', textAlign: 'center', color: TEXT_DIM, fontFamily: F, fontSize: '0.9rem' }}>No tasks assigned. Add tasks below.</div>
                )}
                {tasks.map((t, i) => {
                    const tt = TASK_TYPES.find(x => x.type === t.type);
                    const hasConfig = tt?.configKey;
                    return (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 20,
                            padding: '18px 24px', background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                            transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = BORDER_HOVER}
                        onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
                        >
                            {/* Icon */}
                            <span style={{ fontSize: '1.4rem', color: 'rgba(197,160,89,0.3)', width: 32, textAlign: 'center', flexShrink: 0 }}>{tt?.icon || '\u2022'}</span>

                            {/* Label */}
                            <input value={t.label} onChange={e => updateTask(i, 'label', e.target.value)}
                                style={{ flex: 1, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', fontFamily: F, fontSize: '1.05rem', outline: 'none', padding: 0, letterSpacing: 0.5 }} />

                            {/* Config link */}
                            {hasConfig && onJumpConfig && (
                                <button onClick={() => onJumpConfig(tt!.configKey!)}
                                    style={{ background: 'none', border: `1px solid ${GOLD_DIM}`, borderRadius: 5, padding: '5px 14px',
                                        color: 'rgba(197,160,89,0.5)', fontFamily: F, fontSize: '0.65rem', cursor: 'pointer', letterSpacing: 2, flexShrink: 0,
                                        transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = GOLD_DIM; e.currentTarget.style.color = 'rgba(197,160,89,0.5)'; }}
                                >EDIT OPTIONS</button>
                            )}

                            {/* Target */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                <span style={{ fontFamily: F, fontSize: '0.7rem', color: TEXT_DIM, letterSpacing: 1 }}>x</span>
                                <input type="number" value={t.target} onChange={e => updateTask(i, 'target', Number(e.target.value))}
                                    style={{ width: 52, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 5,
                                        padding: '8px 0', color: GOLD, fontFamily: F, fontSize: '1.1rem', textAlign: 'center', outline: 'none',
                                        MozAppearance: 'textfield' as any, WebkitAppearance: 'none' }} />
                            </div>

                            {/* Delete */}
                            <button onClick={() => removeTask(i)}
                                style={{ background: 'none', border: 'none', color: 'rgba(139,0,0,0.2)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', flexShrink: 0,
                                    transition: 'color 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'rgba(200,40,40,0.8)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(139,0,0,0.2)'}
                            >&times;</button>
                        </div>
                    );
                })}
            </div>

            {/* ── ADD TASK ── */}
            <div>
                <div style={{ fontFamily: FC, fontSize: '0.6rem', color: TEXT_DIM, letterSpacing: 5, marginBottom: 18 }}>ADD TASK</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {TASK_TYPES.map(tt => (
                        <button key={tt.type} onClick={() => addTask(tt.type)} style={{
                            padding: '10px 18px', borderRadius: 8, border: `1px solid ${BORDER}`,
                            background: 'transparent', color: 'rgba(255,255,255,0.25)', fontFamily: F, fontSize: '0.8rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.15s', letterSpacing: 0.5,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER_HOVER; e.currentTarget.style.color = 'rgba(197,160,89,0.65)'; e.currentTarget.style.background = 'rgba(197,160,89,0.03)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <span style={{ fontSize: '1rem', opacity: 0.5 }}>{tt.icon}</span>
                            {tt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Shared buttons ──
function XBtn({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick}
            style={{ background: 'none', border: 'none', color: 'rgba(139,0,0,0.3)', cursor: 'pointer', fontSize: '1rem', padding: '0 2px', transition: 'color 0.15s', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(200,40,40,0.8)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(139,0,0,0.3)'}
        >&times;</button>
    );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
    return (
        <button onClick={onClick}
            style={{ marginTop: 12, padding: '10px 20px', border: `1px dashed ${BORDER}`, borderRadius: 8, background: 'transparent',
                color: TEXT_DIM, fontFamily: F, fontSize: '0.7rem', cursor: 'pointer', letterSpacing: 2, width: '100%', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER_HOVER; e.currentTarget.style.color = GOLD; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
        >{label}</button>
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
