"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// --- Animated background ---

function ElegantShape({ className, delay = 0, width = 400, height = 100, rotate = 0, gradient = "from-white/[0.08]" }: {
    className?: string; delay?: number; width?: number; height?: number; rotate?: number; gradient?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
            animate={{ opacity: 1, y: 0, rotate }}
            transition={{ duration: 2.4, delay, ease: [0.23, 0.86, 0.39, 0.96], opacity: { duration: 1.2 } }}
            className={cn("absolute", className)}
        >
            <motion.div animate={{ y: [0, 15, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                style={{ width, height }} className="relative">
                <div className={cn(
                    "absolute inset-0 rounded-full bg-gradient-to-r to-transparent", gradient,
                    "backdrop-blur-[2px] border-2 border-white/[0.15]",
                    "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
                    "after:absolute after:inset-0 after:rounded-full",
                    "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]"
                )} />
            </motion.div>
        </motion.div>
    );
}

function AnimatedBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] via-transparent to-rose-500/[0.04] blur-3xl" />
            <ElegantShape delay={0.2} width={500} height={120} rotate={12} gradient="from-amber-500/[0.12]" className="left-[-8%] top-[10%]" />
            <ElegantShape delay={0.4} width={400} height={100} rotate={-15} gradient="from-rose-500/[0.10]" className="right-[-5%] top-[60%]" />
            <ElegantShape delay={0.3} width={250} height={70} rotate={-8} gradient="from-violet-500/[0.10]" className="left-[5%] bottom-[8%]" />
            <ElegantShape delay={0.6} width={180} height={50} rotate={20} gradient="from-amber-400/[0.12]" className="right-[10%] top-[8%]" />
            <ElegantShape delay={0.5} width={130} height={38} rotate={-22} gradient="from-orange-500/[0.10]" className="left-[25%] top-[4%]" />
        </div>
    );
}

// --- Types ---

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface FormData {
    // Step 1 - About You
    name: string;
    email: string;
    age: string;
    location: string;
    height_weight: string;
    occupation: string;
    relationship_status: string;
    friends_description: string;
    favorite_snack: string;
    weekly_budget: string;
    // Step 2 - Kinks
    toys_owned: string;
    favorite_toy: string;
    weirdest_object: string;
    bought_to_impress: boolean | null;
    toy_want_to_try: string;
    // Step 3 - Experience
    femdom_experience: string;
    expectations: string;
    hard_limits: string;
    soft_limits: string;
    first_experience: string;
    best_moment: string;
    mistakes: string;
    // Step 4 - Sliders
    ready_for_sliders: string;
    sliders: Record<string, number>;
    // Step 5 - Tone
    domination_tone: string;
    // Step 6 - Psychology
    preference: string;
    isolation_effects: string;
    self_review: string;
    ideal_punishment: string;
    // Step 7 - Assurance (all multiple choice)
    reason_applying: string;
    self_perception: string;
    feelings_payment: string;
    priority_aspect: string;
    motivation: string;
    // Step 8 - Pain + payment
    pain_tolerance: string;
    amount: number;
}

const SLIDERS = [
    'Obedience Training', 'Tease & Denial', 'Humiliation', 'Chastity & Denial',
    'Pain Play', 'Bondage & Restraints', 'Psychological Control', 'Service Submission',
    'Exposure / Exhibitionism', 'Worship', 'Blackmail', 'Discipline & Punishment',
];

const EXPERIENCE_OPTIONS = [
    'Yes, I have a lot of experience',
    'Only a few times',
    "I'm completely new",
];

const TONES = ['Motherly / Loving', 'Sadistic', 'Disciplinarian', 'Playful'];

const PAIN_OPTIONS = [
    'In love with pain',
    'I tolerate it as punishment',
    'No pain-based dynamic',
];

const PREFERENCE_OPTIONS = ['Obedience', 'Pleasure'];

const ASSURANCE_Q1 = [
    "I don't fully understand the difference",
    "I believe I am worthy of full attention",
];
const ASSURANCE_Q2 = [
    "Someone trying to impress you",
    "Someone mentally already yours",
];
const ASSURANCE_Q3 = [
    "Nervous but ready to obey",
    "Aroused by the act of giving control",
];
const ASSURANCE_Q4 = [
    "The effort I put in",
    "The need that's been building since the first question",
];
const ASSURANCE_Q5 = [
    "I need to know I made it through",
    "Every question has weakened me further",
];

const TOTAL_STEPS = 9;

// --- Shared UI ---

function GoldDivider() {
    return <div className="w-8 h-px bg-gradient-to-r from-amber-500/60 to-transparent mb-8 mt-1" />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="font-['Cormorant_Garamond'] font-normal text-[1.15rem] text-white/80 mb-0.5">{children}</p>;
}

// Full question text - readable Cormorant
function Question({ children }: { children: React.ReactNode }) {
    return <p className="font-['Cormorant_Garamond'] text-[1.1rem] font-light text-white/65 leading-relaxed mb-4">{children}</p>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
    return <p className="font-['Cormorant_Garamond'] italic text-[0.8rem] text-white/22 mb-3 leading-snug">{children}</p>;
}

function PrimaryBtn({ children, onClick, disabled }: any) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-full py-4 border border-amber-500/45 bg-amber-500/[0.06] text-amber-200/85 font-['Cormorant_Garamond'] font-normal text-[1.1rem] tracking-wide transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed hover:border-amber-400/65 hover:bg-amber-500/[0.10] hover:text-amber-100/90"
            style={{ boxShadow: '0 0 18px rgba(197,160,89,0.10)' }}>
            {children}
        </button>
    );
}

function GhostBtn({ children, onClick }: any) {
    return (
        <button onClick={onClick}
            className="font-['Cormorant_Garamond'] italic text-[0.9rem] text-white/25 hover:text-white/45 transition-colors duration-200">
            {children}
        </button>
    );
}

function LineInput({ placeholder, value, onChange, type = 'text', autoComplete }: any) {
    return (
        <input type={type}
            className="w-full bg-transparent border-b border-white/10 focus:border-amber-500/40 text-white/65 font-['Cormorant_Garamond'] text-base font-light py-2 outline-none transition-colors duration-300 placeholder:text-white/15 mt-0"
            placeholder={placeholder} value={value} onChange={onChange} autoComplete={autoComplete ?? 'off'}
        />
    );
}

function TextArea({ placeholder, value, onChange, rows = 4 }: any) {
    return (
        <textarea
            className="w-full bg-transparent border-b border-white/10 focus:border-amber-500/40 text-white/65 font-['Cormorant_Garamond'] text-base font-light p-0 py-2 resize-none outline-none transition-colors duration-300 placeholder:text-white/15"
            placeholder={placeholder} value={value} onChange={onChange} rows={rows}
        />
    );
}

function ChoiceBtn({ label, active, onClick }: any) {
    return (
        <button onClick={onClick} className={cn(
            "w-full px-5 py-4 text-left border transition-all duration-200 font-['Cormorant_Garamond'] font-normal text-[1.15rem]",
            active
                ? "border-amber-500/50 bg-amber-500/[0.08] text-amber-200/90"
                : "border-white/[0.08] bg-transparent text-white/55 hover:border-amber-500/25 hover:text-white/70"
        )}>{label}</button>
    );
}

function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
    if (!show) return null;
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {children}
        </motion.div>
    );
}

function StepHeader({ stepLabel, line1, line2 }: { stepLabel: string; line1: string; line2: string }) {
    return (
        <div className="mb-8">
            <p className="font-['Cormorant_Garamond'] italic text-[0.85rem] text-white/20 mb-6 tracking-wide">{stepLabel}</p>
            <h2 className="font-['Cormorant_Garamond'] font-normal text-[2rem] text-white leading-snug mb-0.5">{line1}</h2>
            <h2 className="font-['Cormorant_Garamond'] font-normal text-[2rem] leading-snug mb-8">
                <span className="bg-gradient-to-r from-amber-300 to-amber-500/70 bg-clip-text text-transparent">{line2}</span>
            </h2>
            <GoldDivider />
        </div>
    );
}

function StepNav({ onNext, onBack, disabled = false }: { onNext: () => void; onBack: () => void; disabled?: boolean }) {
    return (
        <div className="mt-10 space-y-4">
            <PrimaryBtn onClick={onNext} disabled={disabled}>Continue</PrimaryBtn>
            <div className="flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
        </div>
    );
}

// --- Main ---

export default function ApplyPage() {
    const [step, setStep] = useState<Step>(0);
    const [direction, setDirection] = useState(1);
    const [saving, setSaving] = useState(false);
    const [applicationId, setApplicationId] = useState<string | null>(null);

    const [form, setForm] = useState<FormData>({
        name: '', email: '', age: '', location: '', height_weight: '',
        occupation: '', relationship_status: '', friends_description: '',
        favorite_snack: '', weekly_budget: '',
        toys_owned: '', favorite_toy: '', weirdest_object: '',
        bought_to_impress: null, toy_want_to_try: '',
        femdom_experience: '', expectations: '', hard_limits: '',
        soft_limits: '', first_experience: '', best_moment: '',
        mistakes: '',
        ready_for_sliders: '',
        sliders: Object.fromEntries(SLIDERS.map(s => [s, 50])),
        domination_tone: '',
        preference: '', isolation_effects: '', self_review: '', ideal_punishment: '',
        reason_applying: '', self_perception: '', feelings_payment: '',
        priority_aspect: '', motivation: '',
        pain_tolerance: '',
        amount: 95,
    });

    const set = (key: keyof FormData, value: any) => setForm(prev => ({ ...prev, [key]: value }));
    const setSlider = (key: string, value: number) => setForm(prev => ({ ...prev, sliders: { ...prev.sliders, [key]: value } }));

    const saveProgress = async (nextStep: number, extraData?: Partial<FormData>) => {
        if (!form.email) return;
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
            await saveProgress(9);
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
        exit: (d: number) => ({ opacity: 0, x: d > 0 ? -48 : 48, transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] } }),
    };

    return (
        <div className="relative min-h-screen bg-[#030303] flex items-start justify-center overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@300;400;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Raleway:wght@300;400;500&display=swap');
                * { box-sizing: border-box; }
                input[type=range] { -webkit-appearance:none; appearance:none; height:2px; background:rgba(255,255,255,0.08); outline:none; width:100%; cursor:pointer; border-radius:2px; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#c5a059; border:2px solid rgba(255,255,255,0.15); cursor:pointer; box-shadow:0 0 8px rgba(197,160,89,0.4); }
                input[type=range]::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#c5a059; border:2px solid rgba(255,255,255,0.15); cursor:pointer; }
                input[type=range]::-webkit-slider-runnable-track { height:2px; border-radius:2px; }
                input[type=range]::-moz-range-progress { height:2px; background:rgba(197,160,89,0.5); border-radius:2px; }
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
            `}</style>

            <AnimatedBackground />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/60 pointer-events-none z-[1]" />

            <div className="relative z-10 w-full max-w-md min-h-screen flex flex-col px-8 pt-16 pb-12">

                {step > 0 && step < 10 && (
                    <div className="flex gap-2 mb-12">
                        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                            <div key={i} className="h-px flex-1 transition-all duration-500"
                                style={{ background: i < step ? 'rgba(197,160,89,0.7)' : 'rgba(255,255,255,0.1)' }} />
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div key={step} custom={direction} variants={variants}
                        initial="enter" animate="center" exit="exit" className="flex flex-col flex-1">

                        {step === 0 && <IntroStep onNext={() => { setDirection(1); setStep(1); window.scrollTo({ top: 0 }); }} />}
                        {step === 1 && <AboutStep form={form} set={set} onNext={() => goTo(2)} saving={saving} />}
                        {step === 2 && <KinksStep form={form} set={set} onNext={() => goTo(3)} onBack={() => goTo(1 as Step)} />}
                        {step === 3 && <ExperienceStep form={form} set={set} onNext={() => goTo(4)} onBack={() => goTo(2 as Step)} />}
                        {step === 4 && <SlidersStep form={form} set={set} setSlider={setSlider} onNext={() => goTo(5)} onBack={() => goTo(3 as Step)} />}
                        {step === 5 && <ToneStep form={form} set={set} onNext={() => goTo(6)} onBack={() => goTo(4 as Step)} />}
                        {step === 6 && <PainStep form={form} set={set} onNext={() => goTo(7)} onBack={() => goTo(5 as Step)} />}
                        {step === 7 && <PsychologyStep form={form} set={set} onNext={() => goTo(8)} onBack={() => goTo(6 as Step)} />}
                        {step === 8 && <AssuranceStep form={form} set={set} onNext={() => goTo(9)} onBack={() => goTo(7 as Step)} />}
                        {step === 9 && <CheckoutStep form={form} set={set} onNext={handleCheckout} onBack={() => goTo(8 as Step)} saving={saving} amount={form.amount} setAmount={(v: number) => set('amount', v)} />}

                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// --- Step 0: Intro ---

function IntroStep({ onNext }: { onNext: () => void }) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div className="flex-1 flex flex-col justify-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 border border-amber-500/20 bg-amber-500/[0.03] mb-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                        <span className="font-['Cormorant_Garamond'] italic text-[0.85rem] text-amber-400/50">Ownership Application</span>
                    </div>
                    <h1 className="font-['Cormorant_Garamond'] font-normal text-[2.4rem] leading-[1.2] text-white mb-2">
                        You are applying
                    </h1>
                    <h1 className="font-['Cormorant_Garamond'] font-normal text-[2.4rem] leading-[1.2] mb-10">
                        <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400/80 bg-clip-text text-transparent">
                            for ownership.
                        </span>
                    </h1>
                    <GoldDivider />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35 }}
                    className="space-y-5">
                    <p className="font-['Cormorant_Garamond'] text-[1.15rem] font-light text-white/55 leading-relaxed italic">
                        This is not a casual inquiry. I review every application personally and I accept very few.
                    </p>
                    <p className="font-['Cormorant_Garamond'] text-[1.05rem] font-light text-white/40 leading-relaxed">
                        Answer honestly. I value truth over performance - I can tell the difference.
                    </p>
                </motion.div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-12">
                <PrimaryBtn onClick={onNext}>Begin Application</PrimaryBtn>
            </motion.div>
        </div>
    );
}

// --- Step 1: About You (cascading) ---

function AboutStep({ form, set, onNext, saving }: any) {
    const showEmail           = form.name.trim().length >= 2;
    const showAge             = showEmail && form.email.includes('@');
    const showLocation        = showAge && form.age && parseInt(form.age) >= 18;
    const showHeightWeight    = showLocation && form.location.trim().length > 0;
    const showOccupation      = showHeightWeight && form.height_weight.trim().length > 0;
    const showRelationship    = showOccupation && form.occupation.trim().length > 0;
    const showFriends         = showRelationship && form.relationship_status.trim().length > 0;
    const showSnack           = showFriends && form.friends_description.trim().length > 0;
    const showBudget          = showSnack && form.favorite_snack.trim().length > 0;

    const ready = form.name && form.email.includes('@') && form.age && parseInt(form.age) >= 18;

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="01 - About You" line1="Who are you" line2="really?" />
                <div className="space-y-8">

                    <div>
                        <FieldLabel>Name</FieldLabel>
                        <FieldHint>the one your mother gave you, not the one you hope I'll call you.</FieldHint>
                        <LineInput placeholder="Your name..." value={form.name} onChange={(e: any) => set('name', e.target.value)} autoComplete="name" />
                    </div>

                    <Reveal show={showEmail}>
                        <FieldLabel>Email</FieldLabel>
                        <LineInput type="email" placeholder="your@email.com" value={form.email} onChange={(e: any) => set('email', e.target.value)} autoComplete="email" />
                    </Reveal>

                    <Reveal show={showAge}>
                        <FieldLabel>Age</FieldLabel>
                        <FieldHint>(chronological, not emotional)</FieldHint>
                        <LineInput type="number" placeholder="Your age..." value={form.age} onChange={(e: any) => set('age', e.target.value)} />
                        {form.age && parseInt(form.age) < 18 && (
                            <p className="text-rose-400/50 font-['Cormorant_Garamond'] text-sm mt-2">You must be 18 or older.</p>
                        )}
                    </Reveal>

                    <Reveal show={showLocation}>
                        <FieldLabel>Location</FieldLabel>
                        <FieldHint>so I can judge your time zone and your climate excuses</FieldHint>
                        <LineInput placeholder="City, Country..." value={form.location} onChange={(e: any) => set('location', e.target.value)} />
                    </Reveal>

                    <Reveal show={showHeightWeight}>
                        <FieldLabel>Height & Weight</FieldLabel>
                        <FieldHint>no lying - I can sense insecurity through text!</FieldHint>
                        <LineInput placeholder="e.g. 180cm / 75kg" value={form.height_weight} onChange={(e: any) => set('height_weight', e.target.value)} />
                    </Reveal>

                    <Reveal show={showOccupation}>
                        <FieldLabel>Occupation</FieldLabel>
                        <FieldHint>do you actually work, or just daydream about being tied up?</FieldHint>
                        <LineInput placeholder="What you do..." value={form.occupation} onChange={(e: any) => set('occupation', e.target.value)} />
                    </Reveal>

                    <Reveal show={showRelationship}>
                        <FieldLabel>Relationship Status</FieldLabel>
                        <FieldHint>(single, taken, complicated, owned, delusional...)</FieldHint>
                        <LineInput placeholder="..." value={form.relationship_status} onChange={(e: any) => set('relationship_status', e.target.value)} />
                    </Reveal>

                    <Reveal show={showFriends}>
                        <Question>How would your friends describe you?</Question>
                        <FieldHint>If you say "funny" or "loyal," I'll roll my eyes.</FieldHint>
                        <TextArea placeholder="Be honest..." value={form.friends_description} onChange={(e: any) => set('friends_description', e.target.value)} rows={3} />
                    </Reveal>

                    <Reveal show={showSnack}>
                        <FieldLabel>Favorite snack</FieldLabel>
                        <FieldHint>to bribe you or withhold it later</FieldHint>
                        <LineInput placeholder="..." value={form.favorite_snack} onChange={(e: any) => set('favorite_snack', e.target.value)} />
                    </Reveal>

                    <Reveal show={showBudget}>
                        <FieldLabel>Weekly budget</FieldLabel>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-amber-400/40 font-['Cormorant_Garamond'] text-xl">€</span>
                            <LineInput type="number" placeholder="0" value={form.weekly_budget} onChange={(e: any) => set('weekly_budget', e.target.value)} />
                        </div>
                    </Reveal>

                </div>
            </div>

            <div className="mt-10">
                <PrimaryBtn onClick={onNext} disabled={!ready || saving}>
                    {saving ? 'Saving...' : 'Continue'}
                </PrimaryBtn>
            </div>
        </div>
    );
}

// --- Step 2: Kinks (cascading) ---

function KinksStep({ form, set, onNext, onBack }: any) {
    const showFavorite   = form.toys_owned.trim().length > 0;
    const showWeirdest   = form.favorite_toy.trim().length > 0;
    const showBought     = form.weirdest_object.trim().length > 0;
    const showWantToTry  = form.bought_to_impress === true;
    const ready = form.toys_owned && form.favorite_toy && form.weirdest_object && form.bought_to_impress !== null;

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="02 - Kinks" line1="Tell me about" line2="your toys." />
                <div className="space-y-8">

                    <div>
                        <Question>List all toys you own.</Question>
                        <TextArea placeholder="Be thorough..." value={form.toys_owned} onChange={(e: any) => set('toys_owned', e.target.value)} />
                    </div>

                    <Reveal show={showFavorite}>
                        <Question>Your favorite and why.</Question>
                        <TextArea placeholder="What makes it your favorite..." value={form.favorite_toy} onChange={(e: any) => set('favorite_toy', e.target.value)} rows={3} />
                    </Reveal>

                    <Reveal show={showWeirdest}>
                        <Question>Weirdest object you've used that technically wasn't a toy.</Question>
                        <TextArea placeholder="Don't be shy..." value={form.weirdest_object} onChange={(e: any) => set('weirdest_object', e.target.value)} rows={2} />
                    </Reveal>

                    <Reveal show={showBought}>
                        <Question>Have you ever bought a toy just to impress someone?</Question>
                        <div className="flex gap-3">
                            <ChoiceBtn label="Yes" active={form.bought_to_impress === true} onClick={() => set('bought_to_impress', true)} />
                            <ChoiceBtn label="No" active={form.bought_to_impress === false} onClick={() => set('bought_to_impress', false)} />
                        </div>
                    </Reveal>

                    <Reveal show={showWantToTry}>
                        <Question>One toy you want to try but are too shy to admit.</Question>
                        <TextArea placeholder="..." value={form.toy_want_to_try} onChange={(e: any) => set('toy_want_to_try', e.target.value)} rows={2} />
                    </Reveal>

                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
        </div>
    );
}

// --- Step 3: Experience (cascading) ---

function ExperienceStep({ form, set, onNext, onBack }: any) {
    const isNew = form.femdom_experience === "I'm completely new";
    const hasExp = form.femdom_experience === 'Yes, I have a lot of experience' || form.femdom_experience === 'Only a few times';
    const showDetails     = form.femdom_experience !== '';
    const showHardLimits  = form.expectations.trim().length > 0;
    const showSoftLimits  = showHardLimits && form.hard_limits.trim().length > 0;
    const showFirstExp    = hasExp && showSoftLimits && form.soft_limits.trim().length > 0;
    const showBestMoment  = showFirstExp && form.first_experience.trim().length > 0;
    const showMistakes    = showBestMoment && form.best_moment.trim().length > 0;
    const canContinue = form.femdom_experience !== '';

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="03 - Experience" line1="Where you've been" line2="shapes everything." />
                <div className="space-y-8">

                    <div>
                        <Question>Do you have any experience with online FemDom?</Question>
                        <div className="flex flex-col gap-2.5 mt-2">
                            {EXPERIENCE_OPTIONS.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.femdom_experience === opt}
                                    onClick={() => set('femdom_experience', opt)} />
                            ))}
                        </div>
                    </div>

                    <Reveal show={showDetails && hasExp}>
                        <Question>Tell me more about your experiences.</Question>
                        <TextArea placeholder="What you've done, what worked, what didn't..." value={form.expectations} onChange={(e: any) => set('expectations', e.target.value)} />
                    </Reveal>

                    <Reveal show={showDetails && isNew}>
                        <Question>Tell me about your expectations entering this.</Question>
                        <TextArea placeholder="Be honest about what you're looking for..." value={form.expectations} onChange={(e: any) => set('expectations', e.target.value)} />
                    </Reveal>

                    <Reveal show={showHardLimits}>
                        <Question>Your hard limits.</Question>
                        <TextArea placeholder="Absolute non-negotiables..." value={form.hard_limits} onChange={(e: any) => set('hard_limits', e.target.value)} rows={2} />
                    </Reveal>

                    <Reveal show={showSoftLimits}>
                        <Question>Your soft limits.</Question>
                        <TextArea placeholder="Things you'd consider with the right dynamic..." value={form.soft_limits} onChange={(e: any) => set('soft_limits', e.target.value)} rows={2} />
                    </Reveal>

                    <Reveal show={showFirstExp}>
                        <Question>Describe your first kinky experience.</Question>
                        <TextArea placeholder="How it started..." value={form.first_experience} onChange={(e: any) => set('first_experience', e.target.value)} />
                    </Reveal>

                    <Reveal show={showBestMoment}>
                        <Question>Your best submissive moment ever.</Question>
                        <TextArea placeholder="What stands out..." value={form.best_moment} onChange={(e: any) => set('best_moment', e.target.value)} />
                    </Reveal>

                    <Reveal show={showMistakes}>
                        <Question>Worst mistake you ever made in service.</Question>
                        <TextArea placeholder="Be honest..." value={form.mistakes} onChange={(e: any) => set('mistakes', e.target.value)} />
                    </Reveal>



                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!canContinue} />
        </div>
    );
}

// --- Step 4: Sliders (explosion gate + one-by-one with comments) ---

const HIGH_COMMENTS = [
    "That tells me everything I need to know.",
    "Interesting. File that away.",
    "You just made this more complicated for yourself.",
    "Now I know exactly what to withhold.",
    "That kind of answer gets you considered.",
    "Every answer makes you more readable.",
    "You lit up. I noticed.",
    "I'll remember this. You won't be able to forget it.",
    "That answers a question you didn't know I was asking.",
    "You could have lied. You didn't. Smart.",
    "More than I expected. Curious.",
    "You're more honest than most.",
    "Good. Now we have something to work with.",
    "That number reveals more than you intended.",
    "Now we're getting somewhere.",
    "Predictable. And yet still useful.",
    "You didn't hesitate. Telling.",
    "That's the kind of thing I don't forget.",
    "Strong preference. Duly noted.",
    "I was waiting for that answer.",
];

const LOW_COMMENTS = [
    "How very underwhelming.",
    "Not even a little? Almost impressive.",
    "I'll pretend that didn't happen.",
    "That hesitation says more than you think.",
    "Oh. So you're one of those.",
    "I expected more. I always do.",
    "That number is almost embarrassing.",
    "Zero points for ambition.",
    "Noted. And judged.",
    "The most boring answer you could have given.",
    "Did you even try?",
    "Low standards or low courage. Either way.",
    "We can work on that. Whether you like it or not.",
    "I'll chalk it up to inexperience. For now.",
    "Playing it safe. That tells me something too.",
    "Disappointing, but not surprising.",
    "Is that really all you have?",
    "Barely worth commenting on.",
    "I've seen more commitment from people leaving.",
    "You'll need to do better than that.",
];

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function HoldKinkButton({ label, onRelease }: { label: string; onRelease: (val: number) => void }) {
    const [liveVal, setLiveVal] = useState(0);
    const [holding, setHolding] = useState(false);
    const [done, setDone] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const valRef = useRef(0);

    const start = () => {
        if (done) return;
        valRef.current = 0;
        setLiveVal(0);
        setHolding(true);
        intervalRef.current = setInterval(() => {
            valRef.current = Math.min(100, valRef.current + 1);
            setLiveVal(valRef.current);
            if (valRef.current >= 100) stop();
        }, 28); // ~2.8s to fill fully
    };

    const stop = () => {
        if (!holding && valRef.current === 0) return;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setHolding(false);
        setDone(true);
        onRelease(valRef.current);
    };

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    // Reset when label changes (new kink)
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        valRef.current = 0;
        setLiveVal(0);
        setHolding(false);
        setDone(false);
    }, [label]);

    const pct = liveVal;

    return (
        <div className="w-full select-none">
            {/* Big % display */}
            <div className="text-center mb-6 h-16 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {!holding && !done && (
                        <motion.p key="hint"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="font-['Cormorant_Garamond'] italic text-[1rem] text-white/25">
                            Press and hold to set your level
                        </motion.p>
                    )}
                    {(holding || done) && (
                        <motion.div key="val" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-end gap-1">
                            <span className="font-['Cormorant_Garamond'] font-light text-[3.5rem] leading-none"
                                style={{ color: pct > 50 ? 'rgba(197,160,89,0.85)' : 'rgba(255,255,255,0.35)' }}>
                                {pct}
                            </span>
                            <span className="font-['Cormorant_Garamond'] text-[1.2rem] text-white/25 mb-2">%</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Hold button */}
            <div
                className="relative w-full overflow-hidden border border-white/10 cursor-pointer"
                style={{ height: 64, userSelect: 'none' }}
                onMouseDown={start}
                onMouseUp={stop}
                onMouseLeave={() => { if (holding) stop(); }}
                onTouchStart={e => { e.preventDefault(); start(); }}
                onTouchEnd={e => { e.preventDefault(); stop(); }}
            >
                {/* Fill */}
                <div
                    className="absolute inset-y-0 left-0 transition-none"
                    style={{
                        width: `${pct}%`,
                        background: pct > 50
                            ? 'rgba(197,160,89,0.18)'
                            : 'rgba(255,255,255,0.05)',
                        borderRight: pct > 0 ? '1px solid rgba(197,160,89,0.25)' : 'none',
                    }}
                />
                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-['Cormorant_Garamond'] font-light text-[1rem]"
                        style={{ color: holding ? 'rgba(197,160,89,0.7)' : done ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)' }}>
                        {done ? `${pct}% recorded` : holding ? 'Release when ready...' : 'Hold'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function SlidersStep({ form, setSlider, onNext, onBack }: any) {
    const [phase, setPhase] = useState<'gate' | 'exploding' | 'sliders'>('gate');
    const [particles, setParticles] = useState<any[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [comment, setComment] = useState<string | null>(null);
    const [commentHigh, setCommentHigh] = useState(true);
    const advTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idxRef = useRef(0);
    idxRef.current = currentIdx;

    // Non-repeating comment queues
    const highQueueRef = useRef<string[]>([]);
    const lowQueueRef = useRef<string[]>([]);

    const pickHigh = () => {
        if (highQueueRef.current.length === 0) highQueueRef.current = shuffle(HIGH_COMMENTS);
        return highQueueRef.current.shift()!;
    };
    const pickLow = () => {
        if (lowQueueRef.current.length === 0) lowQueueRef.current = shuffle(LOW_COMMENTS);
        return lowQueueRef.current.shift()!;
    };

    useEffect(() => {
        return () => { if (advTimerRef.current) clearTimeout(advTimerRef.current); };
    }, []);

    useEffect(() => {
        setComment(null);
        if (advTimerRef.current) clearTimeout(advTimerRef.current);
    }, [currentIdx]);

    const handleYes = () => {
        const ps = Array.from({ length: 26 }, (_, i) => ({
            id: i,
            dx: (Math.random() - 0.5) * 360,
            dy: (Math.random() - 0.5) * 260,
            rotate: (Math.random() - 0.5) * 800,
            w: Math.random() * 60 + 10,
            h: Math.random() * 8 + 2,
            amber: Math.random() > 0.35,
        }));
        setParticles(ps);
        setPhase('exploding');
        setTimeout(() => setPhase('sliders'), 700);
    };

    const handleRelease = (val: number, label: string) => {
        setSlider(label, val);
        const isHigh = val > 50;
        setCommentHigh(isHigh);
        setComment(isHigh ? pickHigh() : pickLow());

        advTimerRef.current = setTimeout(() => {
            setComment(null);
            const idx = idxRef.current;
            if (idx < SLIDERS.length - 1) {
                setCurrentIdx(idx + 1);
            } else {
                onNext();
            }
        }, 2400);
    };

    const currentLabel = SLIDERS[currentIdx];

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div className="flex flex-col flex-1">
                <StepHeader stepLabel="04 - Testing" line1="How far does" line2="your kink go?" />

                {/* Gate */}
                {phase === 'gate' && (
                    <div className="flex flex-col items-center text-center pt-4">
                        <p className="font-['Cormorant_Garamond'] text-[1.1rem] font-light text-white/40 leading-relaxed mb-12">
                            Ready to reveal your kink side to me?
                        </p>
                        <button onClick={handleYes}
                            className="px-12 py-4 border border-amber-500/40 bg-amber-500/[0.05] text-amber-200/80 font-['Cormorant_Garamond'] text-[1.15rem] font-light tracking-widest hover:border-amber-400/60 hover:bg-amber-500/[0.10] transition-all duration-300 cursor-pointer">
                            Yes, Queen Karin
                        </button>
                    </div>
                )}

                {/* Explosion */}
                {phase === 'exploding' && (
                    <div className="relative flex justify-center items-center" style={{ height: 60 }}>
                        {particles.map(p => (
                            <motion.div key={p.id}
                                initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scaleX: 1 }}
                                animate={{ x: p.dx, y: p.dy, opacity: 0, rotate: p.rotate, scaleX: 0.2 }}
                                transition={{ duration: 0.65, ease: 'easeOut' }}
                                style={{
                                    position: 'absolute', width: p.w, height: p.h,
                                    top: '50%', left: '50%',
                                    marginTop: -p.h / 2, marginLeft: -p.w / 2,
                                    borderRadius: 1,
                                    background: p.amber ? 'rgba(197,160,89,0.80)' : 'rgba(70,45,10,0.90)',
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Hold buttons - one at a time */}
                {phase === 'sliders' && (
                    <AnimatePresence mode="wait">
                        <motion.div key={currentIdx}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.38, ease: [0.25, 0.4, 0.25, 1] }}
                            className="flex flex-col items-center text-center flex-1"
                        >
                            {/* Kink name */}
                            <p className="font-['Cormorant_Garamond'] text-[2rem] font-light text-white/85 leading-tight mb-1">
                                {currentLabel}
                            </p>
                            <p className="font-['Cormorant_Garamond'] italic text-[0.8rem] text-white/20 mb-10">
                                {currentIdx + 1} of {SLIDERS.length}
                            </p>

                            {/* Hold button */}
                            <div className="w-full">
                                <HoldKinkButton
                                    key={currentIdx}
                                    label={currentLabel}
                                    onRelease={(val) => handleRelease(val, currentLabel)}
                                />
                            </div>

                            {/* Comment */}
                            <AnimatePresence>
                                {comment && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.35 }}
                                        className="mt-8 px-6 py-4 border-l-2 border-amber-500/25 bg-amber-500/[0.025] text-left w-full"
                                    >
                                        <p className={cn(
                                            "font-['Cormorant_Garamond'] text-[1.05rem] font-light italic leading-relaxed",
                                            commentHigh ? "text-amber-300/65" : "text-white/38"
                                        )}>
                                            {comment}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Progress dots */}
                            <div className="flex gap-1.5 mt-auto pt-10 pb-2">
                                {SLIDERS.map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300"
                                        style={{
                                            width: i === currentIdx ? 18 : 5, height: 4,
                                            background: i < currentIdx ? 'rgba(197,160,89,0.45)'
                                                : i === currentIdx ? 'rgba(197,160,89,0.85)'
                                                : 'rgba(255,255,255,0.08)',
                                        }} />
                                ))}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            {phase === 'gate' && (
                <div className="mt-10 flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
            )}
        </div>
    );
}

// --- Step 5: Tone ---

function ToneStep({ form, set, onNext, onBack }: any) {
    const select = (val: string) => {
        set('domination_tone', val);
        setTimeout(onNext, 520);
    };
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="05 - Tone" line1="What kind of dominance" line2="speaks to you?" />
                <div className="flex flex-col gap-3">
                    {TONES.map(t => (
                        <ChoiceBtn key={t} label={t} active={form.domination_tone === t} onClick={() => select(t)} />
                    ))}
                </div>
            </div>
            <div className="mt-10 flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
        </div>
    );
}

// --- Step 6: Psychology (cascading) ---

function PsychologyStep({ form, set, onNext, onBack }: any) {
    const showIgnored    = form.preference !== '';
    const showSelfReview = form.isolation_effects.trim().length > 0;
    const showPunishment = form.self_review.trim().length > 0;
    const ready = form.preference && form.isolation_effects && form.self_review && form.ideal_punishment;

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="07 - Psychology" line1="The last" line2="layer." />
                <div className="space-y-8">

                    <div>
                        <Question>What drives you more?</Question>
                        <div className="flex gap-3 mt-2">
                            {PREFERENCE_OPTIONS.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.preference === opt} onClick={() => set('preference', opt)} />
                            ))}
                        </div>
                    </div>

                    <Reveal show={showIgnored}>
                        <Question>What would being ignored for a week do to your brain?</Question>
                        <TextArea placeholder="Honestly..." value={form.isolation_effects} onChange={(e: any) => set('isolation_effects', e.target.value)} rows={3} />
                    </Reveal>

                    <Reveal show={showSelfReview}>
                        <Question>Write a fake review of yourself as a submissive.</Question>
                        <TextArea placeholder="Be critical..." value={form.self_review} onChange={(e: any) => set('self_review', e.target.value)} />
                    </Reveal>

                    <Reveal show={showPunishment}>
                        <Question>Describe your ideal punishment.</Question>
                        <TextArea placeholder="In detail..." value={form.ideal_punishment} onChange={(e: any) => set('ideal_punishment', e.target.value)} />
                    </Reveal>

                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
        </div>
    );
}

// --- Step 7: Assurance (all multiple choice, cascading) ---

function AssuranceStep({ form, set, onNext, onBack }: any) {
    const show2 = form.reason_applying !== '';
    const show3 = form.self_perception !== '';
    const show4 = form.feelings_payment !== '';
    const show5 = form.priority_aspect !== '';
    const ready = form.reason_applying && form.self_perception && form.feelings_payment && form.priority_aspect && form.motivation;

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="08 - Assurance" line1="Convince me this" line2="is worth my time." />
                <div className="space-y-8">

                    <div>
                        <Question>Why did you apply for ownership directly instead of starting from the lowest rank?</Question>
                        <div className="flex flex-col gap-2.5 mt-2">
                            {ASSURANCE_Q1.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.reason_applying === opt} onClick={() => set('reason_applying', opt)} />
                            ))}
                        </div>
                    </div>

                    <Reveal show={show2}>
                        <Question>You've obeyed every step. What do you think I see when I look at you?</Question>
                        <div className="flex flex-col gap-2.5 mt-2">
                            {ASSURANCE_Q2.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.self_perception === opt} onClick={() => set('self_perception', opt)} />
                            ))}
                        </div>
                    </Reveal>

                    <Reveal show={show3}>
                        <Question>The next step is payment - your first real act of obedience. How does that make you feel?</Question>
                        <div className="flex flex-col gap-2.5 mt-2">
                            {ASSURANCE_Q3.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.feelings_payment === opt} onClick={() => set('feelings_payment', opt)} />
                            ))}
                        </div>
                    </Reveal>

                    <Reveal show={show4}>
                        <Question>What part of this application do you hope I notice first?</Question>
                        <div className="flex flex-col gap-2.5 mt-2">
                            {ASSURANCE_Q4.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.priority_aspect === opt} onClick={() => set('priority_aspect', opt)} />
                            ))}
                        </div>
                    </Reveal>

                    <Reveal show={show5}>
                        <Question>Be honest: why do you want to finish this application?</Question>
                        <div className="flex flex-col gap-2.5 mt-2">
                            {ASSURANCE_Q5.map(opt => (
                                <ChoiceBtn key={opt} label={opt} active={form.motivation === opt} onClick={() => set('motivation', opt)} />
                            ))}
                        </div>
                    </Reveal>

                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
        </div>
    );
}

// --- Step 6: Pain tolerance ---

function PainStep({ form, set, onNext, onBack }: any) {
    const select = (val: string) => {
        set('pain_tolerance', val);
        setTimeout(onNext, 520);
    };
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="06 - Pain" line1="Where do you" line2="stand?" />
                <div className="flex flex-col gap-3">
                    {PAIN_OPTIONS.map(opt => (
                        <ChoiceBtn key={opt} label={opt} active={form.pain_tolerance === opt} onClick={() => select(opt)} />
                    ))}
                </div>
            </div>
            <div className="mt-10 flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
        </div>
    );
}

// --- Step 9: Checkout ---

function CheckoutStep({ form, set, onNext, onBack, saving, amount, setAmount }: any) {
    const [showCustom, setShowCustom] = useState(false);
    const [customVal, setCustomVal] = useState('');

    const PRESETS = [95, 199, 499];

    const selectPreset = (v: number) => {
        setShowCustom(false);
        setCustomVal('');
        setAmount(v);
    };

    const selectOther = () => {
        setShowCustom(true);
        setCustomVal('');
    };

    const handleCustomChange = (val: string) => {
        setCustomVal(val);
        const n = parseInt(val);
        if (!isNaN(n) && n >= 95) setAmount(n);
    };

    const isPreset = PRESETS.includes(amount) && !showCustom;

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="09 - Payment" line1="Application" line2="Fee." />

                <p className="font-['Cormorant_Garamond'] text-[1rem] font-light text-white/35 leading-relaxed mb-8 italic">
                    Minimum €95. Pay more if you want to be taken seriously.
                </p>

                {/* Preset buttons */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {PRESETS.map(v => (
                        <button key={v} onClick={() => selectPreset(v)}
                            className={cn(
                                "py-4 border transition-all duration-200 font-['Cormorant_Garamond'] font-normal text-[1.1rem]",
                                amount === v && !showCustom
                                    ? "border-amber-500/50 bg-amber-500/[0.07] text-amber-200/90"
                                    : "border-white/[0.07] text-white/45 hover:border-white/15"
                            )}>
                            €{v}
                        </button>
                    ))}
                </div>

                {/* Other option */}
                <button onClick={selectOther}
                    className={cn(
                        "w-full py-3.5 border transition-all duration-200 font-['Cormorant_Garamond'] font-normal text-[1rem] mb-6",
                        showCustom
                            ? "border-amber-500/50 bg-amber-500/[0.07] text-amber-200/90"
                            : "border-white/[0.07] text-white/45 hover:border-white/15"
                    )}>
                    Other amount
                </button>

                {/* Custom input */}
                <AnimatePresence>
                    {showCustom && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                            <FieldLabel>Custom amount (min €95)</FieldLabel>
                            <div className="flex items-center gap-3 mt-2 mb-1">
                                <span className="text-amber-400/40 font-['Cormorant_Garamond'] text-2xl">€</span>
                                <input type="number" min={95} placeholder="95"
                                    value={customVal}
                                    onChange={e => handleCustomChange(e.target.value)}
                                    className="bg-transparent border-b border-white/10 focus:border-amber-500/40 text-white/65 font-['Cormorant_Garamond'] text-2xl font-light py-1 outline-none w-full transition-colors"
                                    autoFocus
                                />
                            </div>
                            {customVal && parseInt(customVal) < 95 && (
                                <p className="font-['Cormorant_Garamond'] italic text-[0.85rem] text-rose-400/50 mt-1">Minimum is €95.</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="font-['Cormorant_Garamond'] italic text-[0.85rem] text-white/20">Non-refundable</p>
            </div>

            <div className="mt-10 space-y-4">
                <PrimaryBtn onClick={onNext} disabled={saving || amount < 95 || (showCustom && (!customVal || parseInt(customVal) < 95))}>
                    {saving ? 'Redirecting...' : `Submit & Pay €${amount}`}
                </PrimaryBtn>
                <div className="flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
            </div>
        </div>
    );
}
