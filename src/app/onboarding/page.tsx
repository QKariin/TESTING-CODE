"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';

// ─── Animated background shapes (from HeroGeometric) ─────────────────────────

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
            <motion.div
                animate={{ y: [0, 15, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                style={{ width, height }}
                className="relative"
            >
                <div className={cn(
                    "absolute inset-0 rounded-full bg-gradient-to-r to-transparent",
                    gradient,
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

const COUNTRIES = [
    'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Belgium','Brazil','Bulgaria',
    'Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Finland',
    'France','Germany','Greece','Hungary','India','Indonesia','Iran','Ireland','Israel','Italy',
    'Japan','Jordan','Kenya','South Korea','Latvia','Lithuania','Malaysia','Mexico','Netherlands',
    'New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania',
    'Russia','Saudi Arabia','Serbia','Singapore','Slovakia','Slovenia','South Africa','Spain',
    'Sweden','Switzerland','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom',
    'United States','Venezuela','Vietnam','Other',
];

const SUB_TYPES = [
    { id: 'findom',      label: 'Financial Submission',  desc: 'Tributes, wallets, coin sacrifices' },
    { id: 'tasks',       label: 'Task-Based Obedience',  desc: 'Daily assignments, proof submission' },
    { id: 'humiliation', label: 'Humiliation & Control', desc: 'Commands, degradation, denial' },
    { id: 'service',     label: 'Service Submission',    desc: 'Serving, caretaking, devotion' },
    { id: 'worship',     label: 'Worship & Devotion',    desc: 'Kneeling rituals, adoration' },
    { id: 'all',         label: 'All of the Above',      desc: 'Full submission across all categories' },
];

type Step = 'welcome' | 'identity' | 'about' | 'type' | 'done';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const [step, setStep] = useState<Step>('welcome');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [age, setAge] = useState('');
    const [country, setCountry] = useState('');
    const [countrySearch, setCountrySearch] = useState('');
    const [showCountryList, setShowCountryList] = useState(false);
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
                parameters: { ...existingParams, age: age ? parseInt(age) : null, country: country || null, sub_types: subTypes, onboarding_seen: true },
            };
            if (photoUrl) updates.avatar_url = photoUrl;
            await supabase.from('profiles').update(updates).eq('id', userId);
            setStep('done');
            setTimeout(() => { window.location.href = '/profile'; }, 2000);
        } catch { setSaving(false); }
    };

    const filteredCountries = COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()));

    const fadeIn: Variants = {
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
    };

    if (loading) return (
        <div className="min-h-screen bg-[#030303] flex items-center justify-center">
            <div className="w-9 h-9 rounded-full border border-amber-500/20 border-t-amber-500/80 animate-spin" />
        </div>
    );

    return (
        <div className="relative min-h-screen bg-[#030303] flex items-start justify-center overflow-hidden font-[Rajdhani,sans-serif]">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Orbitron:wght@400;700&family=Rajdhani:wght@400;500;600&display=swap');
                input:focus { border-color: rgba(197,160,89,0.5) !important; outline: none; }
                input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
                .ob-tap:active { opacity: 0.75; }
            `}</style>

            <AnimatedBackground />

            {/* bottom + top fade overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/70 pointer-events-none z-[1]" />

            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />

            <motion.div
                key={step}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="relative z-10 w-full max-w-md px-7 pt-14 pb-12 flex flex-col min-h-screen"
            >
                {step === 'welcome' && <WelcomeStep onNext={() => setStep('identity')} />}
                {step === 'identity' && (
                    <IdentityStep name={name} setName={setName} photoPreview={photoPreview}
                        photoUploading={photoUploading} onPhotoClick={() => fileRef.current?.click()}
                        onNext={() => setStep('about')} />
                )}
                {step === 'about' && (
                    <AboutStep age={age} setAge={setAge} country={country} setCountry={setCountry}
                        countrySearch={countrySearch} setCountrySearch={setCountrySearch}
                        showCountryList={showCountryList} setShowCountryList={setShowCountryList}
                        filteredCountries={filteredCountries}
                        onNext={() => setStep('type')} onBack={() => setStep('identity')} />
                )}
                {step === 'type' && (
                    <TypeStep subTypes={subTypes} toggle={toggleSubType}
                        onNext={handleFinish} onBack={() => setStep('about')} saving={saving} />
                )}
                {step === 'done' && <DoneStep />}
            </motion.div>
        </div>
    );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
    return <p className="font-[Orbitron] text-[0.45rem] tracking-[3px] text-amber-400/50 uppercase mb-3">{children}</p>;
}
function Divider() {
    return <div className="w-9 h-px bg-amber-500/30 mb-6" />;
}
function ProgressDots({ total, current }: { total: number; current: number }) {
    return (
        <div className="flex gap-1.5 mb-7">
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="h-1 rounded-full transition-all duration-300"
                    style={{ width: i === current ? 24 : 8, background: i <= current ? '#c5a059' : 'rgba(255,255,255,0.12)' }} />
            ))}
        </div>
    );
}
function Btn({ children, onClick, disabled, variant = 'primary', className = '' }: any) {
    return (
        <button onClick={onClick} disabled={disabled}
            className={cn(
                "px-4 py-3.5 rounded-md font-[Orbitron] text-[0.52rem] font-bold tracking-[2px] transition-opacity duration-150 disabled:cursor-not-allowed",
                variant === 'primary' && "w-full bg-gradient-to-r from-amber-500 to-amber-700 text-black",
                variant === 'ghost' && "border border-amber-500/25 text-amber-400/60 bg-transparent",
                className
            )}
        >{children}</button>
    );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div className="flex-1 flex flex-col justify-center py-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.23, 0.86, 0.39, 0.96] }}
                    className="mb-8"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-amber-500/20 mb-8">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                        <span className="font-[Orbitron] text-[0.42rem] tracking-[3px] text-amber-400/60 uppercase">Access Granted</span>
                    </div>

                    <h1 className="font-[Cinzel] text-[2rem] leading-tight text-white font-normal tracking-wide mb-2">
                        You found<br />
                        <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400 bg-clip-text text-transparent">
                            your place.
                        </span>
                    </h1>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                >
                    <Divider />
                    <p className="text-[0.95rem] text-white/50 leading-relaxed mb-5">
                        Most never get this far. You did — and that means something.
                    </p>
                    <p className="text-[0.95rem] text-white/50 leading-relaxed mb-5">
                        This space was built for those who understand that real submission is a privilege, not a game. What happens here is private, intentional, and completely under my control.
                    </p>
                    <p className="text-[0.95rem] text-amber-400/60 leading-relaxed">
                        Before you step in — let me know who you are.
                    </p>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
            >
                <Btn onClick={onNext}>I AM READY</Btn>
            </motion.div>
        </div>
    );
}

function IdentityStep({ name, setName, photoPreview, photoUploading, onPhotoClick, onNext }: any) {
    const ready = name.trim().length >= 2 && photoPreview;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <ProgressDots total={3} current={0} />
                <Label>Step 1 of 3</Label>
                <h2 className="font-[Orbitron] text-sm text-white tracking-[2px] mb-4">IDENTIFY YOURSELF</h2>
                <Divider />

                {/* Photo */}
                <div className="mb-6">
                    <p className="font-[Orbitron] text-[0.42rem] tracking-[2px] text-amber-400/55 uppercase mb-1 flex items-center gap-2">
                        PHOTO <span className="text-red-400/70 text-[0.55rem]">required</span>
                    </p>
                    <p className="text-xs text-white/25 leading-relaxed mb-3">
                        Visible in global feed, leaderboard, and presence strip. Use something from your private world.
                    </p>
                    <div className="flex items-center gap-4">
                        <div onClick={onPhotoClick} className="ob-tap w-[76px] h-[76px] rounded-full overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center border border-amber-500/25 bg-amber-500/[0.03]">
                            {photoPreview
                                ? <img src={photoPreview} className="w-full h-full object-cover" alt="" />
                                : <i className="fas fa-camera text-amber-400/40 text-lg" />}
                        </div>
                        <div>
                            <p className="text-[0.82rem] mb-1" style={{ color: photoPreview ? 'rgba(100,210,100,0.7)' : 'rgba(255,255,255,0.25)' }}>
                                {photoUploading ? 'Uploading...' : photoPreview ? 'Photo selected' : 'No photo selected'}
                            </p>
                            <button onClick={onPhotoClick} className="text-xs text-white/35 border border-white/10 rounded px-2.5 py-1 cursor-pointer bg-transparent">
                                {photoPreview ? 'Change' : 'Upload photo'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Name */}
                <div>
                    <p className="font-[Orbitron] text-[0.42rem] tracking-[2px] text-amber-400/55 uppercase mb-1 flex items-center gap-2">
                        YOUR NAME <span className="text-red-400/70 text-[0.55rem]">required</span>
                    </p>
                    <p className="text-xs text-white/25 leading-relaxed mb-2.5">
                        How the Queen and other members will address you. Visible on the leaderboard. Do not use your real name.
                    </p>
                    <input
                        className="w-full bg-white/[0.04] border border-white/10 text-white font-[Rajdhani] text-base px-3.5 py-2.5 rounded-md"
                        type="text" placeholder="Enter a name..." maxLength={30}
                        value={name} onChange={e => setName(e.target.value)} autoComplete="off"
                    />
                </div>
            </div>
            <div className="mt-8">
                <Btn onClick={onNext} disabled={!ready} className={!ready ? 'opacity-30' : ''}>CONTINUE</Btn>
                <p className="text-[0.7rem] text-white/12 text-center mt-3">Both photo and name are required to proceed.</p>
            </div>
        </div>
    );
}

function AboutStep({ age, setAge, country, setCountry, countrySearch, setCountrySearch, showCountryList, setShowCountryList, filteredCountries, onNext, onBack }: any) {
    const ready = age && parseInt(age) >= 18 && country;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <ProgressDots total={3} current={1} />
                <Label>Step 2 of 3</Label>
                <h2 className="font-[Orbitron] text-sm text-white tracking-[2px] mb-4">ABOUT YOU</h2>
                <Divider />

                <div className="mb-6">
                    <p className="font-[Orbitron] text-[0.42rem] tracking-[2px] text-amber-400/55 uppercase mb-2 flex items-center gap-2">
                        AGE <span className="text-red-400/70 text-[0.55rem]">required · must be 18+</span>
                    </p>
                    <input
                        className="w-full bg-white/[0.04] border border-white/10 text-white font-[Rajdhani] text-base px-3.5 py-2.5 rounded-md"
                        type="number" placeholder="Your age" min={18} max={99}
                        value={age} onChange={e => setAge(e.target.value)}
                    />
                    {age && parseInt(age) < 18 && (
                        <p className="text-red-400 text-xs mt-1.5">You must be 18 or older to access this space.</p>
                    )}
                </div>

                <div className="relative">
                    <p className="font-[Orbitron] text-[0.42rem] tracking-[2px] text-amber-400/55 uppercase mb-2 flex items-center gap-2">
                        COUNTRY <span className="text-red-400/70 text-[0.55rem]">required</span>
                    </p>
                    <input
                        className="w-full bg-white/[0.04] border border-white/10 text-white font-[Rajdhani] text-base px-3.5 py-2.5 rounded-md"
                        type="text" placeholder="Search your country..." autoComplete="off"
                        value={countrySearch || country}
                        onChange={e => { setCountrySearch(e.target.value); setCountry(''); setShowCountryList(true); }}
                        onFocus={() => setShowCountryList(true)}
                    />
                    {showCountryList && filteredCountries.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-[#111] border border-amber-500/20 rounded-md z-50 max-h-48 overflow-y-auto">
                            {filteredCountries.slice(0, 8).map((c: string) => (
                                <div key={c} className="ob-tap px-3.5 py-2.5 text-sm text-white/55 border-b border-white/[0.05] cursor-pointer hover:text-white/80"
                                    onClick={() => { setCountry(c); setCountrySearch(c); setShowCountryList(false); }}>
                                    {c}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex gap-2.5 mt-8">
                <Btn variant="ghost" onClick={onBack} className="flex-none px-5">BACK</Btn>
                <Btn onClick={onNext} disabled={!ready} className={cn("flex-1", !ready && "opacity-30")}>CONTINUE</Btn>
            </div>
        </div>
    );
}

function TypeStep({ subTypes, toggle, onNext, onBack, saving }: any) {
    const ready = subTypes.length > 0;
    return (
        <div className="flex flex-col flex-1 justify-between">
            <div>
                <ProgressDots total={3} current={2} />
                <Label>Step 3 of 3</Label>
                <h2 className="font-[Orbitron] text-sm text-white tracking-[2px] mb-4">WHAT DRAWS YOU HERE</h2>
                <Divider />
                <p className="text-sm text-white/40 leading-relaxed mb-5">Select everything that applies. This helps me understand what you are looking for.</p>
                <div className="flex flex-col gap-2.5">
                    {SUB_TYPES.map(type => {
                        const active = subTypes.includes(type.id);
                        return (
                            <div key={type.id} onClick={() => toggle(type.id)}
                                className={cn("ob-tap px-4 py-3.5 rounded-lg cursor-pointer border transition-all duration-200",
                                    active ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"
                                )}>
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-[18px] h-[18px] rounded-full border flex-shrink-0 flex items-center justify-center transition-all",
                                        active ? "border-amber-400 bg-amber-400" : "border-white/20 bg-transparent"
                                    )}>
                                        {active && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                    </div>
                                    <div>
                                        <p className={cn("text-[0.88rem] font-semibold tracking-[0.5px]", active ? "text-amber-400" : "text-white/75")}>{type.label}</p>
                                        <p className="text-[0.72rem] text-white/30 mt-0.5">{type.desc}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="flex gap-2.5 mt-8">
                <Btn variant="ghost" onClick={onBack} className="flex-none px-5">BACK</Btn>
                <Btn onClick={onNext} disabled={!ready || saving} className={cn("flex-1", (!ready || saving) && "opacity-30")}>
                    {saving ? 'SAVING...' : 'ENTER THE SPACE'}
                </Btn>
            </div>
        </div>
    );
}

function DoneStep() {
    return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}
                className="text-amber-400 text-4xl mb-5 font-[Cinzel]">✦</motion.div>
            <h2 className="font-[Orbitron] text-sm text-white tracking-[2px] mb-4">YOUR RECORD IS SET</h2>
            <div className="w-9 h-px bg-amber-500/30 mb-6 mx-auto" />
            <p className="text-sm text-white/40 leading-relaxed">Welcome. Your station is being prepared.</p>
            <p className="text-xs text-amber-400/40 mt-2">Entering now...</p>
        </div>
    );
}
