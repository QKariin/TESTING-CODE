"use client";

import { useState } from 'react';
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

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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

const TOTAL_STEPS = 8;

// --- Shared UI ---

function GoldDivider() {
    return <div className="w-8 h-px bg-gradient-to-r from-amber-500/60 to-transparent mb-8 mt-1" />;
}

// Short label (Name, Email, Amount) - stays small uppercase
function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[0.58rem] tracking-[4px] text-amber-400/35 uppercase font-[Raleway] mb-1">{children}</p>;
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

function LineInput({ placeholder, value, onChange, type = 'text' }: any) {
    return (
        <input type={type}
            className="w-full bg-transparent border-b border-white/10 focus:border-amber-500/40 text-white/65 font-['Cormorant_Garamond'] text-base font-light py-2 outline-none transition-colors duration-300 placeholder:text-white/15 mt-0"
            placeholder={placeholder} value={value} onChange={onChange} autoComplete="off"
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
            "w-full px-4 py-3.5 text-left border transition-all duration-200 font-['Cormorant_Garamond'] text-[1rem] font-light",
            active
                ? "border-amber-500/35 bg-amber-500/[0.05] text-amber-200/80"
                : "border-white/[0.06] bg-white/[0.01] text-white/40 hover:border-white/12"
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
            <p className="text-[0.58rem] tracking-[4px] text-white/20 font-[Raleway] uppercase mb-8">{stepLabel}</p>
            <h2 className="font-[Cinzel] font-light text-[1.7rem] text-white leading-snug mb-1 tracking-wide">{line1}</h2>
            <h2 className="font-[Cinzel] font-light text-[1.7rem] leading-snug mb-8 tracking-wide">
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
                input[type=range] { -webkit-appearance:none; appearance:none; height:1px; background:rgba(255,255,255,0.1); outline:none; width:100%; cursor:pointer; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:#c5a059; border:none; }
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
            `}</style>

            <AnimatedBackground />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/60 pointer-events-none z-[1]" />

            <div className="relative z-10 w-full max-w-md min-h-screen flex flex-col px-8 pt-16 pb-12">

                {step > 0 && step < 9 && (
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
                        {step === 8 && <PainStep form={form} set={set} onNext={handleCheckout} onBack={() => goTo(7 as Step)} saving={saving} amount={form.amount} setAmount={(v: number) => set('amount', v)} />}

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
                        <span className="text-[0.5rem] tracking-[4px] text-amber-400/50 font-[Raleway] uppercase">Ownership Application</span>
                    </div>
                    <h1 className="font-[Cinzel] font-light text-[2.4rem] leading-[1.2] text-white mb-2 tracking-wide">
                        You are applying
                    </h1>
                    <h1 className="font-[Cinzel] font-light text-[2.4rem] leading-[1.2] mb-10 tracking-wide">
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
                        <LineInput placeholder="Your name..." value={form.name} onChange={(e: any) => set('name', e.target.value)} />
                    </div>

                    <Reveal show={showEmail}>
                        <FieldLabel>Email</FieldLabel>
                        <LineInput type="email" placeholder="your@email.com" value={form.email} onChange={(e: any) => set('email', e.target.value)} />
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

// --- Step 4: Sliders ---

function SlidersStep({ form, set, setSlider, onNext, onBack }: any) {
    const confirmed = form.ready_for_sliders === 'Yes, Queen Karin';
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="04 - Testing" line1="How far does" line2="your kink go?" />

                {!confirmed ? (
                    <div>
                        <p className="font-['Cormorant_Garamond'] text-[1.05rem] font-light text-white/40 leading-relaxed mb-7">
                            Ready to tell me more about your kink side?
                        </p>
                        <ChoiceBtn label="Yes, Queen Karin"
                            active={form.ready_for_sliders === 'Yes, Queen Karin'}
                            onClick={() => set('ready_for_sliders', 'Yes, Queen Karin')} />
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-7">
                        <p className="font-['Cormorant_Garamond'] text-[1rem] font-light italic text-white/30 mb-2">
                            Slide to reflect your genuine interest level.
                        </p>
                        {SLIDERS.map(label => (
                            <div key={label}>
                                <div className="flex justify-between items-center mb-3">
                                    <p className="font-['Cormorant_Garamond'] text-[0.95rem] text-white/50 font-light">{label}</p>
                                    <p className="text-[0.62rem] tracking-[2px] text-amber-400/50 font-[Raleway]">{form.sliders[label]}%</p>
                                </div>
                                <input type="range" min={0} max={100} value={form.sliders[label]}
                                    onChange={e => setSlider(label, parseInt(e.target.value))} />
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
            <StepNav onNext={onNext} onBack={onBack} disabled={!confirmed} />
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

// --- Step 8: Pain + Checkout ---

function PainStep({ form, set, onNext, onBack, saving, amount, setAmount }: any) {
    const ready = form.pain_tolerance !== '';

    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <StepHeader stepLabel="08 - Pain" line1="Where do you" line2="stand?" />

                <div className="flex flex-col gap-3 mb-12">
                    {PAIN_OPTIONS.map(opt => (
                        <ChoiceBtn key={opt} label={opt} active={form.pain_tolerance === opt} onClick={() => set('pain_tolerance', opt)} />
                    ))}
                </div>

                {ready && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <div className="pt-8 border-t border-white/[0.06]">
                            <h3 className="font-[Cinzel] font-light text-[1.3rem] text-white mb-1 tracking-wide">Application Fee</h3>
                            <div className="w-8 h-px bg-gradient-to-r from-amber-500/50 to-transparent mb-6 mt-1" />
                            <p className="font-['Cormorant_Garamond'] text-[1rem] font-light text-white/35 leading-relaxed mb-7 italic">
                                Minimum €95. Pay more if you want to be taken seriously.
                            </p>
                            <FieldLabel>Amount (€)</FieldLabel>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-amber-400/40 font-['Cormorant_Garamond'] text-2xl">€</span>
                                <input type="number" min={95} value={amount}
                                    onChange={e => setAmount(Math.max(95, parseInt(e.target.value) || 95))}
                                    className="bg-transparent border-b border-white/10 focus:border-amber-500/40 text-white/65 font-['Cormorant_Garamond'] text-2xl font-light py-1 outline-none w-28 transition-colors" />
                            </div>
                            <p className="text-[0.52rem] tracking-[3px] text-white/15 font-[Raleway] uppercase mt-3">Non-refundable</p>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="mt-10 space-y-4">
                <PrimaryBtn onClick={onNext} disabled={!ready || saving}>
                    {saving ? 'Redirecting...' : `Submit & Pay €${amount}`}
                </PrimaryBtn>
                <div className="flex justify-center"><GhostBtn onClick={onBack}>Back</GhostBtn></div>
            </div>
        </div>
    );
}
