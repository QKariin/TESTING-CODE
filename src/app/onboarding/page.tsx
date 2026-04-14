"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';

// ─── Animated shapes background ───────────────────────────────────────────────

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

// ─── Data ─────────────────────────────────────────────────────────────────────

const SUB_TYPES = [
    { id: 'findom',      label: 'Financial Submission',  desc: 'Tributes, wallets, coin sacrifices' },
    { id: 'tasks',       label: 'Task-Based Obedience',  desc: 'Daily assignments, proof submission' },
    { id: 'humiliation', label: 'Humiliation & Control', desc: 'Commands, degradation, denial' },
    { id: 'service',     label: 'Service Submission',    desc: 'Serving, caretaking, devotion' },
    { id: 'worship',     label: 'Worship & Devotion',    desc: 'Kneeling rituals, adoration' },
    { id: 'all',         label: 'All of the Above',      desc: 'Full submission across all categories' },
];

type Step = 'welcome' | 'identity' | 'about' | 'type' | 'done';
const STEP_ORDER: Step[] = ['welcome', 'identity', 'about', 'type', 'done'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const [step, setStep] = useState<Step>('welcome');
    const [direction, setDirection] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [age, setAge] = useState('');
    const [country, setCountry] = useState('');
    const [subTypes, setSubTypes] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const init = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/login'; return; }
            setUserId(user.id);
            const { data: profile } = await supabase.from('profiles').select('parameters').eq('id', user.id).maybeSingle();
            if (profile?.parameters?.onboarding_seen === true) { window.location.href = '/profile'; return; }
            setLoading(false);
        };
        init();
    }, []);

    const goTo = (next: Step) => {
        const curr = STEP_ORDER.indexOf(step);
        const nxt = STEP_ORDER.indexOf(next);
        setDirection(nxt > curr ? 1 : -1);
        setStep(next);
    };

    const handlePhotoSelect = async (file: File) => {
        setPhotoPreview(URL.createObjectURL(file));
        setPhotoUploading(true);
        try {
            const { uploadToSupabase } = await import('@/scripts/mediaSupabase');
            const url = await uploadToSupabase('media', 'avatars', file);
            setPhotoUrl(url.startsWith('failed') ? null : url);
        } catch { setPhotoUrl(null); }
        setPhotoUploading(false);
    };

    const toggleSubType = (id: string) =>
        setSubTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleFinish = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            const supabase = createClient();
            const { data: profile } = await supabase.from('profiles').select('parameters').eq('id', userId).maybeSingle();
            const existingParams = profile?.parameters || {};
            const updates: any = {
                name: name.trim(),
                age: age ? parseInt(age) : null,
                country: country.trim() || null,
                sub_types: subTypes,
                parameters: { ...existingParams, onboarding_seen: true },
            };
            if (photoUrl) updates.avatar_url = photoUrl;
            await supabase.from('profiles').update(updates).eq('id', userId);
            goTo('done');
            setTimeout(() => { window.location.href = '/profile'; }, 2200);
        } catch { setSaving(false); }
    };

    const variants: Variants = {
        enter: (d: number) => ({ opacity: 0, x: d > 0 ? 48 : -48 }),
        center: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.25, 0.4, 0.25, 1] } },
        exit: (d: number) => ({ opacity: 0, x: d > 0 ? -48 : 48, transition: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] } }),
    };

    if (loading) return (
        <div className="min-h-screen bg-[#030303] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-amber-500/20 border-t-amber-500/70 animate-spin" />
        </div>
    );

    const stepIndex = STEP_ORDER.indexOf(step);
    const showDots = step !== 'welcome' && step !== 'done';

    return (
        <div className="relative min-h-screen bg-[#030303] flex items-start justify-center overflow-hidden">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@300;400;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Raleway:wght@300;400;500&display=swap');
                * { box-sizing: border-box; }
                .ob-input { width:100%; background:transparent; border:none; border-bottom: 1px solid rgba(197,160,89,0.25); color:#fff; font-family:'Raleway',sans-serif; font-size:1rem; font-weight:300; padding:10px 0; letter-spacing:1px; outline:none; transition: border-color 0.3s; }
                .ob-input::placeholder { color: rgba(255,255,255,0.2); font-weight:300; }
                .ob-input:focus { border-bottom-color: rgba(197,160,89,0.7); }
                .ob-tap:active { opacity: 0.7; }
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
            `}</style>

            <AnimatedBackground />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/60 pointer-events-none z-[1]" />

            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />

            <div className="relative z-10 w-full max-w-md min-h-screen flex flex-col px-8 pt-16 pb-12">

                {/* Progress dots */}
                {showDots && (
                    <div className="flex gap-2 mb-12">
                        {(['identity', 'about', 'type'] as Step[]).map((s, i) => (
                            <div key={s} className="h-px flex-1 transition-all duration-500"
                                style={{ background: STEP_ORDER.indexOf(step) > STEP_ORDER.indexOf(s) - 1 + 1 ? 'rgba(197,160,89,0.7)' : 'rgba(255,255,255,0.1)' }} />
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex flex-col flex-1"
                    >
                        {step === 'welcome'  && <WelcomeStep  onNext={() => goTo('identity')} />}
                        {step === 'identity' && <IdentityStep name={name} setName={setName} photoPreview={photoPreview} photoUploading={photoUploading} onPhotoClick={() => fileRef.current?.click()} onNext={() => goTo('about')} onBack={() => goTo('welcome')} />}
                        {step === 'about'    && <AboutStep    age={age} setAge={setAge} country={country} setCountry={setCountry} onNext={() => goTo('type')} onBack={() => goTo('identity')} />}
                        {step === 'type'     && <TypeStep     subTypes={subTypes} toggle={toggleSubType} onNext={handleFinish} onBack={() => goTo('about')} saving={saving} />}
                        {step === 'done'     && <DoneStep />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function GoldDivider() {
    return <div className="w-8 h-px bg-gradient-to-r from-amber-500/60 to-transparent mb-8 mt-1" />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[0.6rem] tracking-[4px] text-amber-400/40 uppercase font-[Raleway] mb-3">{children}</p>;
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

// ─── Steps ────────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div className="flex-1 flex flex-col justify-center">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}>
                    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 border border-amber-500/20 bg-amber-500/[0.03] mb-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                        <span className="text-[0.5rem] tracking-[4px] text-amber-400/50 font-[Raleway] uppercase">Access Granted</span>
                    </div>

                    <h1 className="font-[Cinzel] font-light text-[2.4rem] leading-[1.2] text-white mb-2 tracking-wide">
                        You found
                    </h1>
                    <h1 className="font-[Cinzel] font-light text-[2.4rem] leading-[1.2] mb-10 tracking-wide">
                        <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400/80 bg-clip-text text-transparent">
                            your place.
                        </span>
                    </h1>
                    <GoldDivider />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35 }}
                    className="space-y-5">
                    <p className="font-['Cormorant_Garamond'] text-[1.15rem] font-light text-white/55 leading-relaxed italic">
                        Most never get this far. You did — and that means something.
                    </p>
                    <p className="font-['Cormorant_Garamond'] text-[1.15rem] font-light text-white/45 leading-relaxed">
                        This space was built for those who understand that real submission is a privilege, not a game. What happens here is private, intentional, and completely under my control.
                    </p>
                    <p className="font-['Cormorant_Garamond'] text-[1.05rem] font-light text-amber-300/50 leading-relaxed">
                        Before you step in — let me know who you are.
                    </p>
                </motion.div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-12">
                <PrimaryBtn onClick={onNext}>I am ready</PrimaryBtn>
            </motion.div>
        </div>
    );
}

function IdentityStep({ name, setName, photoPreview, photoUploading, onPhotoClick, onNext, onBack }: any) {
    const ready = name.trim().length >= 2 && photoPreview && !photoUploading;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <p className="text-[0.58rem] tracking-[4px] text-white/20 font-[Raleway] uppercase mb-8">01 — Identity</p>
                <h2 className="font-[Cinzel] font-light text-[1.7rem] text-white leading-snug mb-1 tracking-wide">Who are you</h2>
                <h2 className="font-[Cinzel] font-light text-[1.7rem] leading-snug mb-8 tracking-wide">
                    <span className="bg-gradient-to-r from-amber-300 to-amber-500/70 bg-clip-text text-transparent">in this world?</span>
                </h2>
                <GoldDivider />

                {/* Photo */}
                <div className="mb-10">
                    <FieldLabel>Your Photo</FieldLabel>
                    <div className="flex items-center gap-5">
                        <div onClick={onPhotoClick}
                            className="ob-tap w-20 h-20 rounded-full overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center border border-amber-500/20 bg-white/[0.02] transition-all hover:border-amber-500/40">
                            {photoPreview
                                ? <img src={photoPreview} className="w-full h-full object-cover" alt="" />
                                : <i className="fas fa-camera text-amber-400/30 text-base" />}
                        </div>
                        <div>
                            <p className="font-['Cormorant_Garamond'] text-base font-light leading-relaxed mb-2"
                                style={{ color: photoPreview ? 'rgba(150,220,150,0.6)' : 'rgba(255,255,255,0.25)' }}>
                                {photoUploading ? 'Uploading...' : photoPreview ? 'Looking good.' : 'No photo yet'}
                            </p>
                            <button onClick={onPhotoClick}
                                className="text-[0.6rem] tracking-[3px] text-white/25 border-b border-white/10 uppercase font-[Raleway] pb-0.5 cursor-pointer bg-transparent hover:text-white/40 transition-colors">
                                {photoPreview ? 'Change' : 'Upload'}
                            </button>
                            <p className="font-['Cormorant_Garamond'] text-[0.8rem] text-white/20 mt-2 leading-relaxed">
                                Visible to other members. Use something from your private world.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Name */}
                <div>
                    <FieldLabel>Your Name</FieldLabel>
                    <input className="ob-input" type="text" placeholder="The name you go by here..."
                        maxLength={30} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
                    <p className="font-['Cormorant_Garamond'] text-[0.82rem] text-white/20 mt-3 leading-relaxed">
                        This is how the Queen and other members will know you. Not your real name.
                    </p>
                </div>
            </div>

            <div className="mt-10 space-y-4">
                <PrimaryBtn onClick={onNext} disabled={!ready}>Continue</PrimaryBtn>
                <div className="flex justify-center"><GhostBtn onClick={onBack}>← Back</GhostBtn></div>
            </div>
        </div>
    );
}

function AboutStep({ age, setAge, country, setCountry, onNext, onBack }: any) {
    const ready = age && parseInt(age) >= 18 && country.trim().length >= 2;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <p className="text-[0.58rem] tracking-[4px] text-white/20 font-[Raleway] uppercase mb-8">02 — About You</p>
                <h2 className="font-[Cinzel] font-light text-[1.7rem] text-white leading-snug mb-1 tracking-wide">Tell me</h2>
                <h2 className="font-[Cinzel] font-light text-[1.7rem] leading-snug mb-8 tracking-wide">
                    <span className="bg-gradient-to-r from-amber-300 to-amber-500/70 bg-clip-text text-transparent">a little more.</span>
                </h2>
                <GoldDivider />

                <div className="mb-10">
                    <FieldLabel>Your Age</FieldLabel>
                    <input className="ob-input" type="number" placeholder="Must be 18 or older"
                        min={18} max={99} value={age} onChange={e => setAge(e.target.value)} />
                    {age && parseInt(age) < 18 && (
                        <p className="text-rose-400/60 font-['Cormorant_Garamond'] text-sm mt-2">You must be 18 or older to enter.</p>
                    )}
                </div>

                <div>
                    <FieldLabel>Where are you from</FieldLabel>
                    <input className="ob-input" type="text" placeholder="Your country..."
                        value={country} onChange={e => setCountry(e.target.value)} autoComplete="off" />
                </div>
            </div>

            <div className="mt-10 space-y-4">
                <PrimaryBtn onClick={onNext} disabled={!ready}>Continue</PrimaryBtn>
                <div className="flex justify-center"><GhostBtn onClick={onBack}>← Back</GhostBtn></div>
            </div>
        </div>
    );
}

function TypeStep({ subTypes, toggle, onNext, onBack, saving }: any) {
    const ready = subTypes.length > 0;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <p className="text-[0.58rem] tracking-[4px] text-white/20 font-[Raleway] uppercase mb-8">03 — Your Nature</p>
                <h2 className="font-[Cinzel] font-light text-[1.7rem] text-white leading-snug mb-1 tracking-wide">What draws</h2>
                <h2 className="font-[Cinzel] font-light text-[1.7rem] leading-snug mb-8 tracking-wide">
                    <span className="bg-gradient-to-r from-amber-300 to-amber-500/70 bg-clip-text text-transparent">you to this?</span>
                </h2>
                <GoldDivider />
                <p className="font-['Cormorant_Garamond'] text-[1.05rem] font-light text-white/35 leading-relaxed mb-7">
                    Select everything that applies. Be honest — this is private.
                </p>

                <div className="space-y-2.5">
                    {SUB_TYPES.map(type => {
                        const active = subTypes.includes(type.id);
                        return (
                            <div key={type.id} onClick={() => toggle(type.id)}
                                className={cn(
                                    "ob-tap flex items-center gap-4 px-4 py-3.5 border cursor-pointer transition-all duration-200",
                                    active ? "border-amber-500/35 bg-amber-500/[0.05]" : "border-white/[0.06] bg-white/[0.01] hover:border-white/10"
                                )}>
                                <div className={cn("w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-all",
                                    active ? "border-amber-400/70 bg-amber-500/20" : "border-white/15"
                                )}>
                                    {active && <div className="w-1.5 h-1.5 bg-amber-400" />}
                                </div>
                                <div>
                                    <p className={cn("text-[0.88rem] tracking-wide font-[Raleway] font-medium transition-colors",
                                        active ? "text-amber-300/90" : "text-white/55")}>{type.label}</p>
                                    <p className="text-[0.72rem] text-white/20 font-['Cormorant_Garamond'] mt-0.5">{type.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-10 space-y-4">
                <PrimaryBtn onClick={onNext} disabled={!ready || saving}>
                    {saving ? 'Entering...' : 'Enter the Space'}
                </PrimaryBtn>
                <div className="flex justify-center"><GhostBtn onClick={onBack}>← Back</GhostBtn></div>
            </div>
        </div>
    );
}

function DoneStep() {
    return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.23, 0.86, 0.39, 0.96] }}
                className="font-[Cinzel] text-5xl text-amber-400/70 mb-8">✦</motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
                <h2 className="font-[Cinzel] font-light text-2xl text-white tracking-widest mb-4">Welcome.</h2>
                <div className="w-8 h-px bg-amber-500/30 mx-auto mb-6" />
                <p className="font-['Cormorant_Garamond'] text-lg font-light text-white/40 leading-relaxed">
                    Your place has been prepared.
                </p>
                <p className="text-[0.58rem] tracking-[4px] text-amber-400/30 font-[Raleway] uppercase mt-4">Entering now...</p>
            </motion.div>
        </div>
    );
}
