'use client';

import { useState, useEffect, useRef } from 'react';
import { kneelTarget, defaultDayTasks, generateDefaultProgram } from '@/lib/vault-program-defaults';
import { MECH_LIST, MECH_PRESETS } from '@/lib/mechanisms';

const F = "'Rajdhani', sans-serif";
const FC = "'Cinzel', serif";
const GOLD = '#c5a059';
const GOLD_DIM = 'rgba(197,160,89,0.4)';
const RED = 'rgba(180,40,40,0.9)';
const RED_DIM = 'rgba(139,0,0,0.25)';
const BG = '#0a0a10';
const SURFACE = 'rgba(255,255,255,0.07)';
const BORDER = 'rgba(197,160,89,0.2)';
const TEXT = 'rgba(255,255,255,0.92)';
const TEXT_DIM = 'rgba(255,255,255,0.55)';

/* ── TASK TYPES — 4 color tiers ── */
/* GOLD #c5a059  = devotion / tribute / worship */
/* SILVER #8a8a9a = discipline / routine / effort */
/* RED #8b0000   = punishment / intensity / sacrifice */
/* BLACK #555    = chance / random / unknown */
const C_GOLD = '#c5a059';
const C_SILVER = '#8a8a9a';
const C_RED = '#8b0000';
const C_BLACK = '#555555';

const TASK_META: Record<string, { label: string; icon: string; color: string; configKey?: string }> = {
    kneel:          { label: 'KNEEL',        icon: '\u25C7', color: C_GOLD },
    chastity_check: { label: 'CHASTITY',     icon: '\u25C8', color: C_RED },
    tribute:        { label: 'TRIBUTE',      icon: '\u25C6', color: C_GOLD },
    worship:        { label: 'WORSHIP',      icon: '\u2661', color: C_GOLD },
    gratitude:      { label: 'GRATITUDE',    icon: '\u2605', color: C_GOLD },
    journal:        { label: 'JOURNAL',      icon: '\u270E', color: C_GOLD },
    lines:          { label: 'WRITE LINES',  icon: '\u2261', color: C_SILVER, configKey: 'lines_texts' },
    exercise:       { label: 'EXERCISE',     icon: '\u2191', color: C_SILVER, configKey: 'exercises' },
    corner_time:    { label: 'CORNER TIME',  icon: '\u25A2', color: C_SILVER },
    body_writing:   { label: 'BODY WRITING', icon: '\u270D', color: C_SILVER, configKey: 'body_writing' },
    essay:          { label: 'ESSAY',        icon: '\u2016', color: C_SILVER },
    edge:           { label: 'EDGE',         icon: '\u2736', color: C_RED },
    denial:         { label: 'DENIAL',       icon: '\u2718', color: C_RED },
    cold_shower:    { label: 'COLD SHOWER',  icon: '\u2744', color: C_RED },
    confession:     { label: 'CONFESSION',   icon: '\u2767', color: C_RED },
    trial:          { label: 'TRIAL',        icon: '\u2694', color: C_RED },
    spin:           { label: 'SPIN WHEEL',   icon: '\u25CE', color: C_BLACK, configKey: 'spin_wheel' },
    card:           { label: 'TASK CARD',    icon: '\u2660', color: C_BLACK, configKey: 'card_deck' },
    quiz:           { label: 'QUIZ',         icon: '\u2753', color: C_BLACK, configKey: 'quiz_questions' },
};


const PHASES = [
    { name: 'OBEDIENCE', sub: 'Foundation', days: [1,2,3,4,5,6,7], color: GOLD },
    { name: 'DISCIPLINE', sub: 'Building', days: [8,9,10,11,12,13,14], color: '#8b0000' },
    { name: 'ENDURANCE', sub: 'Testing', days: [15,16,17,18,19,20,21], color: '#9b59b6' },
    { name: 'DEVOTION', sub: 'Proving', days: [22,23,24,25,26,27,28,29,30], color: GOLD },
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
// _kt and _ddt now imported from @/lib/vault-program-defaults
const _kt = kneelTarget;
function _ddt(d: number): Task[] {
    return defaultDayTasks(d) as Task[];
}

/* ═══════════════ GLOBAL STYLES ═══════════════ */
const CSS = `
input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
.kscr::-webkit-scrollbar{width:3px}.kscr::-webkit-scrollbar-track{background:transparent}.kscr::-webkit-scrollbar-thumb{background:rgba(197,160,89,.2);border-radius:4px}
.kdc{transition:all .3s ease;cursor:pointer}
.kdc:hover{transform:translateY(-4px);box-shadow:0 8px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(197,160,89,.15)}
.ktc{transition:all .25s ease;cursor:grab}
.ktc:hover{box-shadow:0 4px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(197,160,89,.12)}
.ktc:active{cursor:grabbing;transform:scale(1.01)}
.kmc{transition:all .3s ease;cursor:pointer}
.kmc:hover{transform:translateY(-4px);box-shadow:0 10px 40px rgba(0,0,0,.5)}
.kdrag{border-color:${GOLD}!important}
.kbtn{transition:all .2s ease;cursor:pointer}.kbtn:hover{box-shadow:0 2px 12px rgba(0,0,0,.3)}
@keyframes kFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes kSlide{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.kfade{animation:kFade .35s ease forwards}
.kslide{animation:kSlide .3s ease forwards}
.kdc:hover .kdc-icon{filter:drop-shadow(0 0 6px currentColor)}
`;

/* ═══════════════ MAIN ═══════════════ */
export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [view, setView] = useState<ViewMode>(initialMember ? 'member' : 'program');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [templateDays, setTemplateDays] = useState<Record<string,Task[]>>(generateDefaultProgram() as Record<string,Task[]>);
    const [selectedDay, setSelectedDay] = useState<number|null>(null);
    const [lockedMembers, setLockedMembers] = useState<any[]>([]);
    const [configSection, setConfigSection] = useState('spin_wheel');
    const [configData, setConfigData] = useState<Record<string,any>>({});
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string,Task[]>|null>(null);
    const [memberSelectedDay, setMemberSelectedDay] = useState<number|null>(null);
    const [memberInfo, setMemberInfo] = useState<any>(null);
    const [memberAbout, setMemberAbout] = useState<string>('');
    const [showMemberProfile, setShowMemberProfile] = useState(true);
    const [dragIdx, setDragIdx] = useState<number|null>(null);

    useEffect(() => { loadTemplate(); loadConfig(); loadLockedMembers(); if(initialMember) setTimeout(()=>loadMemberProgram(),150); }, []);

    const loadLockedMembers = async () => { try { const r = await fetch('/api/vault/program?listLocked=true'); const j = await r.json(); if(j.locked) setLockedMembers(j.locked); } catch{} };
    const loadTemplate = async () => { try { const r = await fetch('/api/vault/program?template=true'); const j = await r.json(); if(j.template?.length>0){ const d: Record<string,Task[]>={}; for(const row of j.template){ const tasks: Task[] = typeof row.tasks==='string'?JSON.parse(row.tasks):row.tasks; const dn = row.day_number; if(!tasks.some((t:Task)=>t.type==='kneel')){const kt=_kt(dn);tasks.unshift({type:'kneel',target:kt,label:`Kneel ${kt} times`} as Task);} if(!tasks.some((t:Task)=>t.type==='chastity_check')){const ki=tasks.findIndex((t:Task)=>t.type==='kneel');tasks.splice(ki+1,0,{type:'chastity_check',target:1,label:'Chastity check-in'} as Task);} d[String(dn)]=tasks; } setTemplateDays(d); } else { /* DB has no template — auto-save the defaults so member program generation uses the same data */ const defaults = generateDefaultProgram() as Record<string,Task[]>; try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_template',days:defaults})}); console.log('[KeyholderProgram] Auto-saved default template to DB'); } catch{} } } catch{} };
    const loadConfig = async () => { try { const r = await fetch('/api/vault/program?config=true'); const j = await r.json(); if(j.config){ const m: Record<string,any>={}; for(const row of j.config){ m[row.key]=typeof row.value==='string'?JSON.parse(row.value):row.value; } setConfigData(m); } } catch{} };
    const loadMemberProgram = async (emailOverride?: string) => { const email = emailOverride || memberEmail; if(!email) return; setLoading(true); setMemberAbout(''); try { const r = await fetch(`/api/vault/program?memberId=${encodeURIComponent(email)}`); const j = await r.json(); if(j.program?.program){const mp=typeof j.program.program==='string'?JSON.parse(j.program.program):j.program.program;for(const[ds,tasks]of Object.entries(mp)){if(!Array.isArray(tasks))continue;const dn=parseInt(ds,10);if(!(tasks as Task[]).some((t:Task)=>t.type==='kneel')){const kt=_kt(dn);(tasks as Task[]).unshift({type:'kneel',target:kt,label:`Kneel ${kt} times`} as Task);}if(!(tasks as Task[]).some((t:Task)=>t.type==='chastity_check')){const ki=(tasks as Task[]).findIndex((t:Task)=>t.type==='kneel');(tasks as Task[]).splice(ki+1,0,{type:'chastity_check',target:1,label:'Chastity check-in'} as Task);}}setMemberProgram(mp);}else{setMemberProgram(null);} const base = lockedMembers.find((m:any)=>m.memberId.toLowerCase()===email.toLowerCase())||{}; if(j.profile) { base.kinks = j.profile.kinks || ''; base.limits = j.profile.limits || ''; } setMemberInfo(base); } catch{} try { const cr = await fetch(`/api/chat/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: email }) }); const cj = await cr.json(); if(cj.messages) { const firstUserMsg = cj.messages.find((m: any) => m.sender_email === email && m.content && !m.content.startsWith('http') && !m.content.startsWith('[SYSTEM') && !m.content.startsWith('[system') && m.type !== 'system' && m.type !== 'wishlist' && m.content.length > 20); if(firstUserMsg) setMemberAbout(firstUserMsg.content); } } catch{} setLoading(false); };
    const generateMemberProgram = async () => { if(!memberEmail) return; setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate_program',memberId:memberEmail})}); await loadMemberProgram(); } catch{} setSaving(false); };
    const saveTemplate = async () => { setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_template',days:templateDays})}); } catch{} setSaving(false); };
    const saveConfig = async (key: string, value: any) => { setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_config',key,value})}); } catch{} setSaving(false); };
    const saveMemberDay = async (dayNum: number, tasks: Task[]) => { if(!memberEmail) return; setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_day',memberId:memberEmail,dayNumber:dayNum,tasks})}); } catch{} setSaving(false); };

    const getDays = () => view==='member'&&memberProgram?memberProgram:templateDays;
    const setDays = (d: Record<string,Task[]>) => { if(view==='member') setMemberProgram(d); else setTemplateDays(d); };
    const getSel = () => view==='member'?memberSelectedDay:selectedDay;
    const setSel = (d: number|null) => { if(view==='member') setMemberSelectedDay(d); else setSelectedDay(d); };

    // Auto-save member program when edited (debounced)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
    const memberProgramRef = useRef(memberProgram);
    memberProgramRef.current = memberProgram;
    const memberEmailRef = useRef(memberEmail);
    memberEmailRef.current = memberEmail;

    const autoSaveMemberDay = (dn: number, tasks: Task[]) => {
        if(view!=='member' || !memberEmailRef.current) return;
        if(saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_day',memberId:memberEmailRef.current,dayNumber:dn,tasks})}); } catch{}
        }, 600);
    };

    const updateTask = (dn: number,idx: number,field: string,val: any) => { const d={...getDays()}; const t=[...(d[String(dn)]||[])]; t[idx]={...t[idx],[field]:val}; d[String(dn)]=t; setDays(d); autoSaveMemberDay(dn,t); };
    const addTask = (dn: number,type: string, label?: string, target?: number, config?: any) => { const meta=TASK_META[type]; const mechInfo=MECH_LIST.find(m=>m.id===type); const d={...getDays()}; const t=[...(d[String(dn)]||[])]; const task: any = {type, target: target||1, label: label||meta?.label||mechInfo?.name||type}; if(config) task.config = config; t.push(task); d[String(dn)]=t; setDays(d); autoSaveMemberDay(dn,t); };
    const removeTask = (dn: number,idx: number) => { const d={...getDays()}; const t=[...(d[String(dn)]||[])]; t.splice(idx,1); d[String(dn)]=t; setDays(d); autoSaveMemberDay(dn,t); };
    const moveTask = (dn: number,from: number,to: number) => { if(from===to) return; const d={...getDays()}; const t=[...(d[String(dn)]||[])]; const[m]=t.splice(from,1); t.splice(to,0,m); d[String(dn)]=t; setDays(d); autoSaveMemberDay(dn,t); };

    const sel = getSel();

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: F, position: 'relative' }}>
            {/* Full background image — same as /keyholder page */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ position: 'absolute', top: -50, left: -50, right: -50, bottom: -50, background: "url('/queen-bg-mobile.jpg') center 20%/cover no-repeat", opacity: 0.3, filter: 'saturate(0.3)' }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,16,0.5) 0%, rgba(10,10,16,0.85) 50%, rgba(10,10,16,0.95) 100%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.1) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
            <style>{CSS}</style>

            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 28px', borderBottom: `1px solid rgba(197,160,89,.18)`, gap: 16, flexShrink: 0, position: 'relative', zIndex: 1, background: 'rgba(10,10,16,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: GOLD, fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>{'\u2190'}</button>
                <h1 style={{ fontFamily: FC, fontSize: '.8rem', color: GOLD, letterSpacing: 8, margin: 0, flex: 1, textTransform: 'uppercase' }}>Keyholder Program</h1>
                <div style={{ display: 'flex', gap: 0, background: 'rgba(197,160,89,.08)', borderRadius: 6, border: `1px solid rgba(197,160,89,.2)` }}>
                    {(['program','config','member'] as ViewMode[]).map(v => (
                        <button key={v} onClick={() => setView(v)} style={{
                            padding: '9px 22px', border: 'none', borderRadius: 5, cursor: 'pointer', fontFamily: FC,
                            fontSize: '.5rem', letterSpacing: 3, transition: 'all .25s',
                            background: view===v ? 'rgba(197,160,89,.18)' : 'transparent',
                            color: view===v ? GOLD : TEXT_DIM,
                        }}>{v.toUpperCase()}</button>
                    ))}
                </div>
            </div>

            {/* LOCKED MEMBERS STRIP */}
            {lockedMembers.length > 0 && (
                <div style={{ display: 'flex', gap: 16, padding: '16px 28px', overflowX: 'auto', borderBottom: `1px solid rgba(197,160,89,.18)`, flexShrink: 0, position: 'relative', zIndex: 1, background: 'rgba(10,10,16,0.6)' }} className="kscr">
                    {lockedMembers.map((m: any) => (
                        <div key={m.memberId} className="kmc"
                            onClick={() => { setMemberEmail(m.memberId); setView('member'); setTimeout(()=>loadMemberProgram(m.memberId),80); }}
                            style={{
                                minWidth: 260, height: 100, borderRadius: 14, overflow: 'hidden', position: 'relative',
                                border: `1px solid ${memberEmail===m.memberId ? 'rgba(197,160,89,.35)' : 'rgba(197,160,89,.15)'}`,
                            }}>
                            {/* Photo as full background — matching sub list card pattern */}
                            {m.avatar ? (
                                <img src={m.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, filter: 'blur(0px)', pointerEvents: 'none' }} />
                            ) : (
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(139,0,0,.2), rgba(20,16,28,.9))' }} />
                            )}
                            {/* Content overlay */}
                            <div style={{ position: 'relative', zIndex: 1, padding: '14px 18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontFamily: FC, fontSize: '.7rem', color: 'rgba(255,255,255,.95)', letterSpacing: 3 }}>{m.name}</div>
                                    <div style={{ fontFamily: F, fontSize: '.55rem', color: m.status === 'awaiting_video' ? 'rgba(255,165,0,.8)' : GOLD, fontWeight: 700, letterSpacing: 2, background: 'rgba(0,0,0,.5)', padding: '3px 10px', borderRadius: 4, border: `1px solid ${m.status === 'awaiting_video' ? 'rgba(255,165,0,.25)' : 'rgba(197,160,89,.25)'}` }}>
                                        {m.status === 'awaiting_video' ? 'AWAITING VIDEO' : `DAY ${m.daysIn}`}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, height: 3, background: 'rgba(197,160,89,.15)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${m.lockDays?(m.daysIn/m.lockDays)*100:0}%`, height: '100%', background: `linear-gradient(90deg, ${GOLD}, rgba(139,0,0,.7))`, borderRadius: 2 }} />
                                        </div>
                                        <span style={{ fontFamily: F, fontSize: '.48rem', color: TEXT_DIM }}>{m.daysIn}/{m.lockDays}d</span>
                                    </div>
                                    <div style={{ fontFamily: F, fontSize: '.48rem', color: m.todayPerfect ? GOLD : TEXT_DIM, marginTop: 5, letterSpacing: 1 }}>
                                        {m.todayPerfect ? '\u2726 PERFECT' : `${m.todayDone}/${m.todayTotal} today`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MAIN */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative', zIndex: 1 }}>
                {view==='program' && <ProgramView days={templateDays} sel={selectedDay} setSel={setSelectedDay} updateTask={updateTask} addTask={addTask} removeTask={removeTask} moveTask={moveTask} saveTemplate={saveTemplate} saving={saving} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
                {view==='config' && <ConfigView configData={configData} setConfigData={setConfigData} configSection={configSection} setConfigSection={setConfigSection} onSave={saveConfig} saving={saving} />}
                {view==='member' && <MemberView email={memberEmail} setEmail={setMemberEmail} program={memberProgram} sel={memberSelectedDay} setSel={setMemberSelectedDay} info={memberInfo} locked={lockedMembers} onLoad={loadMemberProgram} onGenerate={generateMemberProgram} updateTask={updateTask} addTask={addTask} removeTask={removeTask} moveTask={moveTask} saveMemberDay={saveMemberDay} saving={saving} loading={loading} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} memberAbout={memberAbout} showMemberProfile={showMemberProfile} setShowMemberProfile={setShowMemberProfile} />}
            </div>
        </div>
    );
}

/* ═══════════════ PROGRAM VIEW ═══════════════ */
function ProgramView({ days, sel, setSel, updateTask, addTask, removeTask, moveTask, saveTemplate, saving, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: sel ? '32%' : '100%', transition: 'width .4s ease', overflowY: 'auto', padding: '20px 28px', background: 'rgba(10,10,16,0.5)' }} className="kscr">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <div style={{ fontFamily: FC, fontSize: '.55rem', color: 'rgba(255,255,255,.6)', letterSpacing: 5 }}>MASTER TEMPLATE</div>
                        <div style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM, marginTop: 4, letterSpacing: 1 }}>Chastity check auto-included. Click day to edit tasks.</div>
                    </div>
                    <button onClick={saveTemplate} className="kbtn" style={{ padding: '10px 30px', borderRadius: 6, border: `1px solid rgba(197,160,89,.3)`, background: 'rgba(197,160,89,.1)', color: GOLD, fontFamily: FC, fontSize: '.45rem', letterSpacing: 4 }}>{saving ? 'SAVING...' : 'SAVE'}</button>
                </div>
                {PHASES.map(phase => (
                    <div key={phase.name} style={{ marginBottom: 28 }} className="kfade">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <div style={{ width: 3, height: 24, borderRadius: 2, background: phase.color, opacity: .8 }} />
                            <span style={{ fontFamily: FC, fontSize: '.5rem', color: phase.color, letterSpacing: 6 }}>{phase.name}</span>
                            <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 2 }}>{phase.sub}</span>
                            <div style={{ flex: 1, height: 1, background: 'rgba(197,160,89,.12)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: sel ? 'repeat(auto-fill,minmax(90px,1fr))' : 'repeat(auto-fill,minmax(160px,1fr))', gap: sel ? 8 : 12 }}>
                            {phase.days.map(d => {
                                const tasks = days[String(d)] || [];
                                const isA = sel===d;
                                return (
                                    <div key={d} className="kdc" onClick={() => setSel(isA?null:d)} style={{
                                        borderRadius: 10, padding: sel ? '10px 10px 8px' : '16px 18px 12px',
                                        border: `1px solid ${isA ? 'rgba(197,160,89,.35)' : 'rgba(197,160,89,.15)'}`,
                                        background: isA ? 'linear-gradient(145deg, rgba(197,160,89,.1), rgba(15,13,20,.95))' : 'linear-gradient(145deg, rgba(22,20,30,.95), rgba(12,10,18,.98))',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: sel ? 4 : 8 }}>
                                            <span style={{ fontFamily: FC, fontSize: sel ? '.75rem' : '1.1rem', color: isA ? GOLD : 'rgba(255,255,255,.6)', lineHeight: 1 }}>{d}</span>
                                            <span style={{ fontFamily: F, fontSize: '.4rem', color: isA ? GOLD : TEXT_DIM, fontWeight: 600 }}>{tasks.length + 1}</span>
                                        </div>
                                        {!sel && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                <span style={{ fontSize: '.6rem', color: 'rgba(139,0,0,.7)' }}>{'\u25C8'}</span>
                                                {tasks.slice(0, 5).map((t: Task, i: number) => (
                                                    <span key={i} style={{ fontSize: '.55rem', color: TASK_META[t.type]?.color || '#666', opacity: .7 }}>{TASK_META[t.type]?.icon || '\u2022'}</span>
                                                ))}
                                                {tasks.length > 5 && <span style={{ fontSize: '.35rem', color: TEXT_DIM, alignSelf: 'center' }}>+{tasks.length-5}</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {sel && <TaskPanel dayNum={sel} tasks={days[String(sel)]||[]} onClose={() => setSel(null)} updateTask={(i:number,f:string,v:any) => updateTask(sel,i,f,v)} addTask={(t:string,l?:string,tgt?:number,cfg?:any) => addTask(sel,t,l,tgt,cfg)} removeTask={(i:number) => removeTask(sel,i)} moveTask={(a:number,b:number) => moveTask(sel,a,b)} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
        </div>
    );
}

/* ═══════════════ TASK PANEL — glass cards ═══════════════ */
function TaskPanel({ dayNum, tasks, onClose, updateTask, addTask, removeTask, moveTask, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    const phase = PHASES.find(p => p.days.includes(dayNum));
    const [addOpen, setAddOpen] = useState(false);
    const [editIdx, setEditIdx] = useState<number|null>(null);
    // Mechanism-first add flow
    const [addMech, setAddMech] = useState<string|null>(null);
    const [addConfig, setAddConfig] = useState<any>({});

    return (
        <div className="kslide" style={{ width: '68%', borderLeft: `1px solid rgba(197,160,89,.18)`, display: 'flex', flexDirection: 'column', background: 'rgba(10,10,16,0.92)', overflow: 'hidden', position: 'relative' }}>
            {/* Background image */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/queen-bg-mobile.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 20%', opacity: 0.1, filter: 'saturate(0.3)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,16,0.7) 0%, rgba(10,10,16,0.3) 40%, rgba(10,10,16,0.8) 100%)', pointerEvents: 'none', zIndex: 0 }} />
            {/* Header */}
            <div style={{ padding: '24px 36px 20px', borderBottom: `1px solid rgba(197,160,89,.18)`, display: 'flex', alignItems: 'flex-end', gap: 16, position: 'relative', zIndex: 1 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                        <span style={{ fontFamily: FC, fontSize: '2rem', color: '#fff', lineHeight: 1 }}>Day {dayNum}</span>
                        <span style={{ fontFamily: FC, fontSize: '.5rem', color: phase?.color, letterSpacing: 5 }}>{phase?.name}</span>
                    </div>
                    <div style={{ fontFamily: F, fontSize: '.45rem', color: TEXT_DIM, letterSpacing: 2, marginTop: 6 }}>
                        {phase?.sub} phase {'\u00B7'} click to edit {'\u00B7'} drag to reorder {'\u00B7'} {tasks.length + 1} tasks
                    </div>
                </div>
                <button onClick={onClose} className="kbtn" style={{ background: 'rgba(197,160,89,.1)', border: `1px solid rgba(197,160,89,.25)`, borderRadius: 8, padding: '10px 24px', color: GOLD, fontFamily: FC, fontSize: '.45rem', letterSpacing: 3 }}>CLOSE</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px', position: 'relative', zIndex: 1 }} className="kscr">
                {/* CHASTITY CHECK — permanent strip */}
                <div style={{
                    borderRadius: 12, marginBottom: 24, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16,
                    background: 'rgba(139,0,0,.08)', border: '1px solid rgba(139,0,0,.25)',
                    boxShadow: '0 4px 20px rgba(0,0,0,.3)',
                }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,0,0,.15)', border: '1px solid rgba(139,0,0,.3)' }}>
                        <span style={{ fontFamily: F, fontSize: '1.1rem', color: 'rgba(200,50,50,.9)' }}>{'\u25C8'}</span>
                    </div>
                    <span style={{ fontFamily: FC, fontSize: '.6rem', color: 'rgba(255,255,255,.85)', letterSpacing: 3, flex: 1 }}>Chastity Check</span>
                    <span style={{ fontFamily: F, fontSize: '.38rem', color: 'rgba(200,50,50,.6)', letterSpacing: 2 }}>CONSTANT {'\u00B7'} EVERY DAY</span>
                </div>

                {/* TASK CARDS GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
                    {tasks.map((task: any, idx: number) => {
                        const mechMeta = MECH_LIST.find(m => m.id === task.type);
                        const oldMeta = TASK_META[task.type];
                        const icon = mechMeta?.icon || oldMeta?.icon || '\u2022';
                        const color = mechMeta?.color || oldMeta?.color || '#666';
                        const typeName = mechMeta?.name || oldMeta?.label || task.type;
                        const rgb = _hexToRgb(color);
                        const isEditing = editIdx === idx;

                        return (
                            <div key={idx}
                                draggable onDragStart={() => setDragIdx(idx)}
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('kdrag'); }}
                                onDragLeave={(e) => e.currentTarget.classList.remove('kdrag')}
                                onDrop={(e) => { e.currentTarget.classList.remove('kdrag'); if(dragIdx!==null) moveTask(dragIdx,idx); setDragIdx(null); }}
                                onDragEnd={() => setDragIdx(null)}
                                className="ktc"
                                onClick={() => {
                                    if (isEditing) { setEditIdx(null); setAddConfig({}); }
                                    else { setEditIdx(idx); setAddConfig({ ...task.config, label: task.label, target: task.target, _customMode: true }); setAddOpen(false); setAddMech(null); }
                                }}
                                style={{
                                    borderRadius: 16, opacity: dragIdx===idx ? .15 : 1, overflow: 'hidden', position: 'relative',
                                    display: 'flex', flexDirection: 'column',
                                    background: 'rgba(15,15,20,0.85)',
                                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                    border: `1px solid ${isEditing ? `rgba(${rgb},.5)` : 'rgba(197,160,89,.12)'}`,
                                    boxShadow: isEditing
                                        ? `0 8px 32px rgba(0,0,0,.5), 0 0 0 1px rgba(${rgb},.3), 0 0 20px rgba(${rgb},.1)`
                                        : '0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.03)',
                                    transition: 'all .25s ease',
                                }}>
                                {/* Left accent bar */}
                                <div style={{ position: 'absolute', top: 12, left: 0, width: 3, height: 40, borderRadius: '0 3px 3px 0', background: color, opacity: .7 }} />

                                {/* Delete */}
                                <button onClick={(e) => { e.stopPropagation(); removeTask(idx); }} style={{
                                    position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,.25)', fontFamily: F, fontSize: '1rem', padding: '2px 4px', transition: 'color .2s', zIndex: 2,
                                }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.8)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>

                                {/* Card body */}
                                <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <div style={{ fontFamily: F, fontSize: '.8rem', color: '#fff', fontWeight: 700, letterSpacing: 1, textAlign: 'center', lineHeight: 1.3 }}>{(!task.label || task.label === task.type || task.label.includes('_')) ? typeName : task.label}</div>
                                    <div style={{ fontSize: '2.2rem', color, lineHeight: 1, margin: '8px 0' }}>{icon}</div>
                                    <div style={{ fontFamily: F, fontSize: '.35rem', color: TEXT_DIM, letterSpacing: 2 }}>{typeName}</div>
                                    {/* Gamble outcomes — show all possibilities */}
                                    {task.config && (() => {
                                        const c = task.config;
                                        const pillS: React.CSSProperties = { fontFamily: F, fontSize: '.38rem', color: 'rgba(255,255,255,.55)', padding: '4px 10px', background: `rgba(${rgb},.06)`, border: `1px solid rgba(${rgb},.12)`, borderRadius: 6, lineHeight: 1.4, textAlign: 'center' as const };
                                        const items: string[] = [];
                                        // Spin wheel segments
                                        if (c.segments) c.segments.forEach((s: any) => items.push(s.text));
                                        // Card pick
                                        if (c.cards) c.cards.forEach((s: any) => items.push(s.text));
                                        // Dice outcomes
                                        if (c.outcomes) c.outcomes.forEach((s: any) => items.push(s.text));
                                        // Coinflip
                                        if (c.headsText) { items.push('\u{1FA99} ' + c.headsText); items.push('\u{1FA99} ' + c.tailsText); }
                                        // Truth or dare
                                        if (c.truthText) { items.push('\u2623 ' + c.truthText); items.push('\u2694 ' + c.dareText); }
                                        // Russian roulette
                                        if (c.punishment) { items.push('\u2022 5 empty chambers'); items.push('\u2620 ' + c.punishment); }

                                        if (items.length > 0) return (
                                            <div style={{ marginTop: 8, width: '100%', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'stretch' }}>
                                                <div style={{ fontFamily: F, fontSize: '.3rem', color: `rgba(${rgb},.4)`, letterSpacing: 3, textAlign: 'center', marginBottom: 2 }}>POSSIBLE OUTCOMES</div>
                                                {items.map((txt, ii) => <div key={ii} style={pillS}>{txt}</div>)}
                                            </div>
                                        );

                                        // Non-gamble config info
                                        const info: string[] = [];
                                        if (c.duration) info.push(`${Math.floor(c.duration/60)}:${String(c.duration%60).padStart(2,'0')} duration`);
                                        if (c.minWords) info.push(`${c.minWords}+ words`);
                                        if (c.amount) info.push(`${c.amount} coins`);
                                        if (c.ceiling) info.push(`max ${c.ceiling}`);
                                        if (c.chainTasks) info.push(`${c.chainTasks.length} tasks`);
                                        if (c.prompt) info.push(c.prompt.length > 50 ? c.prompt.slice(0,50) + '...' : c.prompt);
                                        if (c.instruction) info.push(c.instruction.length > 50 ? c.instruction.slice(0,50) + '...' : c.instruction);
                                        if (c.questions?.length > 0) {
                                            c.questions.forEach((q: any, qi: number) => {
                                                if (q.question) info.push(`Q${qi + 1}: ${q.question.length > 45 ? q.question.slice(0, 45) + '...' : q.question}`);
                                            });
                                        } else if (c.question) info.push(c.question.length > 50 ? c.question.slice(0,50) + '...' : c.question);
                                        if (info.length > 0) return (
                                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                                                {info.map((txt, ii) => <span key={ii} style={{ fontFamily: F, fontSize: '.35rem', color: `rgba(${rgb},.5)`, padding: '3px 8px', background: `rgba(${rgb},.06)`, borderRadius: 4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txt}</span>)}
                                            </div>
                                        );
                                        return null;
                                    })()}
                                </div>

                                {/* Bottom bar */}
                                <div style={{ padding: '12px 20px', borderTop: `1px solid rgba(255,255,255,.06)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.2)' }}>
                                    <span style={{ fontFamily: F, fontSize: '.38rem', color: isEditing ? GOLD : TEXT_DIM, letterSpacing: 2 }}>{isEditing ? 'EDITING — CLICK TO CLOSE' : 'CLICK TO EDIT'}</span>
                                    <span style={{ fontFamily: F, fontSize: '1rem', color: GOLD, fontWeight: 700 }}>{task.target}</span>
                                </div>
                            </div>
                        );
                    })}

                </div>

                {/* ── EDIT EXISTING TASK — full config form ── */}
                {editIdx !== null && tasks[editIdx] && (() => {
                    const task = tasks[editIdx] as any;
                    const mechId = task.type;
                    const mech = MECH_LIST.find(m => m.id === mechId) || { id: mechId, name: mechId, icon: '\u2022', color: '#666', desc: '' };
                    const rgb = _hexToRgb(mech.color);
                    const inp: React.CSSProperties = { background: 'rgba(255,255,255,.06)', border: `1px solid rgba(${rgb},.25)`, borderRadius: 8, padding: '12px 16px', color: 'rgba(255,255,255,.9)', fontFamily: F, fontSize: '.72rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
                    const lbl: React.CSSProperties = { fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 3, marginBottom: 4 };
                    const ta: React.CSSProperties = { ...inp, resize: 'vertical' as const };
                    const addBtnS: React.CSSProperties = { width: '100%', padding: '10px', fontFamily: F, fontSize: '.42rem', letterSpacing: 2, color: `rgba(${rgb},.5)`, background: `rgba(${rgb},.04)`, border: `1px dashed rgba(${rgb},.2)`, borderRadius: 8, cursor: 'pointer' };
                    const fuPicker = (item: any, update: (k: string, v: any) => void) => {
                        const cur = item.followUpType || 'instant';
                        const reviewTypes = [
                            { value: 'photo',   label: 'PHOTO'   },
                            { value: 'video',   label: 'VIDEO'   },
                            { value: 'writing', label: 'WRITING' },
                        ];
                        const autoTypes = [
                            { value: 'add_day',      label: '+ DAY'    },
                            { value: 'remove_day',   label: '− DAY'    },
                            { value: 'add_coins',    label: '+ COINS'  },
                            { value: 'remove_coins', label: '− COINS'  },
                            { value: 'add_skippass', label: '+ SKIP'   },
                            { value: 'instant',      label: 'NONE'     },
                        ];
                        const btn = (value: string, label: string) => {
                            const active = cur === value;
                            return (
                                <button key={value} onClick={() => update('followUpType', value)} style={{
                                    padding: '5px 11px', borderRadius: 5, cursor: 'pointer',
                                    fontFamily: F, fontSize: '.35rem', letterSpacing: '1.5px',
                                    border: `1px solid ${active ? `rgba(${rgb},.5)` : 'rgba(255,255,255,.08)'}`,
                                    background: active ? `rgba(${rgb},.1)` : 'transparent',
                                    color: active ? `rgba(${rgb > '1' ? rgb : '197,160,89'},.9)` : 'rgba(255,255,255,.3)',
                                    transition: 'all .12s',
                                }}>{label}</button>
                            );
                        };
                        return (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ ...lbl, marginBottom: 6 }}>FOLLOW-UP</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                        <span style={{ fontFamily: F, fontSize: '.28rem', color: 'rgba(255,255,255,.2)', letterSpacing: 2, width: 60 }}>REVIEW</span>
                                        {reviewTypes.map(t => btn(t.value, t.label))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                        <span style={{ fontFamily: F, fontSize: '.28rem', color: 'rgba(255,255,255,.2)', letterSpacing: 2, width: 60 }}>AUTO</span>
                                        {autoTypes.map(t => btn(t.value, t.label))}
                                    </div>
                                </div>
                                {/* Extra config per type */}
                                {cur === 'writing' && (
                                    <input value={item.followUpPrompt || ''} onChange={e => update('followUpPrompt', e.target.value)} placeholder="Writing prompt (optional)..." style={{ ...inp, marginTop: 8, padding: '7px 12px', fontSize: '.52rem' }} />
                                )}
                                {cur === 'photo' && (
                                    <input value={item.followUpInstruction || ''} onChange={e => update('followUpInstruction', e.target.value)} placeholder="Photo instruction (optional)..." style={{ ...inp, marginTop: 8, padding: '7px 12px', fontSize: '.52rem' }} />
                                )}
                                {cur === 'video' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={5} value={item.followUpDuration || 60} onChange={e => update('followUpDuration', +e.target.value)} style={{ ...inp, width: 80, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>sec time limit</span>
                                    </div>
                                )}
                                {(cur === 'add_day' || cur === 'remove_day') && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={1} value={item.followUpAmount || 1} onChange={e => update('followUpAmount', +e.target.value)} style={{ ...inp, width: 70, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>{cur === 'add_day' ? 'days added' : 'days removed'}</span>
                                    </div>
                                )}
                                {(cur === 'add_coins' || cur === 'remove_coins') && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={1} value={item.followUpAmount || 50} onChange={e => update('followUpAmount', +e.target.value)} style={{ ...inp, width: 80, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>{cur === 'add_coins' ? 'coins awarded' : 'coins deducted'}</span>
                                    </div>
                                )}
                                {cur === 'add_skippass' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={1} value={item.followUpAmount || 1} onChange={e => update('followUpAmount', +e.target.value)} style={{ ...inp, width: 70, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>skip passes awarded</span>
                                    </div>
                                )}
                            </div>
                        );
                    };
                    const ec = addConfig; // edit config state
                    const setEc = (v: any) => setAddConfig(v);

                    const listBuilder = (key: string, itemLabel: string) => {
                        const items = ec[key] || [{ text: '', followUpType: 'instant' }];
                        const updateItem = (idx2: number, field: string, val: any) => { const n = [...items]; n[idx2] = { ...n[idx2], [field]: val }; setEc({ ...ec, [key]: n }); };
                        const removeItem = (idx2: number) => { const n = [...items]; n.splice(idx2, 1); setEc({ ...ec, [key]: n }); };
                        const addItemFn = () => setEc({ ...ec, [key]: [...items, { text: '', followUpType: 'instant' }] });
                        return (
                            <div>
                                {items.map((item: any, i: number) => (
                                    <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, marginBottom: 8 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ fontFamily: F, fontSize: '.55rem', color: 'rgba(255,255,255,.25)', width: 18, flexShrink: 0 }}>{i + 1}</span>
                                            <input value={item.text} onChange={e => updateItem(i, 'text', e.target.value)} placeholder={`${itemLabel} text...`} style={{ ...inp, flex: 1, padding: '8px 12px', fontSize: '.6rem' }} />
                                            {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.3)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', lineHeight: 1 }}>×</button>}
                                        </div>
                                        {fuPicker(item, (k, v) => updateItem(i, k, v))}
                                    </div>
                                ))}
                                <button onClick={addItemFn} style={addBtnS}>+ ADD {itemLabel.toUpperCase()}</button>
                            </div>
                        );
                    };

                    const saveEdit = () => {
                        const { _customMode, label, target, ...cleanConfig } = ec;
                        updateTask(editIdx, 'label', label || task.label);
                        updateTask(editIdx, 'target', target || task.target);
                        updateTask(editIdx, 'config', cleanConfig);
                        setEditIdx(null); setAddConfig({});
                    };

                    return (
                        <div className="kfade" style={{ marginTop: 18, padding: '20px 24px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: `1px solid rgba(${rgb},.25)`, backdropFilter: 'blur(12px)', boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 20px rgba(${rgb},.08)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                                <button onClick={() => { setEditIdx(null); setAddConfig({}); }} style={{ background: 'none', border: 'none', color: TEXT_DIM, fontFamily: F, fontSize: '.9rem', cursor: 'pointer', padding: '0 4px' }}>{'\u2190'}</button>
                                <span style={{ fontSize: '1.2rem', color: mech.color }}>{mech.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: FC, fontSize: '.55rem', color: '#fff', letterSpacing: 3 }}>EDITING: {mech.name || task.type}</div>
                                    <div style={{ fontFamily: F, fontSize: '.35rem', color: TEXT_DIM, marginTop: 2 }}>{mech.desc}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {mechId === 'kneel' ? (
                                    <div>
                                        <div style={lbl}>SESSIONS REQUIRED</div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                            {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                                                <button key={n} onClick={() => { updateTask(editIdx!, 'target', n); updateTask(editIdx!, 'label', `Kneel ${n} times`); setEc({ ...ec, target: n, label: `Kneel ${n} times` }); }}
                                                    style={{ width: 44, height: 44, borderRadius: 8, border: `1px solid ${(task.target || 4) === n ? 'rgba(197,160,89,.6)' : 'rgba(255,255,255,.1)'}`, background: (task.target || 4) === n ? 'rgba(197,160,89,.15)' : 'rgba(255,255,255,.03)', color: (task.target || 4) === n ? GOLD : TEXT_DIM, fontFamily: F, fontSize: '.7rem', fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div><div style={lbl}>TASK LABEL</div><input value={ec.label || ''} onChange={e => setEc({ ...ec, label: e.target.value })} style={inp} /></div>
                                )}
                                {mechId === 'spin_wheel' && (<><div style={lbl}>WHEEL SEGMENTS</div>{listBuilder('segments', 'Segment')}</>)}
                                {mechId === 'coinflip' && (<>
                                    <div>
                                        <div style={lbl}>HEADS</div>
                                        <input value={ec.headsText || ''} onChange={e => setEc({ ...ec, headsText: e.target.value })} style={inp} />
                                        {fuPicker(
                                            { followUpType: ec.headsFollowUpType || 'instant', followUpAmount: ec.headsFollowUpAmount },
                                            (k, v) => setEc({ ...ec, [k === 'followUpType' ? 'headsFollowUpType' : 'headsFollowUpAmount']: v })
                                        )}
                                    </div>
                                    <div>
                                        <div style={lbl}>TAILS</div>
                                        <input value={ec.tailsText || ''} onChange={e => setEc({ ...ec, tailsText: e.target.value })} style={inp} />
                                        {fuPicker(
                                            { followUpType: ec.tailsFollowUpType || 'instant', followUpAmount: ec.tailsFollowUpAmount },
                                            (k, v) => setEc({ ...ec, [k === 'followUpType' ? 'tailsFollowUpType' : 'tailsFollowUpAmount']: v })
                                        )}
                                    </div>
                                </>)}
                                {mechId === 'card_pick' && (<><div style={lbl}>CARDS</div>{listBuilder('cards', 'Card')}</>)}
                                {mechId === 'dice_roll' && (<><div style={lbl}>DICE FACES / OUTCOMES</div>{listBuilder('outcomes', 'Outcome')}</>)}
                                {mechId === 'russian_roulette' && (
                                    <div><div style={lbl}>PUNISHMENT IF LOADED</div><input value={ec.punishment || ''} onChange={e => setEc({ ...ec, punishment: e.target.value })} style={inp} /></div>
                                )}
                                {mechId === 'quiz' && (() => {
                                    const qs: any[] = ec.questions?.length > 0 ? ec.questions : ec.question ? [{ question: ec.question, answers: ec.answers || [''], correctIdx: ec.correctIdx ?? 0, timeLimit: ec.timeLimit || 60 }] : [{ question: '', answers: ['', ''], correctIdx: 0, timeLimit: 60 }];
                                    const setQs = (next: any[]) => setEc({ ...ec, questions: next, question: undefined, answers: undefined, correctIdx: undefined, timeLimit: undefined });
                                    return (<>
                                        {qs.map((q: any, qi: number) => (
                                            <div key={qi} style={{ padding: 12, background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <span style={lbl}>QUESTION {qi + 1}</span>
                                                    {qs.length > 1 && <button onClick={() => { const n = [...qs]; n.splice(qi, 1); setQs(n); }} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.5)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>{'\u00D7'}</button>}
                                                </div>
                                                <textarea value={q.question || ''} onChange={e => { const n = [...qs]; n[qi] = { ...n[qi], question: e.target.value }; setQs(n); }} rows={2} style={ta as any} placeholder="Ask something..." />
                                                <div style={{ ...lbl, marginTop: 8, marginBottom: 4 }}>ANSWERS (circle = correct)</div>
                                                {(q.answers || ['']).map((ans: string, ai: number) => (
                                                    <div key={ai} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                                                        <button onClick={() => { const n = [...qs]; n[qi] = { ...n[qi], correctIdx: ai }; setQs(n); }} style={{ width: 22, height: 22, borderRadius: '50%', background: q.correctIdx === ai ? 'rgba(80,200,120,.2)' : 'rgba(255,255,255,.04)', border: `1px solid ${q.correctIdx === ai ? 'rgba(80,200,120,.4)' : 'rgba(255,255,255,.1)'}`, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {q.correctIdx === ai && <span style={{ color: 'rgba(80,200,120,.7)', fontSize: '.65rem' }}>{'\u2713'}</span>}
                                                        </button>
                                                        <input value={ans} onChange={e => { const n = [...qs]; const a = [...(n[qi].answers || [''])]; a[ai] = e.target.value; n[qi] = { ...n[qi], answers: a }; setQs(n); }} style={{ ...inp, flex: 1, padding: '7px 10px', fontSize: '.6rem' }} />
                                                        {(q.answers || []).length > 1 && <button onClick={() => { const n = [...qs]; const a = [...n[qi].answers]; a.splice(ai, 1); n[qi] = { ...n[qi], answers: a }; setQs(n); }} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '.9rem' }}>{'\u00D7'}</button>}
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <button onClick={() => { const n = [...qs]; n[qi] = { ...n[qi], answers: [...(q.answers || ['']), ''] }; setQs(n); }} style={addBtnS}>+ ANSWER</button>
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ ...lbl, margin: 0 }}>TIME</span><input type="number" value={q.timeLimit || 60} onChange={e => { const n = [...qs]; n[qi] = { ...n[qi], timeLimit: +e.target.value }; setQs(n); }} style={{ ...inp, width: 55, padding: '6px 8px', fontSize: '.6rem' }} /><span style={{ ...lbl, margin: 0 }}>s</span></div>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => setQs([...qs, { question: '', answers: ['', ''], correctIdx: 0, timeLimit: 60 }])} style={{ ...addBtnS, color: GOLD_DIM, border: '1px dashed rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.04)' }}>+ ADD QUESTION</button>
                                    </>);
                                })()}
                                {mechId === 'writing' && (<>
                                    <div><div style={lbl}>PROMPT</div><textarea value={ec.prompt || ''} onChange={e => setEc({ ...ec, prompt: e.target.value })} rows={3} style={ta as any} /></div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>MIN WORDS</span><input type="number" value={ec.minWords || 50} onChange={e => setEc({ ...ec, minWords: +e.target.value })} style={{ ...inp, width: 70 }} /></div>
                                </>)}
                                {mechId === 'multi_video' && (<>
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={ec.instruction || ''} onChange={e => setEc({ ...ec, instruction: e.target.value })} rows={2} style={ta as any} /></div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>RECORDINGS</span><input type="number" value={ec.target || 1} onChange={e => setEc({ ...ec, target: +e.target.value })} style={{ ...inp, width: 70 }} /></div>
                                </>)}
                                {mechId === 'photo_proof' && (
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={ec.instruction || ''} onChange={e => setEc({ ...ec, instruction: e.target.value })} rows={2} style={ta as any} /></div>
                                )}
                                {mechId === 'timed_photo' && (<>
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={ec.instruction || ''} onChange={e => setEc({ ...ec, instruction: e.target.value })} rows={2} style={ta as any} /></div>
                                </>)}
                                {mechId === 'ambush_snap' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>NUMBER OF SNAPS</span><input type="number" value={ec.target || 3} onChange={e => setEc({ ...ec, target: +e.target.value })} style={{ ...inp, width: 70 }} /></div>
                                )}
                                {mechId === 'endurance' && (<>
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={ec.instruction || ''} onChange={e => setEc({ ...ec, instruction: e.target.value })} rows={2} style={ta as any} /></div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>DURATION (SEC)</span><input type="number" value={ec.duration || 60} onChange={e => setEc({ ...ec, duration: +e.target.value, target: +e.target.value })} style={{ ...inp, width: 80 }} /></div>
                                </>)}
                                {mechId === 'greed_game' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>MAX CEILING</span><input type="number" value={ec.ceiling || 50} onChange={e => setEc({ ...ec, ceiling: +e.target.value })} style={{ ...inp, width: 80 }} /></div>
                                )}
                                {mechId === 'truth_dare' && (<>
                                    {(['truth', 'dare'] as const).map(side => {
                                        const textKey = side === 'truth' ? 'truthText' : 'dareText';
                                        const fuKey   = side === 'truth' ? 'truthFollowUp' : 'dareFollowUp';
                                        const cur     = ec[fuKey] || (side === 'truth' ? 'writing' : 'endurance');
                                        const allTypes = [
                                            { value: 'photo', label: 'PHOTO' }, { value: 'video', label: 'VIDEO' },
                                            { value: 'writing', label: 'WRITING' }, { value: 'add_day', label: '+DAY' },
                                            { value: 'remove_day', label: '−DAY' }, { value: 'add_coins', label: '+COINS' },
                                            { value: 'remove_coins', label: '−COINS' }, { value: 'instant', label: 'NONE' },
                                        ];
                                        return (
                                            <div key={side} style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                                                <div style={lbl}>{side.toUpperCase()}</div>
                                                <input value={ec[textKey] || ''} onChange={e => setEc({ ...ec, [textKey]: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
                                                <div style={lbl}>FOLLOW-UP</div>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                                    {allTypes.map(t => {
                                                        const active = cur === t.value;
                                                        return <button key={t.value} onClick={() => setEc({ ...ec, [fuKey]: t.value })} style={{ padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontFamily: F, fontSize: '.35rem', letterSpacing: '1.5px', border: `1px solid ${active ? `rgba(${rgb},.5)` : 'rgba(255,255,255,.08)'}`, background: active ? `rgba(${rgb},.1)` : 'transparent', color: active ? `rgba(${rgb},.9)` : 'rgba(255,255,255,.3)', transition: 'all .12s' }}>{t.label}</button>;
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>)}
                                {mechId === 'simon_says' && (<>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                                        <span style={{ ...lbl, margin: 0 }}>INTERVAL BETWEEN TASKS</span>
                                        <input type="number" value={ec.intervalMinutes || 60} onChange={e => setEc({ ...ec, intervalMinutes: +e.target.value })} style={{ ...inp, width: 60, padding: '6px 8px', fontSize: '.55rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM }}>min</span>
                                    </div>
                                    <div style={lbl}>TASKS IN CHAIN</div>
                                    {(ec.chainTasks || [{ text: '', timeLimit: 60, proofType: 'video' }]).map((ct: any, i: number) => (
                                        <div key={i} style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ fontFamily: F, fontSize: '.6rem', color: TEXT_DIM, width: 18 }}>{i + 1}</span>
                                                <input value={ct.text} onChange={e => { const n = [...(ec.chainTasks || [])]; n[i] = { ...n[i], text: e.target.value }; setEc({ ...ec, chainTasks: n }); }} style={{ ...inp, flex: 1, padding: '8px 12px', fontSize: '.6rem' }} />
                                                <input type="number" value={ct.timeLimit} onChange={e => { const n = [...ec.chainTasks]; n[i] = { ...n[i], timeLimit: +e.target.value }; setEc({ ...ec, chainTasks: n }); }} style={{ ...inp, width: 55, padding: '8px', fontSize: '.55rem' }} />
                                                <span style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM }}>s</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, paddingLeft: 26 }}>
                                                {(['photo', 'video'] as const).map(pt => (
                                                    <button key={pt} onClick={() => { const n = [...ec.chainTasks]; n[i] = { ...n[i], proofType: pt }; setEc({ ...ec, chainTasks: n }); }}
                                                        style={{ fontFamily: F, fontSize: '.38rem', letterSpacing: 2, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${(ct.proofType || 'video') === pt ? 'rgba(197,160,89,.5)' : 'rgba(255,255,255,.08)'}`, background: (ct.proofType || 'video') === pt ? 'rgba(197,160,89,.1)' : 'transparent', color: (ct.proofType || 'video') === pt ? GOLD : TEXT_DIM }}>
                                                        {pt.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setEc({ ...ec, chainTasks: [...(ec.chainTasks || []), { text: '', timeLimit: 60, proofType: 'video' }] })} style={addBtnS}>+ ADD TASK</button>
                                </>)}
                                {mechId === 'payment' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>COIN AMOUNT</span><input type="number" value={ec.amount || 10} onChange={e => setEc({ ...ec, amount: +e.target.value, target: +e.target.value })} style={{ ...inp, width: 80 }} /></div>
                                )}
                            </div>

                            <button onClick={saveEdit} className="kbtn" style={{
                                marginTop: 20, width: '100%', padding: '14px', fontFamily: FC, fontSize: '.5rem', letterSpacing: 4,
                                color: GOLD, background: 'rgba(197,160,89,.08)', border: `1px solid rgba(197,160,89,.25)`, borderRadius: 10, cursor: 'pointer',
                            }}>SAVE CHANGES</button>
                        </div>
                    );
                })()}

                {/* Divider — add more tasks */}
                <div onClick={() => { setAddOpen(!addOpen); setEditIdx(null); setAddConfig({}); }} style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0', cursor: 'pointer' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(197,160,89,.15)' }} />
                    <span style={{ fontFamily: FC, fontSize: '.45rem', color: addOpen ? GOLD : TEXT_DIM, letterSpacing: 5, transition: 'color .2s' }}>ADD MORE TASKS</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(197,160,89,.15)' }} />
                </div>

                {/* Mechanism picker — step 1 */}
                {addOpen && !addMech && (
                    <div className="kfade">
                        <div style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 3, marginBottom: 14 }}>PICK A MECHANISM</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            {MECH_LIST.map(m => (
                                <button key={m.id} onClick={() => { setAddMech(m.id); setAddConfig({ label: m.name, target: 1 }); }} className="kbtn" style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 12px',
                                    borderRadius: 12, border: `1px solid rgba(${_hexToRgb(m.color)},.18)`, textAlign: 'center',
                                    background: 'rgba(15,15,20,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                                }}>
                                    <span style={{ fontSize: '1.2rem', color: m.color, lineHeight: 1 }}>{m.icon}</span>
                                    <span style={{ fontFamily: F, fontSize: '.5rem', fontWeight: 600, color: '#fff', letterSpacing: 1 }}>{m.name}</span>
                                    <span style={{ fontFamily: F, fontSize: '.35rem', color: TEXT_DIM, lineHeight: 1.3 }}>{m.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mechanism config — step 2 */}
                {addOpen && addMech && (() => {
                    const mech = MECH_LIST.find(m => m.id === addMech) || { id: addMech, name: addMech, icon: '\u2022', color: '#666', desc: '' };
                    const rgb = _hexToRgb(mech.color);
                    const inp: React.CSSProperties = { background: 'rgba(255,255,255,.06)', border: `1px solid rgba(${rgb},.25)`, borderRadius: 8, padding: '12px 16px', color: 'rgba(255,255,255,.9)', fontFamily: F, fontSize: '.72rem', outline: 'none', width: '100%', boxSizing: 'border-box' };
                    const lbl: React.CSSProperties = { fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 3, marginBottom: 4 };
                    const ta: React.CSSProperties = { ...inp, resize: 'vertical' as const };
                    const addBtn: React.CSSProperties = { width: '100%', padding: '10px', fontFamily: F, fontSize: '.42rem', letterSpacing: 2, color: `rgba(${rgb},.5)`, background: `rgba(${rgb},.04)`, border: `1px dashed rgba(${rgb},.2)`, borderRadius: 8, cursor: 'pointer' };
                    const fuPicker = (item: any, update: (k: string, v: any) => void) => {
                        const cur = item.followUpType || 'instant';
                        const reviewTypes = [
                            { value: 'photo',   label: 'PHOTO'   },
                            { value: 'video',   label: 'VIDEO'   },
                            { value: 'writing', label: 'WRITING' },
                        ];
                        const autoTypes = [
                            { value: 'add_day',      label: '+ DAY'    },
                            { value: 'remove_day',   label: '− DAY'    },
                            { value: 'add_coins',    label: '+ COINS'  },
                            { value: 'remove_coins', label: '− COINS'  },
                            { value: 'add_skippass', label: '+ SKIP'   },
                            { value: 'instant',      label: 'NONE'     },
                        ];
                        const btn = (value: string, label: string) => {
                            const active = cur === value;
                            return (
                                <button key={value} onClick={() => update('followUpType', value)} style={{
                                    padding: '5px 11px', borderRadius: 5, cursor: 'pointer',
                                    fontFamily: F, fontSize: '.35rem', letterSpacing: '1.5px',
                                    border: `1px solid ${active ? `rgba(${rgb},.5)` : 'rgba(255,255,255,.08)'}`,
                                    background: active ? `rgba(${rgb},.1)` : 'transparent',
                                    color: active ? `rgba(${rgb > '1' ? rgb : '197,160,89'},.9)` : 'rgba(255,255,255,.3)',
                                    transition: 'all .12s',
                                }}>{label}</button>
                            );
                        };
                        return (
                            <div style={{ marginTop: 10 }}>
                                <div style={{ ...lbl, marginBottom: 6 }}>FOLLOW-UP</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                        <span style={{ fontFamily: F, fontSize: '.28rem', color: 'rgba(255,255,255,.2)', letterSpacing: 2, width: 60 }}>REVIEW</span>
                                        {reviewTypes.map(t => btn(t.value, t.label))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                                        <span style={{ fontFamily: F, fontSize: '.28rem', color: 'rgba(255,255,255,.2)', letterSpacing: 2, width: 60 }}>AUTO</span>
                                        {autoTypes.map(t => btn(t.value, t.label))}
                                    </div>
                                </div>
                                {cur === 'writing' && (
                                    <input value={item.followUpPrompt || ''} onChange={e => update('followUpPrompt', e.target.value)} placeholder="Writing prompt (optional)..." style={{ ...inp, marginTop: 8, padding: '7px 12px', fontSize: '.52rem' }} />
                                )}
                                {cur === 'photo' && (
                                    <input value={item.followUpInstruction || ''} onChange={e => update('followUpInstruction', e.target.value)} placeholder="Photo instruction (optional)..." style={{ ...inp, marginTop: 8, padding: '7px 12px', fontSize: '.52rem' }} />
                                )}
                                {cur === 'video' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={5} value={item.followUpDuration || 60} onChange={e => update('followUpDuration', +e.target.value)} style={{ ...inp, width: 80, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>sec time limit</span>
                                    </div>
                                )}
                                {(cur === 'add_day' || cur === 'remove_day') && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={1} value={item.followUpAmount || 1} onChange={e => update('followUpAmount', +e.target.value)} style={{ ...inp, width: 70, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>{cur === 'add_day' ? 'days added' : 'days removed'}</span>
                                    </div>
                                )}
                                {(cur === 'add_coins' || cur === 'remove_coins') && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={1} value={item.followUpAmount || 50} onChange={e => update('followUpAmount', +e.target.value)} style={{ ...inp, width: 80, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>{cur === 'add_coins' ? 'coins awarded' : 'coins deducted'}</span>
                                    </div>
                                )}
                                {cur === 'add_skippass' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                        <input type="number" min={1} value={item.followUpAmount || 1} onChange={e => update('followUpAmount', +e.target.value)} style={{ ...inp, width: 70, padding: '7px 12px', fontSize: '.52rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>skip passes awarded</span>
                                    </div>
                                )}
                            </div>
                        );
                    };

                    const confirmAdd = () => {
                        const taskType = mech.id;
                        const { _customMode, ...cleanConfig } = addConfig;
                        addTask(taskType, cleanConfig.label || mech.name, cleanConfig.target || 1, cleanConfig);
                        setAddMech(null); setAddConfig({}); setAddOpen(false);
                    };

                    // List builder helper for segments / cards / outcomes
                    const listBuilder = (key: string, itemLabel: string) => {
                        const items = addConfig[key] || [{ text: '', followUpType: 'instant' }];
                        const updateItem = (idx: number, field: string, val: any) => { const n = [...items]; n[idx] = { ...n[idx], [field]: val }; setAddConfig({ ...addConfig, [key]: n }); };
                        const removeItem = (idx: number) => { const n = [...items]; n.splice(idx, 1); setAddConfig({ ...addConfig, [key]: n }); };
                        const addItem = () => setAddConfig({ ...addConfig, [key]: [...items, { text: '', followUpType: 'instant' }] });
                        return (
                            <div>
                                {items.map((item: any, i: number) => (
                                    <div key={i} style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, marginBottom: 8 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ fontFamily: F, fontSize: '.55rem', color: 'rgba(255,255,255,.25)', width: 18, flexShrink: 0 }}>{i + 1}</span>
                                            <input value={item.text} onChange={e => updateItem(i, 'text', e.target.value)} placeholder={`${itemLabel} text...`} style={{ ...inp, flex: 1, padding: '8px 12px', fontSize: '.6rem' }} />
                                            {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.3)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', lineHeight: 1 }}>×</button>}
                                        </div>
                                        {fuPicker(item, (k, v) => updateItem(i, k, v))}
                                    </div>
                                ))}
                                <button onClick={addItem} style={addBtn}>+ ADD {itemLabel.toUpperCase()}</button>
                            </div>
                        );
                    };

                    return (
                        <div className="kfade" style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: `1px solid rgba(${rgb},.25)`, backdropFilter: 'blur(12px)', boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 20px rgba(${rgb},.08)` }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                                <button onClick={() => { setAddMech(null); setAddConfig({}); }} style={{ background: 'none', border: 'none', color: TEXT_DIM, fontFamily: F, fontSize: '.9rem', cursor: 'pointer', padding: '0 4px' }}>{'\u2190'}</button>
                                <span style={{ fontSize: '1.2rem', color: mech.color }}>{mech.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: FC, fontSize: '.55rem', color: '#fff', letterSpacing: 3 }}>{mech.name}</div>
                                    <div style={{ fontFamily: F, fontSize: '.35rem', color: TEXT_DIM, marginTop: 2 }}>{mech.desc}</div>
                                </div>
                            </div>

                            {/* ── PRESET PICKER ── */}
                            {!addConfig._customMode && (MECH_PRESETS[addMech] || []).length > 0 && (
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ ...lbl, marginBottom: 10 }}>PRESETS — PICK ONE OR GO CUSTOM</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                        {(MECH_PRESETS[addMech] || []).map((p, pi) => (
                                            <button key={pi} onClick={() => setAddConfig({ ...p.config, _customMode: true })} className="kbtn" style={{
                                                padding: '14px 16px', borderRadius: 10, textAlign: 'left',
                                                background: 'rgba(255,255,255,.03)', border: `1px solid rgba(${rgb},.15)`,
                                                display: 'flex', flexDirection: 'column', gap: 4,
                                            }}>
                                                <span style={{ fontFamily: F, fontSize: '.55rem', fontWeight: 700, color: '#fff', letterSpacing: 1 }}>{p.name}</span>
                                                <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, lineHeight: 1.4 }}>{p.desc}</span>
                                            </button>
                                        ))}
                                        <button onClick={() => setAddConfig({ ...addConfig, _customMode: true })} className="kbtn" style={{
                                            padding: '14px 16px', borderRadius: 10, textAlign: 'left',
                                            background: 'rgba(197,160,89,.04)', border: `1px dashed rgba(197,160,89,.2)`,
                                            display: 'flex', flexDirection: 'column', gap: 4,
                                        }}>
                                            <span style={{ fontFamily: F, fontSize: '.55rem', fontWeight: 700, color: GOLD, letterSpacing: 1 }}>CUSTOM</span>
                                            <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, lineHeight: 1.4 }}>Build from scratch</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── CONFIG FORM (shows after preset pick or if no presets) ── */}
                            {(addConfig._customMode || !(MECH_PRESETS[addMech] || []).length) && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {/* Label — always */}
                                <div>
                                    <div style={lbl}>TASK LABEL</div>
                                    <input value={addConfig.label || ''} onChange={e => setAddConfig({ ...addConfig, label: e.target.value })} style={inp} />
                                </div>

                                {/* ── SPIN WHEEL ── */}
                                {addMech === 'spin_wheel' && (<><div style={lbl}>WHEEL SEGMENTS</div>{listBuilder('segments', 'Segment')}</>)}

                                {/* ── COINFLIP ── */}
                                {addMech === 'coinflip' && (<>
                                    <div>
                                        <div style={lbl}>HEADS</div>
                                        <input value={addConfig.headsText || ''} onChange={e => setAddConfig({ ...addConfig, headsText: e.target.value })} placeholder="e.g. +50 coins" style={inp} />
                                        {fuPicker(
                                            { followUpType: addConfig.headsFollowUpType || 'instant', followUpAmount: addConfig.headsFollowUpAmount },
                                            (k, v) => setAddConfig({ ...addConfig, [k === 'followUpType' ? 'headsFollowUpType' : 'headsFollowUpAmount']: v })
                                        )}
                                    </div>
                                    <div>
                                        <div style={lbl}>TAILS</div>
                                        <input value={addConfig.tailsText || ''} onChange={e => setAddConfig({ ...addConfig, tailsText: e.target.value })} placeholder="e.g. +1 day locked" style={inp} />
                                        {fuPicker(
                                            { followUpType: addConfig.tailsFollowUpType || 'instant', followUpAmount: addConfig.tailsFollowUpAmount },
                                            (k, v) => setAddConfig({ ...addConfig, [k === 'followUpType' ? 'tailsFollowUpType' : 'tailsFollowUpAmount']: v })
                                        )}
                                    </div>
                                </>)}

                                {/* ── CARD PICK ── */}
                                {addMech === 'card_pick' && (<><div style={lbl}>CARDS</div>{listBuilder('cards', 'Card')}</>)}

                                {/* ── DICE ROLL ── */}
                                {addMech === 'dice_roll' && (<><div style={lbl}>DICE FACES / OUTCOMES</div>{listBuilder('outcomes', 'Outcome')}</>)}

                                {/* ── RUSSIAN ROULETTE ── */}
                                {addMech === 'russian_roulette' && (
                                    <div style={{ fontFamily: F, fontSize: '.42rem', color: TEXT_DIM, lineHeight: 1.6 }}>6 chambers, 1 loaded. They pull until they hit or survive.</div>
                                )}

                                {/* ── QUIZ / RIDDLE ── */}
                                {addMech === 'quiz' && (() => {
                                    const qs: any[] = addConfig.questions?.length > 0 ? addConfig.questions : [{ question: '', answers: ['', ''], correctIdx: 0, timeLimit: 60 }];
                                    const setQs = (next: any[]) => setAddConfig({ ...addConfig, questions: next });
                                    return (<>
                                        {qs.map((q: any, qi: number) => (
                                            <div key={qi} style={{ padding: 12, background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <span style={lbl}>QUESTION {qi + 1}</span>
                                                    {qs.length > 1 && <button onClick={() => { const n = [...qs]; n.splice(qi, 1); setQs(n); }} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.5)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>{'\u00D7'}</button>}
                                                </div>
                                                <textarea value={q.question || ''} onChange={e => { const n = [...qs]; n[qi] = { ...n[qi], question: e.target.value }; setQs(n); }} placeholder="Ask something..." rows={2} style={ta as any} />
                                                <div style={{ ...lbl, marginTop: 8, marginBottom: 4 }}>ANSWERS (circle = correct)</div>
                                                {(q.answers || ['']).map((ans: string, ai: number) => (
                                                    <div key={ai} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                                                        <button onClick={() => { const n = [...qs]; n[qi] = { ...n[qi], correctIdx: ai }; setQs(n); }} style={{ width: 22, height: 22, borderRadius: '50%', background: q.correctIdx === ai ? 'rgba(80,200,120,.2)' : 'rgba(255,255,255,.04)', border: `1px solid ${q.correctIdx === ai ? 'rgba(80,200,120,.4)' : 'rgba(255,255,255,.1)'}`, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {q.correctIdx === ai && <span style={{ color: 'rgba(80,200,120,.7)', fontSize: '.65rem' }}>{'\u2713'}</span>}
                                                        </button>
                                                        <input value={ans} onChange={e => { const n = [...qs]; const a = [...(n[qi].answers || [''])]; a[ai] = e.target.value; n[qi] = { ...n[qi], answers: a }; setQs(n); }} placeholder={`Answer ${ai + 1}...`} style={{ ...inp, flex: 1, padding: '7px 10px', fontSize: '.6rem' }} />
                                                        {(q.answers || []).length > 1 && <button onClick={() => { const n = [...qs]; const a = [...n[qi].answers]; a.splice(ai, 1); n[qi] = { ...n[qi], answers: a }; setQs(n); }} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '.9rem' }}>{'\u00D7'}</button>}
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <button onClick={() => { const n = [...qs]; n[qi] = { ...n[qi], answers: [...(q.answers || ['']), ''] }; setQs(n); }} style={addBtn}>+ ANSWER</button>
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ ...lbl, margin: 0 }}>TIME</span><input type="number" value={q.timeLimit || 60} onChange={e => { const n = [...qs]; n[qi] = { ...n[qi], timeLimit: +e.target.value }; setQs(n); }} style={{ ...inp, width: 55, padding: '6px 8px', fontSize: '.6rem' }} /><span style={{ ...lbl, margin: 0 }}>s</span></div>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => setQs([...qs, { question: '', answers: ['', ''], correctIdx: 0, timeLimit: 60 }])} style={{ ...addBtn, color: GOLD_DIM, border: '1px dashed rgba(197,160,89,0.3)', background: 'rgba(197,160,89,0.04)' }}>+ ADD QUESTION</button>
                                    </>);
                                })()}

                                {/* ── WRITING PROMPT ── */}
                                {addMech === 'writing' && (<>
                                    <div><div style={lbl}>PROMPT</div><textarea value={addConfig.prompt || ''} onChange={e => setAddConfig({ ...addConfig, prompt: e.target.value })} placeholder="What to write about..." rows={3} style={ta as any} /></div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>MIN WORDS</span><input type="number" value={addConfig.minWords || 50} onChange={e => setAddConfig({ ...addConfig, minWords: +e.target.value })} style={{ ...inp, width: 70 }} /></div>
                                </>)}

                                {/* ── MULTI-STAGE VIDEO ── */}
                                {addMech === 'multi_video' && (<>
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={addConfig.instruction || ''} onChange={e => setAddConfig({ ...addConfig, instruction: e.target.value })} placeholder="What to record..." rows={2} style={ta as any} /></div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>RECORDINGS NEEDED</span><input type="number" value={addConfig.target || 1} onChange={e => setAddConfig({ ...addConfig, target: +e.target.value })} style={{ ...inp, width: 70 }} /></div>
                                </>)}

                                {/* ── PHOTO PROOF ── */}
                                {addMech === 'photo_proof' && (
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={addConfig.instruction || ''} onChange={e => setAddConfig({ ...addConfig, instruction: e.target.value })} placeholder="What photo to take..." rows={2} style={ta as any} /></div>
                                )}

                                {/* ── TIMED PHOTO ── */}
                                {addMech === 'timed_photo' && (<>
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={addConfig.instruction || ''} onChange={e => setAddConfig({ ...addConfig, instruction: e.target.value })} placeholder="What photo to submit..." rows={2} style={ta as any} /></div>
                                    <div><div style={lbl}>REFERENCE IMAGE (optional)</div><input value={addConfig.referenceImg || ''} onChange={e => setAddConfig({ ...addConfig, referenceImg: e.target.value })} placeholder="URL or leave empty" style={inp} /></div>
                                </>)}

                                {/* ── AMBUSH SNAP ── */}
                                {addMech === 'ambush_snap' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>NUMBER OF SNAPS</span><input type="number" value={addConfig.target || 3} onChange={e => setAddConfig({ ...addConfig, target: +e.target.value })} style={{ ...inp, width: 70 }} /></div>
                                )}

                                {/* ── ENDURANCE TIMER ── */}
                                {addMech === 'endurance' && (<>
                                    <div><div style={lbl}>INSTRUCTION</div><textarea value={addConfig.instruction || ''} onChange={e => setAddConfig({ ...addConfig, instruction: e.target.value })} placeholder="What to endure..." rows={2} style={ta as any} /></div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>DURATION (SEC)</span><input type="number" value={addConfig.duration || 60} onChange={e => setAddConfig({ ...addConfig, duration: +e.target.value, target: +e.target.value })} style={{ ...inp, width: 80 }} /></div>
                                    <div style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM }}>Camera opens + timer runs simultaneously</div>
                                </>)}

                                {/* ── GREED GAME ── */}
                                {addMech === 'greed_game' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>MAX CEILING</span><input type="number" value={addConfig.ceiling || 50} onChange={e => setAddConfig({ ...addConfig, ceiling: +e.target.value })} style={{ ...inp, width: 80 }} /></div>
                                )}

                                {/* ── TRUTH OR DARE ── */}
                                {addMech === 'truth_dare' && (<>
                                    {(['truth', 'dare'] as const).map(side => {
                                        const textKey = side === 'truth' ? 'truthText' : 'dareText';
                                        const fuKey   = side === 'truth' ? 'truthFollowUp' : 'dareFollowUp';
                                        const cur     = addConfig[fuKey] || (side === 'truth' ? 'writing' : 'endurance');
                                        const ph      = side === 'truth' ? 'Confession prompt...' : 'Physical challenge...';
                                        const allTypes = [
                                            { value: 'photo', label: 'PHOTO' }, { value: 'video', label: 'VIDEO' },
                                            { value: 'writing', label: 'WRITING' }, { value: 'add_day', label: '+DAY' },
                                            { value: 'remove_day', label: '−DAY' }, { value: 'add_coins', label: '+COINS' },
                                            { value: 'remove_coins', label: '−COINS' }, { value: 'instant', label: 'NONE' },
                                        ];
                                        return (
                                            <div key={side} style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                                                <div style={lbl}>{side.toUpperCase()}</div>
                                                <input value={addConfig[textKey] || ''} onChange={e => setAddConfig({ ...addConfig, [textKey]: e.target.value })} placeholder={ph} style={{ ...inp, marginBottom: 10 }} />
                                                <div style={lbl}>FOLLOW-UP</div>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                                    {allTypes.map(t => {
                                                        const active = cur === t.value;
                                                        return <button key={t.value} onClick={() => setAddConfig({ ...addConfig, [fuKey]: t.value })} style={{ padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontFamily: F, fontSize: '.35rem', letterSpacing: '1.5px', border: `1px solid ${active ? `rgba(${rgb},.5)` : 'rgba(255,255,255,.08)'}`, background: active ? `rgba(${rgb},.1)` : 'transparent', color: active ? `rgba(${rgb},.9)` : 'rgba(255,255,255,.3)', transition: 'all .12s' }}>{t.label}</button>;
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>)}

                                {/* ── SIMON SAYS ── */}
                                {addMech === 'simon_says' && (<>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                                        <span style={{ ...lbl, margin: 0 }}>INTERVAL BETWEEN TASKS</span>
                                        <input type="number" value={addConfig.intervalMinutes || 60} onChange={e => setAddConfig({ ...addConfig, intervalMinutes: +e.target.value })} style={{ ...inp, width: 60, padding: '6px 8px', fontSize: '.55rem' }} />
                                        <span style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM }}>min</span>
                                    </div>
                                    <div style={lbl}>RANDOM TASKS</div>
                                    {(addConfig.chainTasks || [{ text: '', timeLimit: 60, proofType: 'video' }]).map((t: any, i: number) => (
                                        <div key={i} style={{ marginBottom: 8 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ fontFamily: F, fontSize: '.6rem', color: TEXT_DIM, width: 18 }}>{i + 1}</span>
                                                <input value={t.text} onChange={e => { const n = [...(addConfig.chainTasks || [{ text: '', timeLimit: 60, proofType: 'video' }])]; n[i] = { ...n[i], text: e.target.value }; setAddConfig({ ...addConfig, chainTasks: n }); }} placeholder="Task..." style={{ ...inp, flex: 1, padding: '8px 12px', fontSize: '.6rem' }} />
                                                <input type="number" value={t.timeLimit} onChange={e => { const n = [...addConfig.chainTasks]; n[i] = { ...n[i], timeLimit: +e.target.value }; setAddConfig({ ...addConfig, chainTasks: n }); }} style={{ ...inp, width: 55, padding: '8px', fontSize: '.55rem' }} />
                                                <span style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM }}>s</span>
                                                {(addConfig.chainTasks || []).length > 1 && <button onClick={() => { const n = [...addConfig.chainTasks]; n.splice(i, 1); setAddConfig({ ...addConfig, chainTasks: n }); }} style={{ background: 'none', border: 'none', color: 'rgba(255,60,60,.4)', cursor: 'pointer', fontSize: '.9rem' }}>{'\u00D7'}</button>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, paddingLeft: 26 }}>
                                                {(['photo', 'video'] as const).map(pt => (
                                                    <button key={pt} onClick={() => { const n = [...(addConfig.chainTasks || [])]; n[i] = { ...n[i], proofType: pt }; setAddConfig({ ...addConfig, chainTasks: n }); }}
                                                        style={{ fontFamily: F, fontSize: '.38rem', letterSpacing: 2, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${(t.proofType || 'video') === pt ? 'rgba(197,160,89,.5)' : 'rgba(255,255,255,.08)'}`, background: (t.proofType || 'video') === pt ? 'rgba(197,160,89,.1)' : 'transparent', color: (t.proofType || 'video') === pt ? GOLD : TEXT_DIM }}>
                                                        {pt.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setAddConfig({ ...addConfig, chainTasks: [...(addConfig.chainTasks || [{ text: '', timeLimit: 60, proofType: 'video' }]), { text: '', timeLimit: 60, proofType: 'video' }] })} style={addBtn}>+ ADD TASK</button>
                                </>)}

                                {/* ── PAYMENT ── */}
                                {addMech === 'payment' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={lbl}>COIN AMOUNT</span><input type="number" value={addConfig.amount || 10} onChange={e => setAddConfig({ ...addConfig, amount: +e.target.value, target: +e.target.value })} style={{ ...inp, width: 80 }} /></div>
                                )}

                                {/* Back to presets link */}
                                {(MECH_PRESETS[addMech] || []).length > 0 && (
                                    <button onClick={() => setAddConfig({ label: mech.name, target: 1 })} style={{ background: 'none', border: 'none', color: TEXT_DIM, fontFamily: F, fontSize: '.38rem', letterSpacing: 2, cursor: 'pointer', padding: '8px 0', textAlign: 'left' }}>
                                        {'\u2190'} BACK TO PRESETS
                                    </button>
                                )}
                            </div>}

                            {(addConfig._customMode || !(MECH_PRESETS[addMech] || []).length) && (
                                <button onClick={confirmAdd} className="kbtn" style={{
                                    marginTop: 20, width: '100%', padding: '14px', fontFamily: FC, fontSize: '.5rem', letterSpacing: 4,
                                    color: GOLD, background: 'rgba(197,160,89,.08)', border: `1px solid rgba(197,160,89,.25)`, borderRadius: 10, cursor: 'pointer',
                                }}>ADD TO DAY {dayNum}</button>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

/* ═══════════════ CONFIG VIEW ═══════════════ */
function ConfigView({ configData, setConfigData, configSection, setConfigSection, onSave, saving }: any) {
    const section = CONFIG_SECTIONS.find(s => s.key===configSection)!;
    const data = configData[configSection] || [];
    const update = (idx: number, field: string, val: any) => { const n=[...data]; if(field==='_s') n[idx]=val; else n[idx]={...n[idx],[field]:val}; setConfigData({...configData,[configSection]:n}); };
    const add = () => { const n=[...data]; if(configSection==='spin_wheel') n.push({label:'New option',effect:'nothing',value:0,weight:1}); else if(configSection==='card_deck') n.push({title:'New card',description:'',category:'control'}); else if(configSection==='lines_texts') n.push('New line'); else if(configSection==='body_writing') n.push('WORD'); else if(configSection==='quiz_questions') n.push({question:'',answer:''}); else if(configSection==='exercises') n.push({type:'pushups',count:20}); setConfigData({...configData,[configSection]:n}); };
    const rem = (idx: number) => { const n=[...data]; n.splice(idx,1); setConfigData({...configData,[configSection]:n}); };

    const inp: React.CSSProperties = { background: 'rgba(255,255,255,.06)', border: `1px solid rgba(197,160,89,.18)`, borderRadius: 8, padding: '12px 16px', color: 'rgba(255,255,255,.9)', fontFamily: F, fontSize: '.72rem', outline: 'none', width: '100%' };
    const num: React.CSSProperties = { ...inp, width: 70, textAlign: 'center' as const, fontSize: '.85rem', color: GOLD, fontWeight: 700 };

    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: 220, borderRight: `1px solid rgba(197,160,89,.18)`, overflowY: 'auto', padding: '20px 0' }} className="kscr">
                {CONFIG_SECTIONS.map(s => (
                    <div key={s.key} onClick={() => setConfigSection(s.key)} style={{ padding: '16px 24px', cursor: 'pointer', borderLeft: `3px solid ${configSection===s.key ? GOLD : 'transparent'}`, background: configSection===s.key ? 'rgba(197,160,89,.08)' : 'transparent', transition: 'all .2s' }}>
                        <div style={{ fontFamily: FC, fontSize: '.45rem', color: configSection===s.key ? GOLD : TEXT, letterSpacing: 3 }}>{s.title}</div>
                        <div style={{ fontFamily: F, fontSize: '.36rem', color: TEXT_DIM, marginTop: 3 }}>{s.desc}</div>
                    </div>
                ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }} className="kscr">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <div style={{ fontFamily: FC, fontSize: '.6rem', color: GOLD, letterSpacing: 5 }}>{section?.title}</div>
                        <div style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM, marginTop: 3 }}>{section?.desc} {'\u00B7'} {data.length} items</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={add} className="kbtn" style={{ padding: '9px 20px', borderRadius: 6, border: `1px solid rgba(197,160,89,.2)`, background: SURFACE, color: TEXT, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3 }}>+ ADD</button>
                        <button onClick={() => onSave(configSection,data)} className="kbtn" style={{ padding: '9px 20px', borderRadius: 6, border: `1px solid rgba(197,160,89,.3)`, background: 'rgba(197,160,89,.1)', color: GOLD, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3 }}>{saving?'SAVING...':'SAVE'}</button>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.map((item: any, idx: number) => {
                        const cardStyle: React.CSSProperties = { padding: '16px 20px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(22,20,30,.95), rgba(14,12,20,.98))', border: `1px solid rgba(197,160,89,.15)` };
                        if (configSection==='lines_texts' || configSection==='body_writing') {
                            return (<div key={idx} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
                                <span style={{ fontFamily: FC, fontSize: '.45rem', color: TEXT_DIM, width: 22 }}>{idx+1}</span>
                                <input value={item} onChange={e=>update(idx,'_s',e.target.value)} style={{ ...inp, flex: 1 }} />
                                <button onClick={()=>rem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '.9rem' }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.7)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>
                            </div>);
                        }
                        if (configSection==='spin_wheel') {
                            return (<div key={idx} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input value={item.label||''} onChange={e=>update(idx,'label',e.target.value)} style={{ ...inp, flex: 1 }} />
                                <input value={item.effect||''} onChange={e=>update(idx,'effect',e.target.value)} style={{ ...inp, width: 100, fontSize: '.55rem' }} />
                                <div style={{ textAlign: 'center' }}><div style={{ fontFamily: F, fontSize: '.28rem', color: TEXT_DIM, letterSpacing: 1, marginBottom: 2 }}>VAL</div><input type="number" value={item.value??0} onChange={e=>update(idx,'value',parseInt(e.target.value)||0)} style={num} /></div>
                                <div style={{ textAlign: 'center' }}><div style={{ fontFamily: F, fontSize: '.28rem', color: TEXT_DIM, letterSpacing: 1, marginBottom: 2 }}>WT</div><input type="number" value={item.weight??1} onChange={e=>update(idx,'weight',parseInt(e.target.value)||1)} style={num} /></div>
                                <button onClick={()=>rem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '.9rem' }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.7)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>
                            </div>);
                        }
                        if (configSection==='card_deck') {
                            return (<div key={idx} style={cardStyle}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                                    <input value={item.title||''} onChange={e=>update(idx,'title',e.target.value)} style={{ ...inp, flex: 1, fontFamily: FC, fontSize: '.6rem', letterSpacing: 1 }} />
                                    <input value={item.category||''} onChange={e=>update(idx,'category',e.target.value)} style={{ ...inp, width: 100, fontSize: '.5rem' }} />
                                    <button onClick={()=>rem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '.9rem' }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.7)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>
                                </div>
                                <textarea value={item.description||''} onChange={e=>update(idx,'description',e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontSize: '.55rem', lineHeight: 1.6 }} />
                            </div>);
                        }
                        if (configSection==='quiz_questions') {
                            return (<div key={idx} style={{ ...cardStyle, display: 'flex', gap: 10, alignItems: 'center' }}>
                                <input value={item.question||''} onChange={e=>update(idx,'question',e.target.value)} placeholder="Question" style={{ ...inp, flex: 2 }} />
                                <input value={item.answer||''} onChange={e=>update(idx,'answer',e.target.value)} placeholder="Answer" style={{ ...inp, flex: 1 }} />
                                <button onClick={()=>rem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '.9rem' }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.7)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>
                            </div>);
                        }
                        if (configSection==='exercises') {
                            return (<div key={idx} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input value={item.type||''} onChange={e=>update(idx,'type',e.target.value)} style={{ ...inp, flex: 1 }} />
                                <div style={{ textAlign: 'center' }}><div style={{ fontFamily: F, fontSize: '.28rem', color: TEXT_DIM, letterSpacing: 1, marginBottom: 2 }}>COUNT</div><input type="number" value={item.count??10} onChange={e=>update(idx,'count',parseInt(e.target.value)||1)} style={num} /></div>
                                <button onClick={()=>rem(idx)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '.9rem' }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.7)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>
                            </div>);
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════ MEMBER VIEW ═══════════════ */
function MemberView({ email, setEmail, program, sel, setSel, info, locked, onLoad, onGenerate, updateTask, addTask, removeTask, moveTask, saveMemberDay, saving, loading, dragIdx, setDragIdx, configData, setView, setConfigSection, memberAbout, showMemberProfile, setShowMemberProfile }: any) {
    const [extendDays, setExtendDays] = useState(1);
    const [extendingLock, setExtendingLock] = useState(false);
    const addLockDays = async () => {
        if (!email || extendDays < 1) return;
        setExtendingLock(true);
        try {
            await fetch('/api/vault/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_lock_days', memberId: email, days: extendDays }),
            });
            await onLoad(email);
        } catch {}
        setExtendingLock(false);
    };
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!email ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }} className="kscr">
                    <div style={{ fontFamily: FC, fontSize: '.55rem', color: GOLD, letterSpacing: 5, marginBottom: 24 }}>SELECT MEMBER</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
                        {locked.map((m: any, i: number) => (
                            <div key={m.memberId} className="kmc kfade" onClick={() => { setEmail(m.memberId); setTimeout(()=>onLoad(m.memberId),80); }} style={{
                                borderRadius: 14, overflow: 'hidden', position: 'relative', height: 130,
                                border: `1px solid rgba(197,160,89,.15)`, animationDelay: `${i*.05}s`,
                            }}>
                                {/* Photo background — matching sub list pattern */}
                                {m.avatar ? (
                                    <img src={m.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, pointerEvents: 'none' }} />
                                ) : (
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(139,0,0,.2), rgba(20,16,28,.9))' }} />
                                )}
                                <div style={{ position: 'relative', zIndex: 1, padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontFamily: FC, fontSize: '.7rem', color: 'rgba(255,255,255,.95)', letterSpacing: 3 }}>{m.name}</div>
                                        <div style={{ fontFamily: F, fontSize: '.42rem', color: GOLD, marginTop: 4, letterSpacing: 2 }}>Day {m.daysIn} / {m.lockDays}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ flex: 1, height: 3, background: 'rgba(197,160,89,.15)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${m.lockDays?(m.daysIn/m.lockDays)*100:0}%`, height: '100%', background: `linear-gradient(90deg, ${GOLD}, rgba(139,0,0,.6))` }} />
                                        </div>
                                        <span style={{ fontFamily: F, fontSize: '.42rem', color: m.todayPerfect ? GOLD : TEXT_DIM }}>{m.todayPerfect ? '\u2726 PERFECT' : `${m.todayDone}/${m.todayTotal}`}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {locked.length===0 && <div style={{ textAlign: 'center', padding: 80, color: TEXT_DIM, fontFamily: F, fontSize: '.5rem', letterSpacing: 2 }}>No locked members</div>}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    <div style={{ width: sel?'32%':'100%', transition: 'width .4s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(10,10,16,0.5)' }}>
                        <div style={{ padding: '14px 24px', borderBottom: `1px solid rgba(197,160,89,.18)`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: 'rgba(10,10,16,0.6)' }}>
                            <button onClick={() => { setEmail(''); setSel(null); }} style={{ background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontSize: '1rem' }}>{'\u2190'}</button>
                            {info?.avatar && <img src={info.avatar} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: `1px solid rgba(197,160,89,.2)` }} />}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: FC, fontSize: '.6rem', color: 'rgba(255,255,255,.92)', letterSpacing: 3 }}>{info?.name || email.split('@')[0]}</div>
                                <div style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 1 }}>Day {info?.daysIn||'?'} of {info?.lockDays||'?'}</div>
                            </div>
                            {loading ? (
                                <div style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM, letterSpacing: 3, padding: '9px 22px' }}>LOADING...</div>
                            ) : !program ? (
                                <button onClick={onGenerate} className="kbtn" style={{ padding: '9px 22px', borderRadius: 6, border: `1px solid rgba(139,0,0,.3)`, background: RED_DIM, color: RED, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3 }}>{saving?'REGENERATING...':'REGENERATE'}</button>
                            ) : (
                                <button onClick={() => { if(sel) saveMemberDay(sel,program[String(sel)]||[]); }} className="kbtn" style={{ padding: '9px 22px', borderRadius: 6, border: `1px solid rgba(197,160,89,.3)`, background: 'rgba(197,160,89,.1)', color: GOLD, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3, opacity: sel?1:.3 }}>{saving?'SAVING...':'SAVE DAY'}</button>
                            )}
                        </div>
                        {/* ── EXTEND LOCK ── */}
                        {email && program && (
                            <div style={{ padding: '8px 24px', borderBottom: '1px solid rgba(197,160,89,.1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'rgba(10,10,16,0.4)' }}>
                                <span style={{ fontFamily: FC, fontSize: '.32rem', color: GOLD_DIM, letterSpacing: 3, flexShrink: 0 }}>EXTEND LOCK</span>
                                <button onClick={() => setExtendDays(d => Math.max(1, d - 1))} style={{ background: 'none', border: '1px solid rgba(197,160,89,.2)', color: GOLD, fontFamily: FC, fontSize: '.45rem', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', lineHeight: 1, padding: 0 }}>−</button>
                                <span style={{ fontFamily: FC, fontSize: '.45rem', color: 'rgba(255,255,255,.85)', minWidth: 24, textAlign: 'center' }}>{extendDays}</span>
                                <button onClick={() => setExtendDays(d => d + 1)} style={{ background: 'none', border: '1px solid rgba(197,160,89,.2)', color: GOLD, fontFamily: FC, fontSize: '.45rem', width: 24, height: 24, borderRadius: 4, cursor: 'pointer', lineHeight: 1, padding: 0 }}>+</button>
                                <span style={{ fontFamily: F, fontSize: '.36rem', color: 'rgba(255,255,255,.4)', flexShrink: 0 }}>day{extendDays !== 1 ? 's' : ''}</span>
                                <button onClick={addLockDays} disabled={extendingLock} className="kbtn" style={{ marginLeft: 'auto', padding: '5px 16px', borderRadius: 5, border: '1px solid rgba(197,160,89,.35)', background: 'rgba(197,160,89,.08)', color: GOLD, fontFamily: FC, fontSize: '.35rem', letterSpacing: 2, opacity: extendingLock ? 0.5 : 1 }}>{extendingLock ? '...' : '+ ADD'}</button>
                            </div>
                        )}
                        {/* ── MEMBER KINKS / LIMITS / ABOUT ── */}
                        {info && (info.kinks || info.limits || memberAbout) && (
                            <div style={{ flexShrink: 0, borderBottom: '1px solid rgba(197,160,89,.12)', background: 'rgba(10,10,16,0.4)' }}>
                                <button onClick={() => setShowMemberProfile(!showMemberProfile)} style={{ width: '100%', padding: '8px 24px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: FC, fontSize: '.35rem', color: GOLD, letterSpacing: 4 }}>MEMBER PROFILE</span>
                                    <span style={{ fontFamily: F, fontSize: '.5rem', color: TEXT_DIM, transform: showMemberProfile ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{'\u25BE'}</span>
                                </button>
                                {showMemberProfile && (
                                    <div style={{ padding: '0 24px 14px' }}>
                                        {info.kinks && (
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontFamily: FC, fontSize: '.32rem', color: GOLD, letterSpacing: 3, marginBottom: 6, opacity: .6 }}>KINKS</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                                    {info.kinks.split(',').map((k: string) => k.trim()).filter(Boolean).map((k: string) => (
                                                        <span key={k} style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(197,160,89,.25)', background: 'rgba(197,160,89,.06)', fontFamily: F, fontSize: '.4rem', color: GOLD, letterSpacing: 1 }}>{k}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {info.limits && (
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontFamily: FC, fontSize: '.32rem', color: RED, letterSpacing: 3, marginBottom: 6, opacity: .6 }}>LIMITS</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                                    {info.limits.split(',').map((k: string) => k.trim()).filter(Boolean).map((k: string) => (
                                                        <span key={k} style={{ padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(139,0,0,.3)', background: 'rgba(139,0,0,.06)', fontFamily: F, fontSize: '.4rem', color: 'rgba(200,60,60,.8)', letterSpacing: 1 }}>{k}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {memberAbout && (
                                            <div>
                                                <div style={{ fontFamily: FC, fontSize: '.32rem', color: TEXT_DIM, letterSpacing: 3, marginBottom: 6 }}>ABOUT THEM</div>
                                                <div style={{ fontFamily: F, fontSize: '.42rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7, padding: '10px 14px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{memberAbout}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {program ? (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }} className="kscr">
                                {(() => {
                                    const totalDays = Math.max(info?.lockDays || 30, ...Object.keys(program).map(Number).filter(n => !isNaN(n)));
                                    const CYCLE_PHASES = [
                                        { name: 'OBEDIENCE', color: GOLD },
                                        { name: 'DISCIPLINE', color: '#8b0000' },
                                        { name: 'ENDURANCE', color: '#9b59b6' },
                                        { name: 'DEVOTION', color: GOLD },
                                    ];
                                    const phases: { name: string; color: string; days: number[] }[] = [];
                                    for (let d = 1; d <= totalDays; d += 7) {
                                        const cycleIdx = Math.floor((d - 1) / 7) % CYCLE_PHASES.length;
                                        const base = CYCLE_PHASES[cycleIdx];
                                        const week = Math.floor((d - 1) / 7) + 1;
                                        const days = [];
                                        for (let i = d; i < d + 7 && i <= totalDays; i++) days.push(i);
                                        phases.push({ name: week <= 4 ? base.name : `${base.name} ${Math.ceil(week / 4)}`, color: base.color, days });
                                    }
                                    return phases.map(phase => (
                                        <div key={phase.name + phase.days[0]} style={{ marginBottom: 22 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                <div style={{ width: 3, height: 16, borderRadius: 2, background: phase.color, opacity: .7 }} />
                                                <span style={{ fontFamily: FC, fontSize: '.4rem', color: phase.color, letterSpacing: 5 }}>{phase.name}</span>
                                                <span style={{ fontFamily: F, fontSize: '.32rem', color: TEXT_DIM, letterSpacing: 1 }}>DAY {phase.days[0]}-{phase.days[phase.days.length-1]}</span>
                                                <div style={{ flex: 1, height: 1, background: 'rgba(197,160,89,.12)' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: sel?'1fr 1fr':'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                                                {phase.days.map(d => {
                                                    const tasks = program[String(d)]||[];
                                                    const isA = sel===d;
                                                    const isC = info?.daysIn===d;
                                                    const isEmpty = tasks.length === 0;
                                                    return (<div key={d} className="kdc" onClick={() => setSel(isA?null:d)} style={{
                                                        borderRadius: 8, padding: '10px 12px',
                                                        border: `1px solid ${isA?'rgba(197,160,89,.35)':isC?'rgba(139,0,0,.3)':isEmpty?'rgba(255,255,255,.06)':'rgba(197,160,89,.12)'}`,
                                                        background: isA?'rgba(197,160,89,.1)':isC?'rgba(139,0,0,.08)':'rgba(22,20,30,.95)',
                                                        opacity: isEmpty && !isA ? .5 : 1,
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontFamily: FC, fontSize: '.7rem', color: isA?GOLD:isC?RED:'rgba(255,255,255,.55)' }}>{d}</span>
                                                            {isC && <span style={{ fontFamily: F, fontSize: '.28rem', color: RED, letterSpacing: 2 }}>TODAY</span>}
                                                            <span style={{ fontFamily: F, fontSize: '.35rem', color: isEmpty?'rgba(255,255,255,.2)':TEXT_DIM }}>{isEmpty?'EMPTY':tasks.length+1}</span>
                                                        </div>
                                                    </div>);
                                                })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontFamily: FC, fontSize: '1.2rem', color: 'rgba(255,255,255,.15)', marginBottom: 14 }}>{'\u26D3'}</div>
                                    <div style={{ fontFamily: F, fontSize: '.5rem', color: TEXT_DIM, letterSpacing: 3 }}>{loading?'LOADING...':'NO PROGRAM'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                    {sel && program && <TaskPanel dayNum={sel} tasks={program[String(sel)]||[]} onClose={() => setSel(null)} updateTask={(i:number,f:string,v:any)=>updateTask(sel,i,f,v)} addTask={(t:string,l?:string,tgt?:number,cfg?:any)=>addTask(sel,t,l,tgt,cfg)} removeTask={(i:number)=>removeTask(sel,i)} moveTask={(a:number,b:number)=>moveTask(sel,a,b)} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
                </div>
            )}
        </div>
    );
}

/* ── Helper: hex color to rgb values string ── */
function _hexToRgb(hex: string): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return '150,150,150';
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `${r},${g},${b}`;
}
