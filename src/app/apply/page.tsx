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
    return <p className="font-['Cormorant_Garamond'] italic text-[0.88rem] text-amber-400/50 mb-1">{children}</p>;
}

// Full question text - readable Cormorant
function Question({ children }: { children: React.ReactNode }) {
    return <p className="font-['Cormorant_Garamond'] text-[1.1rem] font-light text-white/65 leading-relaxed mb-4">{children}</p>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
    return <p className="font-['Cormorant_Garamond'] italic text-[0.9rem] text-white/28 mb-3 leading-snug">{children}</p>;
}

function PrimaryBtn({ children, onClick, disabled }: any) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-full py-4 bg-gradient-to-r from-amber-600/90 to-amber-800/90 text-black/90 text-[0.58rem] tracking-[4px] font-[Raleway] font-semibold uppercase transition-opacity duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90">
            {children}
        </button>
    );
}

function GhostBtn({ children, onClick }: any) {
    return (
        <button onClick={onClick}
            className="text-[0.6rem] tracking-[3px] text-white/25 uppercase font-[Raleway] hover:text-white/40 transition-colors duration-200">
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
            "w-full px-4 py-3.5 text-left border transition-all duration-200 font-['Cormorant_Garamond'] font-normal text-[1rem] tracking-normal",
            active
                ? "border-amber-500/40 bg-amber-500/[0.06] text-amber-200/85"
                : "border-white/[0.07] bg-white/[0.01] text-white/45 hover:border-white/14"
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
                        {step === 6 && <PsychologyStep form={form} set={set} onNext={() => goTo(7)} onBack={() => goTo(5 as Step)} />}
                        {step === 7 && <AssuranceStep form={form} set={set} onNext={() => goTo(8)} onBack={() => goTo(6 as Step)} />}
                        {step === 8 && <PainStep form={form} set={set} onNext={() => goTo(9)} onBack={() => goTo(7 as Step)} />}
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
    "Noted. We'll use that.",
    "Oh... interesting.",
    "I see you.",
    "Good to know.",
    "That explains a lot.",
    "Fascinating.",
    "Bold choice.",
    "I approve.",
    "You surprise me.",
    "Keep going.",
];

function getLowComment(label: string) {
    const opts = [
        `What a shame.`,
        `Oh no - you don't like ${label}?`,
        `How... underwhelming.`,
        `Disappointing.`,
        `Is that all?`,
        `I expected more from you.`,
        `${label}? Really? Nothing?`,
        `We'll work on that.`,
        `How boring.`,
        `Not even a little?`,
    ];
    return opts[Math.floor(Math.random() * opts.length)];
}

function SlidersStep({ form, setSlider, onNext, onBack }: any) {
    const [phase, setPhase] = useState<'gate' | 'exploding' | 'sliders'>('gate');
    const [particles, setParticles] = useState<any[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [comment, setComment] = useState<string | null>(null);
    const [commentHigh, setCommentHigh] = useState(true);
    const [interacted, setInteracted] = useState(false);
    const [prevHigh, setPrevHigh] = useState<boolean | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idxRef = useRef(0);

    const currentLabel = SLIDERS[currentIdx];
    const currentValue = form.sliders[currentLabel] ?? 50;

    // Keep ref in sync with state
    idxRef.current = currentIdx;

    // Clean up timer on unmount
    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    // Reset state when advancing to next slider
    useEffect(() => {
        setInteracted(false);
        setComment(null);
        setPrevHigh(null);
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

    const handleSliderChange = (val: number, label: string) => {
        setSlider(label, val);

        const isHigh = val > 50;

        // Only update comment text when direction changes or first interaction
        setPrevHigh(prev => {
            if (prev === null || isHigh !== prev) {
                setCommentHigh(isHigh);
                if (isHigh) {
                    setComment(HIGH_COMMENTS[Math.floor(Math.random() * HIGH_COMMENTS.length)]);
                } else {
                    setComment(getLowComment(label));
                }
                return isHigh;
            }
            return prev;
        });
        setInteracted(true);

        // Debounce: reset timer each time slider moves, advance 2.2s after last movement
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setComment(null);
            const idx = idxRef.current;
            if (idx < SLIDERS.length - 1) {
                setCurrentIdx(idx + 1);
            } else {
                onNext();
            }
        }, 2200);
    };

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div className="flex flex-col flex-1">
                <StepHeader stepLabel="04 - Testing" line1="How far does" line2="your kink go?" />

                {/* Gate phase */}
                {phase === 'gate' && (
                    <div className="flex flex-col items-center text-center pt-4">
                        <p className="font-['Cormorant_Garamond'] text-[1.1rem] font-light text-white/40 leading-relaxed mb-12">
                            Ready to reveal your kink side to me?
                        </p>
                        <button
                            onClick={handleYes}
                            className="relative px-12 py-4 border border-amber-500/40 bg-amber-500/[0.05] text-amber-200/80 font-['Cormorant_Garamond'] text-[1.15rem] font-light tracking-widest hover:border-amber-400/60 hover:bg-amber-500/[0.10] transition-all duration-300 cursor-pointer"
                        >
                            Yes, Queen Karin
                        </button>
                    </div>
                )}

                {/* Explosion phase */}
                {phase === 'exploding' && (
                    <div className="relative flex justify-center items-center" style={{ height: 60 }}>
                        {particles.map(p => (
                            <motion.div
                                key={p.id}
                                initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scaleX: 1 }}
                                animate={{ x: p.dx, y: p.dy, opacity: 0, rotate: p.rotate, scaleX: 0.2 }}
                                transition={{ duration: 0.65, ease: 'easeOut' }}
                                style={{
                                    position: 'absolute',
                                    width: p.w,
                                    height: p.h,
                                    top: '50%',
                                    left: '50%',
                                    marginTop: -p.h / 2,
                                    marginLeft: -p.w / 2,
                                    borderRadius: 1,
                                    background: p.amber
                                        ? 'rgba(197,160,89,0.80)'
                                        : 'rgba(70,45,10,0.90)',
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Sliders phase - ONE at a time */}
                {phase === 'sliders' && (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIdx}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.38, ease: [0.25, 0.4, 0.25, 1] }}
                            className="flex flex-col items-center text-center flex-1"
                        >
                            {/* Kink name */}
                            <p className="font-['Cormorant_Garamond'] text-[2rem] font-light text-white/85 leading-tight mb-1 tracking-wide">
                                {currentLabel}
                            </p>
                            <p className="font-[Raleway] text-[0.5rem] tracking-[4px] text-white/18 uppercase mb-10">
                                {currentIdx + 1} of {SLIDERS.length}
                            </p>

                            {/* Current value display */}
                            <div className="mb-6">
                                <span className="font-['Cormorant_Garamond'] text-[3rem] font-light leading-none"
                                    style={{ color: currentValue > 50 ? 'rgba(197,160,89,0.75)' : 'rgba(255,255,255,0.25)' }}>
                                    {currentValue}
                                </span>
                                <span className="font-[Raleway] text-[0.65rem] tracking-[2px] text-white/20 ml-1 align-top mt-3 inline-block">%</span>
                            </div>

                            {/* Slider */}
                            <div className="w-full px-1 mb-2">
                                <style>{`
                                    .kink-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; outline: none; cursor: pointer; background: transparent; }
                                    .kink-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: rgba(197,160,89,0.9); cursor: pointer; border: 2px solid rgba(197,160,89,0.35); box-shadow: 0 0 14px rgba(197,160,89,0.35), 0 2px 8px rgba(0,0,0,0.5); transition: box-shadow 0.15s; }
                                    .kink-slider::-webkit-slider-thumb:hover { box-shadow: 0 0 20px rgba(197,160,89,0.55), 0 2px 8px rgba(0,0,0,0.5); }
                                    .kink-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: rgba(197,160,89,0.9); cursor: pointer; border: 2px solid rgba(197,160,89,0.35); box-shadow: 0 0 14px rgba(197,160,89,0.35); }
                                    .kink-slider-track { position: relative; height: 2px; width: 100%; }
                                    .kink-slider-bg { position: absolute; inset: 0; background: rgba(255,255,255,0.07); }
                                    .kink-slider-fill { position: absolute; top: 0; left: 0; height: 100%; background: rgba(197,160,89,0.55); transition: width 0.05s; }
                                `}</style>
                                <div className="kink-slider-track mb-0">
                                    <div className="kink-slider-bg" />
                                    <div className="kink-slider-fill" style={{ width: `${currentValue}%` }} />
                                </div>
                                <input
                                    type="range" min={0} max={100}
                                    value={currentValue}
                                    onChange={e => handleSliderChange(parseInt(e.target.value), currentLabel)}
                                    className="kink-slider"
                                    style={{ marginTop: -11 }}
                                />
                                <div className="flex justify-between mt-2">
                                    <span className="font-[Raleway] text-[0.5rem] tracking-[3px] text-white/18 uppercase">None</span>
                                    <span className="font-[Raleway] text-[0.5rem] tracking-[3px] text-white/18 uppercase">Obsessed</span>
                                </div>
                            </div>

                            {/* Comment bubble */}
                            <AnimatePresence>
                                {comment && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.35 }}
                                        className="mt-8 px-6 py-4 border-l-2 border-amber-500/25 bg-amber-500/[0.025] text-left max-w-xs"
                                    >
                                        <p className={cn(
                                            "font-['Cormorant_Garamond'] text-[1.05rem] font-light italic leading-relaxed",
                                            commentHigh ? "text-amber-300/60" : "text-white/35"
                                        )}>
                                            {comment}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Progress dots */}
                            <div className="flex gap-1.5 mt-auto pt-10 pb-2">
                                {SLIDERS.map((_, i) => (
                                    <div key={i}
                                        className="rounded-full transition-all duration-300"
                                        style={{
                                            width: i === currentIdx ? 18 : 5,
                                            height: 4,
                                            background: i < currentIdx
                                                ? 'rgba(197,160,89,0.45)'
                                                : i === currentIdx
                                                    ? 'rgba(197,160,89,0.85)'
                                                    : 'rgba(255,255,255,0.08)',
                                        }}
                                    />
                                ))}
                            </div>

                            {!interacted && (
                                <p className="font-['Cormorant_Garamond'] italic text-[0.82rem] text-white/20 mt-3">
                                    Move the slider to continue
                                </p>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            {phase === 'gate' && (
                <div className="mt-10">
                    <div className="flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
                </div>
            )}
        </div>
    );
}

// --- Step 5: Tone ---

function ToneStep({ form, set, onNext, onBack }: any) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="05 - Tone" line1="What kind of dominance" line2="speaks to you?" />
                <div className="flex flex-col gap-3">
                    {TONES.map(t => (
                        <ChoiceBtn key={t} label={t} active={form.domination_tone === t} onClick={() => set('domination_tone', t)} />
                    ))}
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!form.domination_tone} />
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
                <StepHeader stepLabel="06 - Psychology" line1="The last" line2="layer." />
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
                <StepHeader stepLabel="07 - Assurance" line1="Convince me this" line2="is worth my time." />
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

// --- Step 8: Pain tolerance ---

function PainStep({ form, set, onNext, onBack }: any) {
    const ready = form.pain_tolerance !== '';

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="08 - Pain" line1="Where do you" line2="stand?" />
                <div className="flex flex-col gap-3">
                    {PAIN_OPTIONS.map(opt => (
                        <ChoiceBtn key={opt} label={opt} active={form.pain_tolerance === opt} onClick={() => set('pain_tolerance', opt)} />
                    ))}
                </div>
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!ready} />
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
