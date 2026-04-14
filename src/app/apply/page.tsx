"use client";

import { useState, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Animated background ──────────────────────────────────────────────────────

function ElegantShape({ className, delay = 0, width = 400, height = 100, rotate = 0, gradient = "from-white/[0.08]" }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: -150, rotate: rotate - 15 }} animate={{ opacity: 1, y: 0, rotate }}
            transition={{ duration: 2.4, delay, ease: [0.23, 0.86, 0.39, 0.96], opacity: { duration: 1.2 } }}
            className={cn("absolute", className)}>
            <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} style={{ width, height }} className="relative">
                <div className={cn("absolute inset-0 rounded-full bg-gradient-to-r to-transparent", gradient,
                    "backdrop-blur-[2px] border-2 border-white/[0.15] shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
                    "after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]")} />
            </motion.div>
        </motion.div>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface FormData {
    email: string; name: string;
    toys_owned: string; favorite_toy: string; weirdest_object: string;
    bought_to_impress: boolean | null; toy_want_to_try: string;
    femdom_experience: string; expectations: string; hard_limits: string;
    soft_limits: string; first_experience: string; best_moment: string; mistakes: string;
    sliders: Record<string, number>;
    domination_tone: string;
    reason_applying: string; feelings_payment: string; self_perception: string;
    priority_aspect: string; motivation: string;
    pain_tolerance: string;
    preference: string; isolation_effects: string; self_review: string; ideal_punishment: string;
    amount: number;
}

const SLIDERS = [
    'Obedience Training', 'Tease & Denial', 'Chastity & Denial', 'Pain Play',
    'Bondage & Restraints', 'Service Submission', 'Exposure / Exhibitionism',
    'Psychological Control', 'Humiliation', 'Worship', 'Blackmail', 'Discipline & Punishment',
];

const TONES = ['Motherly', 'Sadistic', 'Disciplinarian', 'Playful'];
const PAIN_OPTIONS = ['I love it', 'I tolerate it as punishment', 'None whatsoever'];
const PREFERENCE_OPTIONS = ['Obedience', 'Pleasure'];
const EXPERIENCE_OPTIONS = ['Yes, experienced', 'A few times', 'Completely new'];

const STEP_TITLES = ['', 'Kinks', 'Experience', 'Testing', 'Tone', 'Assurance', 'Pain', 'Psychology'];

// ─── Shared UI ────────────────────────────────────────────────────────────────

function GoldDivider() {
    return <div className="w-8 h-px bg-gradient-to-r from-amber-500/50 to-transparent mb-8 mt-1" />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[0.58rem] tracking-[4px] text-amber-400/40 uppercase font-[Raleway] mb-3">{children}</p>;
}

function TextArea({ placeholder, value, onChange, rows = 4 }: any) {
    return (
        <textarea
            className="w-full bg-transparent border-b border-white/10 focus:border-amber-500/50 text-white/70 font-['Cormorant_Garamond'] text-base font-light p-0 py-2 resize-none outline-none transition-colors duration-300 placeholder:text-white/15"
            placeholder={placeholder} value={value} onChange={onChange} rows={rows}
        />
    );
}

function TextInput({ placeholder, value, onChange, type = 'text' }: any) {
    return (
        <input type={type}
            className="w-full bg-transparent border-b border-white/10 focus:border-amber-500/50 text-white/70 font-['Cormorant_Garamond'] text-base font-light py-2 outline-none transition-colors duration-300 placeholder:text-white/15"
            placeholder={placeholder} value={value} onChange={onChange}
        />
    );
}

function ChoiceBtn({ label, active, onClick }: any) {
    return (
        <button onClick={onClick} className={cn(
            "px-4 py-3 text-left border transition-all duration-200 font-['Cormorant_Garamond'] text-base font-light",
            active ? "border-amber-500/40 bg-amber-500/[0.06] text-amber-200/80" : "border-white/[0.07] bg-white/[0.01] text-white/35 hover:border-white/15"
        )}>{label}</button>
    );
}

function PrimaryBtn({ children, onClick, disabled }: any) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-full py-4 bg-gradient-to-r from-amber-600/90 to-amber-800/90 text-black/90 text-[0.55rem] tracking-[4px] font-[Raleway] font-semibold uppercase transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed">
            {children}
        </button>
    );
}

function GhostBtn({ children, onClick }: any) {
    return (
        <button onClick={onClick} className="text-[0.58rem] tracking-[3px] text-white/20 uppercase font-[Raleway] hover:text-white/35 transition-colors duration-200">
            {children}
        </button>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
    const [step, setStep] = useState<Step>(0);
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);
    const [applicationId, setApplicationId] = useState<string | null>(null);

    const [form, setForm] = useState<FormData>({
        email: '', name: '',
        toys_owned: '', favorite_toy: '', weirdest_object: '', bought_to_impress: null, toy_want_to_try: '',
        femdom_experience: '', expectations: '', hard_limits: '', soft_limits: '', first_experience: '', best_moment: '', mistakes: '',
        sliders: Object.fromEntries(SLIDERS.map(s => [s, 50])),
        domination_tone: '',
        reason_applying: '', feelings_payment: '', self_perception: '', priority_aspect: '', motivation: '',
        pain_tolerance: '',
        preference: '', isolation_effects: '', self_review: '', ideal_punishment: '',
        amount: 95,
    });

    const set = (key: keyof FormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));
    const setSlider = (key: string, value: number) => setForm(prev => ({ ...prev, sliders: { ...prev.sliders, [key]: value } }));

    const saveProgress = async (nextStep: number, extraData?: Partial<FormData>) => {
        setSaving(true);
        try {
            const payload = { ...form, ...extraData, step: nextStep, applicationId };
            const res = await fetch('/api/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.applicationId) setApplicationId(data.applicationId);
        } catch { }
        setSaving(false);
    };

    const goTo = async (next: Step, extraData?: Partial<FormData>) => {
        setDirection(next > step ? 1 : -1);
        await saveProgress(next, extraData);
        setStep(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCheckout = async () => {
        setSaving(true);
        try {
            await saveProgress(8);
            const res = await fetch('/api/apply/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId, email: form.email, name: form.name, amount: form.amount }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch { setSaving(false); }
    };

    const variants: Variants = {
        enter: (d: number) => ({ opacity: 0, x: d > 0 ? 48 : -48 }),
        center: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.25, 0.4, 0.25, 1] } },
        exit: (d: number) => ({ opacity: 0, x: d > 0 ? -48 : 48, transition: { duration: 0.3 } }),
    };

    return (
        <div className="relative min-h-screen bg-[#030303] flex items-start justify-center overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@300;400&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Raleway:wght@300;400;500&display=swap');
                * { box-sizing: border-box; }
                input[type=range] { -webkit-appearance: none; appearance: none; height: 1px; background: rgba(255,255,255,0.1); outline: none; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #c5a059; cursor: pointer; border: none; }
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
                textarea, input { background: transparent !important; }
            `}</style>

            {/* Background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] via-transparent to-rose-500/[0.03] blur-3xl" />
                <ElegantShape delay={0.2} width={500} height={120} rotate={12} gradient="from-amber-500/[0.10]" className="left-[-8%] top-[10%]" />
                <ElegantShape delay={0.4} width={400} height={100} rotate={-15} gradient="from-rose-500/[0.08]" className="right-[-5%] top-[55%]" />
                <ElegantShape delay={0.3} width={250} height={70} rotate={-8} gradient="from-violet-500/[0.08]" className="left-[5%] bottom-[8%]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/60 pointer-events-none z-[1]" />

            <div className="relative z-10 w-full max-w-lg px-8 pt-14 pb-16 flex flex-col min-h-screen">

                {/* Progress bar */}
                {step > 0 && step < 8 && (
                    <div className="flex gap-1 mb-10">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="h-px flex-1 transition-all duration-500"
                                style={{ background: i < step ? 'rgba(197,160,89,0.65)' : 'rgba(255,255,255,0.08)' }} />
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" className="flex flex-col flex-1">

                        {step === 0 && <IntroStep form={form} set={set} onNext={() => goTo(1)} saving={saving} />}
                        {step === 1 && <KinksStep form={form} set={set} onNext={() => goTo(2)} onBack={() => goTo(0 as Step)} />}
                        {step === 2 && <ExperienceStep form={form} set={set} onNext={() => goTo(3)} onBack={() => goTo(1 as Step)} />}
                        {step === 3 && <TestingStep form={form} setSlider={setSlider} onNext={() => goTo(4)} onBack={() => goTo(2 as Step)} />}
                        {step === 4 && <ToneStep form={form} set={set} onNext={() => goTo(5)} onBack={() => goTo(3 as Step)} />}
                        {step === 5 && <AssuranceStep form={form} set={set} onNext={() => goTo(6)} onBack={() => goTo(4 as Step)} />}
                        {step === 6 && <PainStep form={form} set={set} onNext={() => goTo(7)} onBack={() => goTo(5 as Step)} />}
                        {step === 7 && <PsychologyStep form={form} set={set} onNext={handleCheckout} onBack={() => goTo(6 as Step)} saving={saving} amount={form.amount} setAmount={(v: number) => set('amount', v)} />}

                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ─── Step 0: Intro ────────────────────────────────────────────────────────────

function IntroStep({ form, set, onNext, saving }: any) {
    const ready = form.email.includes('@') && form.name.trim().length >= 2;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div className="flex-1 flex flex-col justify-center py-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 border border-amber-500/20 bg-amber-500/[0.03] mb-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                        <span className="text-[0.48rem] tracking-[4px] text-amber-400/50 uppercase font-[Raleway]">Ownership Application</span>
                    </div>
                    <h1 className="font-[Cinzel] font-light text-[2.2rem] leading-tight text-white tracking-wide mb-2">
                        You are applying
                    </h1>
                    <h1 className="font-[Cinzel] font-light text-[2.2rem] leading-tight mb-10 tracking-wide">
                        <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400/80 bg-clip-text text-transparent">for ownership.</span>
                    </h1>
                    <GoldDivider />
                    <p className="font-['Cormorant_Garamond'] text-[1.1rem] font-light text-white/45 leading-relaxed mb-5 italic">
                        This is not a casual inquiry. I review every application personally and I accept very few.
                    </p>
                    <p className="font-['Cormorant_Garamond'] text-[1.05rem] font-light text-white/35 leading-relaxed">
                        Answer honestly. I value truth over performance - I can tell the difference.
                    </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-12 space-y-6">
                    <div>
                        <FieldLabel>Your Email</FieldLabel>
                        <TextInput type="email" placeholder="your@email.com" value={form.email} onChange={(e: any) => set('email', e.target.value)} />
                    </div>
                    <div>
                        <FieldLabel>Your Name</FieldLabel>
                        <TextInput placeholder="What do you go by..." value={form.name} onChange={(e: any) => set('name', e.target.value)} />
                    </div>
                </motion.div>
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-10">
                <PrimaryBtn onClick={onNext} disabled={!ready || saving}>
                    {saving ? 'Saving...' : 'Begin Application'}
                </PrimaryBtn>
            </motion.div>
        </div>
    );
}

// ─── Step 1: Kinks ────────────────────────────────────────────────────────────

function KinksStep({ form, set, onNext, onBack }: any) {
    const ready = form.toys_owned && form.favorite_toy && form.bought_to_impress !== null;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="01" title="Your Kinks" subtitle="Be specific. Be honest." />
                <div className="space-y-8">
                    <div>
                        <FieldLabel>List all toys you own</FieldLabel>
                        <TextArea placeholder="Be thorough..." value={form.toys_owned} onChange={(e: any) => set('toys_owned', e.target.value)} />
                    </div>
                    <div>
                        <FieldLabel>Your favorite and why</FieldLabel>
                        <TextArea placeholder="What makes it your favorite..." value={form.favorite_toy} onChange={(e: any) => set('favorite_toy', e.target.value)} rows={3} />
                    </div>
                    <div>
                        <FieldLabel>Weirdest object you've used that technically wasn't a toy</FieldLabel>
                        <TextArea placeholder="Don't be shy..." value={form.weirdest_object} onChange={(e: any) => set('weirdest_object', e.target.value)} rows={2} />
                    </div>
                    <div>
                        <FieldLabel>Have you ever bought a toy just to impress someone?</FieldLabel>
                        <div className="flex gap-3 mt-1">
                            <ChoiceBtn label="Yes" active={form.bought_to_impress === true} onClick={() => set('bought_to_impress', true)} />
                            <ChoiceBtn label="No" active={form.bought_to_impress === false} onClick={() => set('bought_to_impress', false)} />
                        </div>
                    </div>
                    <div>
                        <FieldLabel>One toy you want to try but are too shy to admit</FieldLabel>
                        <TextInput placeholder="..." value={form.toy_want_to_try} onChange={(e: any) => set('toy_want_to_try', e.target.value)} />
                    </div>
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
        </div>
    );
}

// ─── Step 2: Experience ───────────────────────────────────────────────────────

function ExperienceStep({ form, set, onNext, onBack }: any) {
    const ready = form.femdom_experience;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="02" title="Your Experience" subtitle="Where you've been shapes where you're going." />
                <div className="space-y-8">
                    <div>
                        <FieldLabel>Do you have experience with online FemDom?</FieldLabel>
                        <div className="flex flex-col gap-2.5 mt-1">
                            {EXPERIENCE_OPTIONS.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.femdom_experience === opt} onClick={() => set('femdom_experience', opt)} />
                            ))}
                        </div>
                    </div>
                    {form.femdom_experience && (
                        <>
                            <div>
                                <FieldLabel>What are your expectations entering this?</FieldLabel>
                                <TextArea placeholder="Be honest about what you're looking for..." value={form.expectations} onChange={(e: any) => set('expectations', e.target.value)} />
                            </div>
                            <div>
                                <FieldLabel>Your hard limits</FieldLabel>
                                <TextArea placeholder="Absolute non-negotiables..." value={form.hard_limits} onChange={(e: any) => set('hard_limits', e.target.value)} rows={2} />
                            </div>
                            <div>
                                <FieldLabel>Your soft limits</FieldLabel>
                                <TextArea placeholder="Things you'd consider with the right dynamic..." value={form.soft_limits} onChange={(e: any) => set('soft_limits', e.target.value)} rows={2} />
                            </div>
                            {form.femdom_experience !== 'Completely new' && (
                                <>
                                    <div>
                                        <FieldLabel>Describe your first experience</FieldLabel>
                                        <TextArea placeholder="How it started..." value={form.first_experience} onChange={(e: any) => set('first_experience', e.target.value)} />
                                    </div>
                                    <div>
                                        <FieldLabel>Your best moment in submission</FieldLabel>
                                        <TextArea placeholder="What stands out..." value={form.best_moment} onChange={(e: any) => set('best_moment', e.target.value)} />
                                    </div>
                                    <div>
                                        <FieldLabel>A mistake you've made and what you learned</FieldLabel>
                                        <TextArea placeholder="Be honest..." value={form.mistakes} onChange={(e: any) => set('mistakes', e.target.value)} />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
        </div>
    );
}

// ─── Step 3: Testing sliders ──────────────────────────────────────────────────

function TestingStep({ form, setSlider, onNext, onBack }: any) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="03" title="Your Range" subtitle="Slide to reflect your genuine interest level." />
                <div className="space-y-7">
                    {SLIDERS.map(label => (
                        <div key={label}>
                            <div className="flex justify-between items-center mb-3">
                                <p className="font-['Cormorant_Garamond'] text-[0.95rem] text-white/50 font-light">{label}</p>
                                <p className="text-[0.65rem] tracking-[2px] text-amber-400/50 font-[Raleway]">{form.sliders[label]}%</p>
                            </div>
                            <input type="range" min={0} max={100} value={form.sliders[label]}
                                onChange={e => setSlider(label, parseInt(e.target.value))}
                                className="w-full cursor-pointer" />
                        </div>
                    ))}
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} />
        </div>
    );
}

// ─── Step 4: Tone ─────────────────────────────────────────────────────────────

function ToneStep({ form, set, onNext, onBack }: any) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="04" title="Preferred Tone" subtitle="What kind of domination speaks to you most?" />
                <div className="flex flex-col gap-3">
                    {TONES.map(tone => (
                        <ChoiceBtn key={tone} label={tone} active={form.domination_tone === tone} onClick={() => set('domination_tone', tone)} />
                    ))}
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!form.domination_tone} />
        </div>
    );
}

// ─── Step 5: Assurance ────────────────────────────────────────────────────────

function AssuranceStep({ form, set, onNext, onBack }: any) {
    const ready = form.reason_applying && form.feelings_payment;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="05" title="Your Conviction" subtitle="Convince me this is worth my time." />
                <div className="space-y-8">
                    <div>
                        <FieldLabel>Why are you applying for ownership directly?</FieldLabel>
                        <TextArea placeholder="Be specific. Generic answers are dismissed." value={form.reason_applying} onChange={(e: any) => set('reason_applying', e.target.value)} />
                    </div>
                    <div>
                        <FieldLabel>How do you feel about payment being your first act of obedience?</FieldLabel>
                        <TextArea placeholder="Your honest reaction..." value={form.feelings_payment} onChange={(e: any) => set('feelings_payment', e.target.value)} rows={3} />
                    </div>
                    <div>
                        <FieldLabel>How do you see yourself through my eyes?</FieldLabel>
                        <TextArea placeholder="Be brutally honest..." value={form.self_perception} onChange={(e: any) => set('self_perception', e.target.value)} rows={3} />
                    </div>
                    <div>
                        <FieldLabel>What aspect of this application matters most to you?</FieldLabel>
                        <TextInput placeholder="..." value={form.priority_aspect} onChange={(e: any) => set('priority_aspect', e.target.value)} />
                    </div>
                    <div>
                        <FieldLabel>What will make you complete this, even if it's difficult?</FieldLabel>
                        <TextArea placeholder="Your motivation..." value={form.motivation} onChange={(e: any) => set('motivation', e.target.value)} rows={2} />
                    </div>
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
        </div>
    );
}

// ─── Step 6: Pain ────────────────────────────────────────────────────────────

function PainStep({ form, set, onNext, onBack }: any) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="06" title="Pain Tolerance" subtitle="Where do you stand?" />
                <div className="flex flex-col gap-3">
                    {PAIN_OPTIONS.map(opt => (
                        <ChoiceBtn key={opt} label={opt} active={form.pain_tolerance === opt} onClick={() => set('pain_tolerance', opt)} />
                    ))}
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!form.pain_tolerance} />
        </div>
    );
}

// ─── Step 7: Psychology + Checkout ───────────────────────────────────────────

function PsychologyStep({ form, set, onNext, onBack, saving, amount, setAmount }: any) {
    const ready = form.preference && form.self_review;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader num="07" title="Your Psychology" subtitle="The last layer." />
                <div className="space-y-8">
                    <div>
                        <FieldLabel>What drives you more?</FieldLabel>
                        <div className="flex gap-3">
                            {PREFERENCE_OPTIONS.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.preference === opt} onClick={() => set('preference', opt)} />
                            ))}
                        </div>
                    </div>
                    <div>
                        <FieldLabel>How would a period of isolation affect you?</FieldLabel>
                        <TextArea placeholder="Honestly..." value={form.isolation_effects} onChange={(e: any) => set('isolation_effects', e.target.value)} rows={3} />
                    </div>
                    <div>
                        <FieldLabel>Rate yourself as a submissive and explain</FieldLabel>
                        <TextArea placeholder="Be critical..." value={form.self_review} onChange={(e: any) => set('self_review', e.target.value)} />
                    </div>
                    <div>
                        <FieldLabel>Describe your ideal punishment</FieldLabel>
                        <TextArea placeholder="In detail..." value={form.ideal_punishment} onChange={(e: any) => set('ideal_punishment', e.target.value)} />
                    </div>

                    {/* Payment section */}
                    <div className="pt-4 border-t border-white/[0.06]">
                        <p className="font-[Cinzel] font-light text-lg text-white mb-2 tracking-wide">Application Fee</p>
                        <p className="font-['Cormorant_Garamond'] text-sm font-light text-white/35 leading-relaxed mb-6">
                            Minimum €95. Pay more if you want to be taken seriously.
                        </p>
                        <FieldLabel>Amount (€)</FieldLabel>
                        <div className="flex items-center gap-4">
                            <span className="text-amber-400/50 font-['Cormorant_Garamond'] text-xl">€</span>
                            <input type="number" min={95} value={amount}
                                onChange={e => setAmount(Math.max(95, parseInt(e.target.value) || 95))}
                                className="bg-transparent border-b border-white/10 focus:border-amber-500/50 text-white/70 font-['Cormorant_Garamond'] text-2xl font-light py-1 outline-none w-28 transition-colors" />
                        </div>
                        <p className="text-[0.55rem] tracking-[3px] text-white/15 font-[Raleway] uppercase mt-3">Non-refundable</p>
                    </div>
                </div>
            </div>

            <div className="mt-10 space-y-4">
                <PrimaryBtn onClick={onNext} disabled={!ready || saving}>
                    {saving ? 'Redirecting...' : `Submit & Pay €${amount}`}
                </PrimaryBtn>
                <div className="flex justify-center"><GhostBtn onClick={onBack}>← Back</GhostBtn></div>
            </div>
        </div>
    );
}

// ─── Shared step components ───────────────────────────────────────────────────

function StepHeader({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
    return (
        <div className="mb-8">
            <p className="text-[0.55rem] tracking-[4px] text-white/15 font-[Raleway] uppercase mb-6">{num} - {title}</p>
            <h2 className="font-[Cinzel] font-light text-[1.6rem] text-white leading-snug mb-1 tracking-wide">{title}</h2>
            <GoldDivider />
            <p className="font-['Cormorant_Garamond'] text-[1rem] font-light italic text-white/30 leading-relaxed">{subtitle}</p>
        </div>
    );
}

function StepNav({ onNext, onBack, disabled = false }: { onNext: () => void; onBack: () => void; disabled?: boolean }) {
    return (
        <div className="mt-10 space-y-4">
            <PrimaryBtn onClick={onNext} disabled={disabled}>Continue</PrimaryBtn>
            <div className="flex justify-center"><GhostBtn onClick={onBack}>← Back</GhostBtn></div>
        </div>
    );
}
