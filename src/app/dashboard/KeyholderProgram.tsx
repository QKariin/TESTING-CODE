'use client';

import { useState, useEffect, useRef } from 'react';

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

/* ── TASK TYPES — no emojis, elegant symbols only ── */
const TASK_META: Record<string, { label: string; icon: string; color: string; configKey?: string }> = {
    kneel:          { label: 'KNEEL',        icon: '\u25C7', color: '#c5a059' },
    chastity_check: { label: 'CHASTITY',     icon: '\u25C8', color: '#8b0000' },
    spin:           { label: 'SPIN WHEEL',   icon: '\u25CE', color: '#9b59b6', configKey: 'spin_wheel' },
    card:           { label: 'TASK CARD',    icon: '\u2660', color: '#2ecc71', configKey: 'card_deck' },
    tribute:        { label: 'TRIBUTE',      icon: '\u25C6', color: '#c5a059' },
    journal:        { label: 'JOURNAL',      icon: '\u270E', color: '#3498db' },
    worship:        { label: 'WORSHIP',      icon: '\u2661', color: '#e74c3c' },
    lines:          { label: 'WRITE LINES',  icon: '\u2261', color: '#1abc9c', configKey: 'lines_texts' },
    edge:           { label: 'EDGE',         icon: '\u2736', color: '#e91e63' },
    denial:         { label: 'DENIAL',       icon: '\u2718', color: '#c0392b' },
    confession:     { label: 'CONFESSION',   icon: '\u2767', color: '#8e44ad' },
    cold_shower:    { label: 'COLD SHOWER',  icon: '\u2744', color: '#00bcd4' },
    exercise:       { label: 'EXERCISE',     icon: '\u2191', color: '#4caf50', configKey: 'exercises' },
    corner_time:    { label: 'CORNER TIME',  icon: '\u25A2', color: '#607d8b' },
    body_writing:   { label: 'BODY WRITING', icon: '\u270D', color: '#ff5722', configKey: 'body_writing' },
    gratitude:      { label: 'GRATITUDE',    icon: '\u2605', color: '#ffc107' },
    quiz:           { label: 'QUIZ',         icon: '\u2753', color: '#00bcd4', configKey: 'quiz_questions' },
    essay:          { label: 'ESSAY',        icon: '\u2016', color: '#795548' },
    trial:          { label: 'TRIAL',        icon: '\u2694', color: '#9c27b0' },
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
function _kt(d: number): number {
    if (d<=3) return 4; if (d<=6) return 6; if (d<=11) return 8; if (d<=14) return 10;
    if (d<=19) return 12; if (d<=24) return 14; if (d<=27) return 16; if (d<=29) return 18; return 20;
}
function _ddt(d: number): Task[] {
    const t: Task[] = [{ type: 'kneel', target: _kt(d), label: `Kneel ${_kt(d)} times` }];
    if(d===1) t.push({type:'journal',target:1,label:'Journal: "Why I submitted"'});
    if(d===2) t.push({type:'spin',target:1,label:'Spin the wheel'});
    if(d===3) t.push({type:'lines',target:30,label:'Write lines x30'});
    if(d===4) t.push({type:'tribute',target:3,label:'Tribute 3 coins'});
    if(d===5) t.push({type:'worship',target:1,label:'Worship message'});
    if(d===6) t.push({type:'card',target:1,label:'Draw a task card'});
    if(d===7){t.push({type:'cold_shower',target:60,label:'Cold shower 60s'});t.push({type:'confession',target:1,label:'Weekly confession'});}
    if(d===8){t.push({type:'edge',target:3,label:'Edge 3 times'});t.push({type:'journal',target:1,label:'Journal entry'});}
    if(d===9){t.push({type:'spin',target:1,label:'Spin the wheel'});t.push({type:'tribute',target:5,label:'Tribute 5 coins'});}
    if(d===10){t.push({type:'lines',target:50,label:'Write lines x50'});t.push({type:'corner_time',target:10,label:'Corner time 10min'});}
    if(d===11) t.push({type:'body_writing',target:1,label:'Body writing: OWNED'});
    if(d===12){t.push({type:'card',target:1,label:'Draw a task card'});t.push({type:'worship',target:1,label:'Worship message'});}
    if(d===13){t.push({type:'edge',target:5,label:'Edge 5 times'});t.push({type:'gratitude',target:5,label:'Gratitude list (5)'});}
    if(d===14){t.push({type:'tribute',target:10,label:'Tribute 10 coins'});t.push({type:'confession',target:1,label:'Confession'});}
    if(d===15){t.push({type:'exercise',target:50,label:'50 pushups'});t.push({type:'spin',target:1,label:'Spin the wheel'});}
    if(d===16){t.push({type:'edge',target:5,label:'Edge 5 times'});t.push({type:'lines',target:75,label:'Write lines x75'});}
    if(d===17){t.push({type:'quiz',target:1,label:"Quiz: Queen's rules"});t.push({type:'journal',target:1,label:'Journal entry'});}
    if(d===18){t.push({type:'tribute',target:10,label:'Tribute 10 coins'});t.push({type:'corner_time',target:15,label:'Corner time 15min'});}
    if(d===19){t.push({type:'body_writing',target:1,label:'Body writing photo'});t.push({type:'card',target:1,label:'Draw a task card'});}
    if(d===20){t.push({type:'cold_shower',target:90,label:'Cold shower 90s'});t.push({type:'worship',target:1,label:'Worship message'});t.push({type:'edge',target:5,label:'Edge 5x'});}
    if(d===21){t.push({type:'denial',target:1,label:'Denial day (24h)'});t.push({type:'confession',target:1,label:'Confession'});}
    if(d===22){t.push({type:'tribute',target:15,label:'Tribute 15 coins'});t.push({type:'gratitude',target:10,label:'Gratitude (10)'});}
    if(d===23){t.push({type:'edge',target:7,label:'Edge 7 times'});t.push({type:'spin',target:1,label:'Spin the wheel'});t.push({type:'lines',target:100,label:'Lines x100'});}
    if(d===24){t.push({type:'exercise',target:75,label:'75 pushups'});t.push({type:'body_writing',target:1,label:'Body writing'});t.push({type:'journal',target:1,label:'Journal'});}
    if(d===25){t.push({type:'card',target:1,label:'Task card'});t.push({type:'corner_time',target:20,label:'Corner 20min'});t.push({type:'worship',target:1,label:'Worship'});}
    if(d===26){t.push({type:'cold_shower',target:120,label:'Cold shower 120s'});t.push({type:'edge',target:7,label:'Edge 7x'});t.push({type:'tribute',target:10,label:'Tribute 10'});}
    if(d===27){t.push({type:'denial',target:1,label:'Denial day'});t.push({type:'essay',target:1,label:'Essay: "What I learned"'});}
    if(d===28){t.push({type:'quiz',target:1,label:'Quiz'});t.push({type:'confession',target:1,label:'Confession'});t.push({type:'spin',target:1,label:'Spin'});t.push({type:'lines',target:100,label:'Lines x100'});}
    if(d===29){t.push({type:'edge',target:10,label:'Edge 10x'});t.push({type:'tribute',target:20,label:'Tribute 20'});t.push({type:'exercise',target:100,label:'100 pushups'});}
    if(d===30){t.push({type:'journal',target:1,label:'Final devotion'});t.push({type:'worship',target:1,label:'Worship'});t.push({type:'gratitude',target:10,label:'Gratitude (10)'});t.push({type:'body_writing',target:1,label:'Body writing'});t.push({type:'tribute',target:25,label:'Tribute 25'});}
    return t;
}
function _genDefaults(): Record<string,Task[]> { const d: Record<string,Task[]>={}; for(let i=1;i<=30;i++) d[String(i)]=_ddt(i); return d; }

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
`;

/* ═══════════════ MAIN ═══════════════ */
export function KeyholderProgramContent({ onClose, initialMember }: { onClose: () => void; initialMember?: string }) {
    const [view, setView] = useState<ViewMode>(initialMember ? 'member' : 'program');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [templateDays, setTemplateDays] = useState<Record<string,Task[]>>(_genDefaults());
    const [selectedDay, setSelectedDay] = useState<number|null>(null);
    const [lockedMembers, setLockedMembers] = useState<any[]>([]);
    const [configSection, setConfigSection] = useState('spin_wheel');
    const [configData, setConfigData] = useState<Record<string,any>>({});
    const [memberEmail, setMemberEmail] = useState(initialMember || '');
    const [memberProgram, setMemberProgram] = useState<Record<string,Task[]>|null>(null);
    const [memberSelectedDay, setMemberSelectedDay] = useState<number|null>(null);
    const [memberInfo, setMemberInfo] = useState<any>(null);
    const [dragIdx, setDragIdx] = useState<number|null>(null);

    useEffect(() => { loadTemplate(); loadConfig(); loadLockedMembers(); if(initialMember) setTimeout(()=>loadMemberProgram(),150); }, []);

    const loadLockedMembers = async () => { try { const r = await fetch('/api/vault/program?listLocked=true'); const j = await r.json(); if(j.locked) setLockedMembers(j.locked); } catch{} };
    const loadTemplate = async () => { try { const r = await fetch('/api/vault/program?template=true'); const j = await r.json(); if(j.template?.length>0){ const d: Record<string,Task[]>={}; for(const row of j.template){ d[String(row.day_number)]=typeof row.tasks==='string'?JSON.parse(row.tasks):row.tasks; } setTemplateDays(d); } } catch{} };
    const loadConfig = async () => { try { const r = await fetch('/api/vault/program?config=true'); const j = await r.json(); if(j.config){ const m: Record<string,any>={}; for(const row of j.config){ m[row.key]=typeof row.value==='string'?JSON.parse(row.value):row.value; } setConfigData(m); } } catch{} };
    const loadMemberProgram = async () => { if(!memberEmail) return; setLoading(true); try { const r = await fetch(`/api/vault/program?memberId=${encodeURIComponent(memberEmail)}`); const j = await r.json(); if(j.program?.program){setMemberProgram(typeof j.program.program==='string'?JSON.parse(j.program.program):j.program.program);}else{setMemberProgram(null);} setMemberInfo(lockedMembers.find((m:any)=>m.memberId.toLowerCase()===memberEmail.toLowerCase())||null); } catch{} setLoading(false); };
    const generateMemberProgram = async () => { if(!memberEmail) return; setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'generate_program',memberId:memberEmail})}); await loadMemberProgram(); } catch{} setSaving(false); };
    const saveTemplate = async () => { setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_template',days:templateDays})}); } catch{} setSaving(false); };
    const saveConfig = async (key: string, value: any) => { setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save_config',key,value})}); } catch{} setSaving(false); };
    const saveMemberDay = async (dayNum: number, tasks: Task[]) => { if(!memberEmail) return; setSaving(true); try { await fetch('/api/vault/program',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update_day',memberId:memberEmail,dayNumber:dayNum,tasks})}); } catch{} setSaving(false); };

    const getDays = () => view==='member'&&memberProgram?memberProgram:templateDays;
    const setDays = (d: Record<string,Task[]>) => { if(view==='member') setMemberProgram(d); else setTemplateDays(d); };
    const getSel = () => view==='member'?memberSelectedDay:selectedDay;
    const setSel = (d: number|null) => { if(view==='member') setMemberSelectedDay(d); else setSelectedDay(d); };

    const updateTask = (dn: number,idx: number,field: string,val: any) => { const d={...getDays()}; const t=[...(d[String(dn)]||[])]; t[idx]={...t[idx],[field]:val}; d[String(dn)]=t; setDays(d); };
    const addTask = (dn: number,type: string) => { const meta=TASK_META[type]; const d={...getDays()}; const t=[...(d[String(dn)]||[])]; t.push({type,target:1,label:meta?.label||type}); d[String(dn)]=t; setDays(d); };
    const removeTask = (dn: number,idx: number) => { const d={...getDays()}; const t=[...(d[String(dn)]||[])]; t.splice(idx,1); d[String(dn)]=t; setDays(d); };
    const moveTask = (dn: number,from: number,to: number) => { if(from===to) return; const d={...getDays()}; const t=[...(d[String(dn)]||[])]; const[m]=t.splice(from,1); t.splice(to,0,m); d[String(dn)]=t; setDays(d); };

    const sel = getSel();

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: F }}>
            <style>{CSS}</style>

            {/* HEADER */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 28px', borderBottom: `1px solid rgba(197,160,89,.18)`, gap: 16, flexShrink: 0 }}>
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
                <div style={{ display: 'flex', gap: 16, padding: '16px 28px', overflowX: 'auto', borderBottom: `1px solid rgba(197,160,89,.18)`, flexShrink: 0 }} className="kscr">
                    {lockedMembers.map((m: any) => (
                        <div key={m.memberId} className="kmc"
                            onClick={() => { setMemberEmail(m.memberId); setView('member'); setTimeout(()=>loadMemberProgram(),80); }}
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
                                    <div style={{ fontFamily: F, fontSize: '.55rem', color: GOLD, fontWeight: 700, letterSpacing: 2, background: 'rgba(0,0,0,.5)', padding: '3px 10px', borderRadius: 4, border: `1px solid rgba(197,160,89,.25)` }}>
                                        DAY {m.daysIn}
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
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {view==='program' && <ProgramView days={templateDays} sel={selectedDay} setSel={setSelectedDay} updateTask={updateTask} addTask={addTask} removeTask={removeTask} moveTask={moveTask} saveTemplate={saveTemplate} saving={saving} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
                {view==='config' && <ConfigView configData={configData} setConfigData={setConfigData} configSection={configSection} setConfigSection={setConfigSection} onSave={saveConfig} saving={saving} />}
                {view==='member' && <MemberView email={memberEmail} setEmail={setMemberEmail} program={memberProgram} sel={memberSelectedDay} setSel={setMemberSelectedDay} info={memberInfo} locked={lockedMembers} onLoad={loadMemberProgram} onGenerate={generateMemberProgram} updateTask={updateTask} addTask={addTask} removeTask={removeTask} moveTask={moveTask} saveMemberDay={saveMemberDay} saving={saving} loading={loading} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
            </div>
        </div>
    );
}

/* ═══════════════ PROGRAM VIEW ═══════════════ */
function ProgramView({ days, sel, setSel, updateTask, addTask, removeTask, moveTask, saveTemplate, saving, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: sel ? '32%' : '100%', transition: 'width .4s ease', overflowY: 'auto', padding: '20px 28px' }} className="kscr">
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
            {sel && <TaskPanel dayNum={sel} tasks={days[String(sel)]||[]} onClose={() => setSel(null)} updateTask={(i:number,f:string,v:any) => updateTask(sel,i,f,v)} addTask={(t:string) => addTask(sel,t)} removeTask={(i:number) => removeTask(sel,i)} moveTask={(a:number,b:number) => moveTask(sel,a,b)} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
        </div>
    );
}

/* ═══════════════ TASK PANEL — luxury cards ═══════════════ */
function TaskPanel({ dayNum, tasks, onClose, updateTask, addTask, removeTask, moveTask, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    const phase = PHASES.find(p => p.days.includes(dayNum));
    const [addOpen, setAddOpen] = useState(false);

    return (
        <div className="kslide" style={{ width: '68%', borderLeft: `1px solid rgba(197,160,89,.18)`, display: 'flex', flexDirection: 'column', background: `linear-gradient(180deg, rgba(14,12,20,.99), ${BG})`, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '22px 32px 18px', borderBottom: `1px solid rgba(197,160,89,.18)`, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                        <span style={{ fontFamily: FC, fontSize: '1.8rem', color: 'rgba(255,255,255,.92)', lineHeight: 1 }}>Day {dayNum}</span>
                        <span style={{ fontFamily: FC, fontSize: '.45rem', color: phase?.color, letterSpacing: 5 }}>{phase?.name}</span>
                    </div>
                    <div style={{ fontFamily: F, fontSize: '.4rem', color: TEXT_DIM, letterSpacing: 2, marginTop: 4 }}>
                        {phase?.sub} phase {'\u00B7'} drag to reorder {'\u00B7'} {tasks.length + 1} tasks
                    </div>
                </div>
                <button onClick={onClose} className="kbtn" style={{ background: 'rgba(197,160,89,.08)', border: `1px solid rgba(197,160,89,.2)`, borderRadius: 6, padding: '8px 20px', color: TEXT_DIM, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3 }}>CLOSE</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }} className="kscr">
                {/* CHASTITY CHECK — constant */}
                <div style={{
                    borderRadius: 12, marginBottom: 16, overflow: 'hidden', position: 'relative',
                    border: '1px solid rgba(139,0,0,.3)',
                    background: 'linear-gradient(135deg, rgba(139,0,0,.12), rgba(15,12,20,.95))',
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, rgba(139,0,0,.5), transparent)' }} />
                    <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,0,0,.15)', border: '1px solid rgba(139,0,0,.3)', fontFamily: F, fontSize: '1.2rem', color: 'rgba(139,0,0,.8)' }}>{'\u25C8'}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: FC, fontSize: '.7rem', color: 'rgba(255,255,255,.85)', letterSpacing: 3 }}>Chastity Check</div>
                            <div style={{ fontFamily: F, fontSize: '.4rem', color: 'rgba(139,0,0,.6)', letterSpacing: 2, marginTop: 3 }}>Photo proof {'\u00B7'} every day {'\u00B7'} constant</div>
                        </div>
                    </div>
                </div>

                {/* Editable task cards */}
                {tasks.map((task: Task, idx: number) => {
                    const meta = TASK_META[task.type] || { label: task.type, icon: '\u2022', color: '#666' };
                    const hasConfig = !!(meta as any).configKey;
                    const cfgKey = (meta as any).configKey;
                    const cfgItems = hasConfig ? (configData[cfgKey] || []) : [];

                    return (
                        <div key={idx}
                            draggable onDragStart={() => setDragIdx(idx)}
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('kdrag'); }}
                            onDragLeave={(e) => e.currentTarget.classList.remove('kdrag')}
                            onDrop={(e) => { e.currentTarget.classList.remove('kdrag'); if(dragIdx!==null) moveTask(dragIdx,idx); setDragIdx(null); }}
                            onDragEnd={() => setDragIdx(null)}
                            className="ktc"
                            style={{
                                borderRadius: 12, marginBottom: 14, opacity: dragIdx===idx ? .2 : 1, overflow: 'hidden', position: 'relative',
                                border: `1px solid rgba(197,160,89,.18)`,
                                background: 'linear-gradient(135deg, rgba(22,20,30,.95), rgba(14,12,20,.98))',
                            }}>
                            {/* Top accent line */}
                            <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 2, background: `linear-gradient(90deg, ${meta.color}, transparent)`, opacity: .6 }} />

                            {/* Main content */}
                            <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
                                {/* Drag handle */}
                                <div style={{ color: 'rgba(197,160,89,.35)', fontSize: '.7rem', userSelect: 'none' }}>{'\u2982'}</div>

                                {/* Icon */}
                                <div style={{
                                    width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: `rgba(${_hexToRgb(meta.color)},.12)`, border: `1px solid rgba(${_hexToRgb(meta.color)},.25)`,
                                    fontFamily: F, fontSize: '1.2rem', color: meta.color, opacity: .85, flexShrink: 0,
                                }}>{meta.icon}</div>

                                {/* Label + type */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <input value={task.label} onChange={(e) => updateTask(idx,'label',e.target.value)} style={{
                                        background: 'transparent', border: 'none', outline: 'none', width: '100%',
                                        fontFamily: FC, fontSize: '.7rem', color: 'rgba(255,255,255,.9)', letterSpacing: 1,
                                    }} />
                                    <div style={{ fontFamily: F, fontSize: '.38rem', color: meta.color, opacity: .7, letterSpacing: 3, marginTop: 3, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {meta.label}
                                        {hasConfig && (
                                            <span onClick={(e) => { e.stopPropagation(); setConfigSection(cfgKey); setView('config'); }} style={{ color: GOLD, cursor: 'pointer', letterSpacing: 2, borderBottom: `1px solid rgba(197,160,89,.4)`, paddingBottom: 1 }}>
                                                EDIT OPTIONS {'\u2192'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Target */}
                                <input type="number" value={task.target} onChange={(e) => updateTask(idx,'target',parseInt(e.target.value)||1)} style={{
                                    width: 48, height: 44, textAlign: 'center', borderRadius: 8,
                                    background: 'rgba(0,0,0,.4)', border: `1px solid rgba(197,160,89,.2)`,
                                    color: GOLD, fontFamily: FC, fontSize: '.9rem', outline: 'none',
                                }} />

                                {/* Delete */}
                                <button onClick={(e) => { e.stopPropagation(); removeTask(idx); }} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)',
                                    fontFamily: F, fontSize: '1rem', padding: '4px 6px', transition: 'color .2s',
                                }} onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,60,60,.7)')} onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>{'\u00D7'}</button>
                            </div>

                            {/* Config preview */}
                            {hasConfig && cfgItems.length > 0 && (
                                <div style={{ padding: '0 24px 16px', paddingLeft: 90 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {cfgItems.slice(0, 8).map((item: any, i: number) => {
                                            const lbl = typeof item === 'string' ? item : (item.label || item.title || item.question || item.type || '');
                                            return <span key={i} style={{ fontFamily: F, fontSize: '.4rem', color: meta.color, opacity: .85, background: `rgba(${_hexToRgb(meta.color)},.15)`, padding: '5px 12px', borderRadius: 5, border: `1px solid rgba(${_hexToRgb(meta.color)},.25)`, letterSpacing: 1 }}>{lbl}</span>;
                                        })}
                                        {cfgItems.length > 8 && <span style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, alignSelf: 'center' }}>+{cfgItems.length-8}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Add task */}
                <div style={{ marginTop: 18 }}>
                    <button onClick={() => setAddOpen(!addOpen)} className="kbtn" style={{
                        width: '100%', padding: '18px', borderRadius: 12, border: `1px dashed rgba(197,160,89,.25)`,
                        background: addOpen ? 'rgba(197,160,89,.06)' : 'transparent',
                        color: addOpen ? GOLD : TEXT_DIM, fontFamily: FC, fontSize: '.45rem', letterSpacing: 4,
                    }}>+ Add Task</button>

                    {addOpen && (
                        <div className="kfade" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            {Object.entries(TASK_META).filter(([t]) => t!=='chastity_check').map(([type, meta]) => (
                                <button key={type} onClick={() => { addTask(type); setAddOpen(false); }} className="kbtn" style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px',
                                    borderRadius: 10, border: `1px solid rgba(197,160,89,.15)`, textAlign: 'left',
                                    background: 'linear-gradient(135deg, rgba(22,20,30,.95), rgba(14,12,20,.98))',
                                    fontFamily: F, fontSize: '.55rem', fontWeight: 600, color: TEXT,
                                }}>
                                    <span style={{ fontSize: '.9rem', color: meta.color, opacity: .8 }}>{meta.icon}</span>
                                    <span style={{ letterSpacing: 1 }}>{meta.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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
function MemberView({ email, setEmail, program, sel, setSel, info, locked, onLoad, onGenerate, updateTask, addTask, removeTask, moveTask, saveMemberDay, saving, loading, dragIdx, setDragIdx, configData, setView, setConfigSection }: any) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!email ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }} className="kscr">
                    <div style={{ fontFamily: FC, fontSize: '.55rem', color: GOLD, letterSpacing: 5, marginBottom: 24 }}>SELECT MEMBER</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
                        {locked.map((m: any, i: number) => (
                            <div key={m.memberId} className="kmc kfade" onClick={() => { setEmail(m.memberId); setTimeout(onLoad,80); }} style={{
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
                    <div style={{ width: sel?'32%':'100%', transition: 'width .4s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 24px', borderBottom: `1px solid rgba(197,160,89,.18)`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                            <button onClick={() => { setEmail(''); setSel(null); }} style={{ background: 'none', border: 'none', color: TEXT_DIM, cursor: 'pointer', fontSize: '1rem' }}>{'\u2190'}</button>
                            {info?.avatar && <img src={info.avatar} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: `1px solid rgba(197,160,89,.2)` }} />}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: FC, fontSize: '.6rem', color: 'rgba(255,255,255,.92)', letterSpacing: 3 }}>{info?.name || email.split('@')[0]}</div>
                                <div style={{ fontFamily: F, fontSize: '.38rem', color: TEXT_DIM, letterSpacing: 1 }}>Day {info?.daysIn||'?'} of {info?.lockDays||'?'}</div>
                            </div>
                            {!program ? (
                                <button onClick={onGenerate} className="kbtn" style={{ padding: '9px 22px', borderRadius: 6, border: `1px solid rgba(139,0,0,.3)`, background: RED_DIM, color: RED, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3 }}>{saving?'GENERATING...':'GENERATE'}</button>
                            ) : (
                                <button onClick={() => { if(sel) saveMemberDay(sel,program[String(sel)]||[]); }} className="kbtn" style={{ padding: '9px 22px', borderRadius: 6, border: `1px solid rgba(197,160,89,.3)`, background: 'rgba(197,160,89,.1)', color: GOLD, fontFamily: FC, fontSize: '.4rem', letterSpacing: 3, opacity: sel?1:.3 }}>{saving?'SAVING...':'SAVE DAY'}</button>
                            )}
                        </div>
                        {program ? (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }} className="kscr">
                                {PHASES.map(phase => (
                                    <div key={phase.name} style={{ marginBottom: 22 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <div style={{ width: 3, height: 16, borderRadius: 2, background: phase.color, opacity: .7 }} />
                                            <span style={{ fontFamily: FC, fontSize: '.4rem', color: phase.color, letterSpacing: 5 }}>{phase.name}</span>
                                            <div style={{ flex: 1, height: 1, background: 'rgba(197,160,89,.12)' }} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: sel?'1fr 1fr':'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                                            {phase.days.map(d => {
                                                const tasks = program[String(d)]||[];
                                                const isA = sel===d;
                                                const isC = info?.daysIn===d;
                                                return (<div key={d} className="kdc" onClick={() => setSel(isA?null:d)} style={{
                                                    borderRadius: 8, padding: '10px 12px',
                                                    border: `1px solid ${isA?'rgba(197,160,89,.35)':isC?'rgba(139,0,0,.3)':'rgba(197,160,89,.12)'}`,
                                                    background: isA?'rgba(197,160,89,.1)':isC?'rgba(139,0,0,.08)':'rgba(22,20,30,.95)',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontFamily: FC, fontSize: '.7rem', color: isA?GOLD:isC?RED:'rgba(255,255,255,.55)' }}>{d}</span>
                                                        {isC && <span style={{ fontFamily: F, fontSize: '.28rem', color: RED, letterSpacing: 2 }}>TODAY</span>}
                                                        <span style={{ fontFamily: F, fontSize: '.35rem', color: TEXT_DIM }}>{tasks.length+1}</span>
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
                                    <div style={{ fontFamily: FC, fontSize: '1.2rem', color: 'rgba(255,255,255,.15)', marginBottom: 14 }}>{'\u26D3'}</div>
                                    <div style={{ fontFamily: F, fontSize: '.5rem', color: TEXT_DIM, letterSpacing: 3 }}>{loading?'LOADING...':'NO PROGRAM'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                    {sel && program && <TaskPanel dayNum={sel} tasks={program[String(sel)]||[]} onClose={() => setSel(null)} updateTask={(i:number,f:string,v:any)=>updateTask(sel,i,f,v)} addTask={(t:string)=>addTask(sel,t)} removeTask={(i:number)=>removeTask(sel,i)} moveTask={(a:number,b:number)=>moveTask(sel,a,b)} dragIdx={dragIdx} setDragIdx={setDragIdx} configData={configData} setView={setView} setConfigSection={setConfigSection} />}
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
