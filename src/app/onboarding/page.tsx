"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

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
    { id: 'findom', label: 'Financial Submission', desc: 'Tributes, wallets, coin sacrifices' },
    { id: 'tasks', label: 'Task-Based Obedience', desc: 'Daily assignments, proof submission' },
    { id: 'humiliation', label: 'Humiliation & Control', desc: 'Commands, degradation, denial' },
    { id: 'service', label: 'Service Submission', desc: 'Serving, caretaking, devotion' },
    { id: 'worship', label: 'Worship & Devotion', desc: 'Kneeling rituals, adoration' },
    { id: 'all', label: 'All of the Above', desc: 'Full submission across all categories' },
];

type Step = 'welcome' | 'identity' | 'about' | 'type' | 'done';

export default function OnboardingPage() {
    const [step, setStep] = useState<Step>('welcome');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Fields
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

            // Check if already onboarded (has a real name set)
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, parameters')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.parameters?.onboarding_seen === true) {
                window.location.href = '/profile';
                return;
            }

            setLoading(false);
        };
        init();
    }, []);

    const handlePhotoSelect = async (file: File) => {
        const preview = URL.createObjectURL(file);
        setPhotoPreview(preview);
        setPhotoUploading(true);

        try {
            const { uploadToSupabase } = await import('@/scripts/mediaSupabase');
            const url = await uploadToSupabase('media', 'avatars', file);
            setPhotoUrl(url.startsWith('failed') ? null : url);
        } catch {
            setPhotoUrl(null);
        }
        setPhotoUploading(false);
    };

    const toggleSubType = (id: string) => {
        setSubTypes(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleFinish = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            const supabase = createClient();
            const { data: profile } = await supabase
                .from('profiles')
                .select('parameters')
                .eq('id', userId)
                .maybeSingle();

            const existingParams = profile?.parameters || {};
            const updates: any = {
                name: name.trim(),
                parameters: {
                    ...existingParams,
                    age: age ? parseInt(age) : null,
                    country: country || null,
                    sub_types: subTypes,
                    onboarding_seen: true,
                },
            };
            if (photoUrl) updates.avatar_url = photoUrl;

            await supabase.from('profiles').update(updates).eq('id', userId);
            setStep('done');
            setTimeout(() => { window.location.href = '/profile'; }, 2000);
        } catch {
            setSaving(false);
        }
    };

    const filteredCountries = COUNTRIES.filter(c =>
        c.toLowerCase().includes(countrySearch.toLowerCase())
    );

    if (loading) return (
        <div style={styles.page}>
            <div style={styles.spinner} />
        </div>
    );

    return (
        <div style={styles.page}>
            <style>{css}</style>
            <input
                ref={fileRef} type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }}
            />

            {step === 'welcome' && <WelcomeStep onNext={() => setStep('identity')} />}

            {step === 'identity' && (
                <IdentityStep
                    name={name} setName={setName}
                    photoPreview={photoPreview} photoUploading={photoUploading}
                    onPhotoClick={() => fileRef.current?.click()}
                    onNext={() => setStep('about')}
                />
            )}

            {step === 'about' && (
                <AboutStep
                    age={age} setAge={setAge}
                    country={country} setCountry={setCountry}
                    countrySearch={countrySearch} setCountrySearch={setCountrySearch}
                    showCountryList={showCountryList} setShowCountryList={setShowCountryList}
                    filteredCountries={filteredCountries}
                    onNext={() => setStep('type')}
                    onBack={() => setStep('identity')}
                />
            )}

            {step === 'type' && (
                <TypeStep
                    subTypes={subTypes}
                    toggle={toggleSubType}
                    onNext={handleFinish}
                    onBack={() => setStep('about')}
                    saving={saving}
                />
            )}

            {step === 'done' && <DoneStep />}
        </div>
    );
}

// ─── STEPS ────────────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <div style={styles.card}>
            <div style={styles.crown}>✦</div>
            <div style={styles.label}>PRIVATE ACCESS GRANTED</div>
            <h1 style={styles.title}>Welcome to<br />Queen Karin's Space</h1>
            <div style={styles.divider} />
            <p style={styles.body}>
                Your tribute has been received. This is not a public platform — it is a private, curated space built for submission, discipline, and devotion.
            </p>
            <p style={styles.body}>
                Before you enter, I need to know who you are. This will take less than a minute.
            </p>
            <p style={{ ...styles.body, color: 'rgba(197,160,89,0.6)', fontSize: '0.8rem' }}>
                Your name and photo will appear in the global presence feed and leaderboard — visible to all members. Choose wisely.
            </p>
            <button style={styles.btn} onClick={onNext}>BEGIN</button>
        </div>
    );
}

function IdentityStep({ name, setName, photoPreview, photoUploading, onPhotoClick, onNext }: any) {
    const ready = name.trim().length >= 2 && photoPreview;
    return (
        <div style={styles.card}>
            <div style={styles.progress}><ProgressDots total={3} current={0} /></div>
            <div style={styles.label}>STEP 1 OF 3</div>
            <h2 style={styles.stepTitle}>IDENTIFY YOURSELF</h2>
            <div style={styles.divider} />

            {/* Photo */}
            <div style={styles.field}>
                <div style={styles.fieldLabel}>PHOTO <span style={styles.required}>required</span></div>
                <div style={styles.fieldHint}>Visible in global feed, leaderboard, and presence strip. Use something from your private world.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                    <div
                        style={{ ...styles.avatar, ...(photoPreview ? {} : styles.avatarEmpty) }}
                        onClick={onPhotoClick}
                        className="ob-tap"
                    >
                        {photoPreview
                            ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <i className="fas fa-camera" style={{ color: 'rgba(197,160,89,0.4)', fontSize: '1.2rem' }} />
                        }
                    </div>
                    <div>
                        <div style={{ fontSize: '0.82rem', color: photoPreview ? 'rgba(100,210,100,0.7)' : 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>
                            {photoUploading ? 'Uploading...' : photoPreview ? 'Photo selected' : 'No photo selected'}
                        </div>
                        <button style={styles.smallBtn} onClick={onPhotoClick}>
                            {photoPreview ? 'Change photo' : 'Upload photo'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Name */}
            <div style={styles.field}>
                <div style={styles.fieldLabel}>YOUR NAME <span style={styles.required}>required</span></div>
                <div style={styles.fieldHint}>How the Queen and other members will address you. Visible on the leaderboard. Do not use your real name.</div>
                <input
                    style={styles.input}
                    type="text"
                    placeholder="Enter a name..."
                    maxLength={30}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="off"
                />
            </div>

            <button
                style={{ ...styles.btn, opacity: ready ? 1 : 0.3 }}
                disabled={!ready}
                onClick={onNext}
            >
                CONTINUE
            </button>
            <div style={styles.hint}>Both photo and name are required to proceed.</div>
        </div>
    );
}

function AboutStep({ age, setAge, country, setCountry, countrySearch, setCountrySearch, showCountryList, setShowCountryList, filteredCountries, onNext, onBack }: any) {
    const ready = age && parseInt(age) >= 18 && country;
    return (
        <div style={styles.card}>
            <div style={styles.progress}><ProgressDots total={3} current={1} /></div>
            <div style={styles.label}>STEP 2 OF 3</div>
            <h2 style={styles.stepTitle}>ABOUT YOU</h2>
            <div style={styles.divider} />

            {/* Age */}
            <div style={styles.field}>
                <div style={styles.fieldLabel}>AGE <span style={styles.required}>required · must be 18+</span></div>
                <input
                    style={styles.input}
                    type="number"
                    placeholder="Your age"
                    min={18}
                    max={99}
                    value={age}
                    onChange={e => setAge(e.target.value)}
                />
                {age && parseInt(age) < 18 && (
                    <div style={{ color: '#e05252', fontSize: '0.75rem', marginTop: '6px' }}>You must be 18 or older to access this space.</div>
                )}
            </div>

            {/* Country */}
            <div style={{ ...styles.field, position: 'relative' }}>
                <div style={styles.fieldLabel}>COUNTRY <span style={styles.required}>required</span></div>
                <input
                    style={styles.input}
                    type="text"
                    placeholder="Search your country..."
                    value={countrySearch || country}
                    onChange={e => { setCountrySearch(e.target.value); setCountry(''); setShowCountryList(true); }}
                    onFocus={() => setShowCountryList(true)}
                    autoComplete="off"
                />
                {showCountryList && filteredCountries.length > 0 && (
                    <div style={styles.dropdown}>
                        {filteredCountries.slice(0, 8).map((c: string) => (
                            <div
                                key={c}
                                style={styles.dropdownItem}
                                className="ob-tap"
                                onClick={() => { setCountry(c); setCountrySearch(c); setShowCountryList(false); }}
                            >
                                {c}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button style={{ ...styles.btn, ...styles.backBtn }} onClick={onBack}>BACK</button>
                <button
                    style={{ ...styles.btn, flex: 1, opacity: ready ? 1 : 0.3 }}
                    disabled={!ready}
                    onClick={onNext}
                >
                    CONTINUE
                </button>
            </div>
        </div>
    );
}

function TypeStep({ subTypes, toggle, onNext, onBack, saving }: any) {
    const ready = subTypes.length > 0;
    return (
        <div style={styles.card}>
            <div style={styles.progress}><ProgressDots total={3} current={2} /></div>
            <div style={styles.label}>STEP 3 OF 3</div>
            <h2 style={styles.stepTitle}>WHAT DRAWS YOU HERE</h2>
            <div style={styles.divider} />
            <p style={{ ...styles.body, marginBottom: '20px' }}>Select everything that applies. This helps me understand what you are looking for.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                {SUB_TYPES.map(type => (
                    <div
                        key={type.id}
                        style={{
                            ...styles.typeCard,
                            ...(subTypes.includes(type.id) ? styles.typeCardActive : {}),
                        }}
                        className="ob-tap"
                        onClick={() => toggle(type.id)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '18px', height: '18px', borderRadius: '50%',
                                border: `1.5px solid ${subTypes.includes(type.id) ? '#c5a059' : 'rgba(255,255,255,0.2)'}`,
                                background: subTypes.includes(type.id) ? '#c5a059' : 'transparent',
                                flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {subTypes.includes(type.id) && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#000' }} />}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.88rem', color: subTypes.includes(type.id) ? '#c5a059' : 'rgba(255,255,255,0.75)', fontWeight: 600, letterSpacing: '0.5px' }}>{type.label}</div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{type.desc}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{ ...styles.btn, ...styles.backBtn }} onClick={onBack}>BACK</button>
                <button
                    style={{ ...styles.btn, flex: 1, opacity: ready ? 1 : 0.3 }}
                    disabled={!ready || saving}
                    onClick={onNext}
                >
                    {saving ? 'SAVING...' : 'ENTER THE SPACE'}
                </button>
            </div>
        </div>
    );
}

function DoneStep() {
    return (
        <div style={{ ...styles.card, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px', color: '#c5a059' }}>✦</div>
            <h2 style={styles.stepTitle}>YOUR RECORD IS SET</h2>
            <div style={styles.divider} />
            <p style={styles.body}>Welcome. Your station is being prepared.</p>
            <p style={{ ...styles.body, color: 'rgba(197,160,89,0.5)', fontSize: '0.78rem' }}>Entering now...</p>
        </div>
    );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
    return (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{
                    height: '4px',
                    width: i === current ? '24px' : '8px',
                    borderRadius: '2px',
                    background: i <= current ? '#c5a059' : 'rgba(255,255,255,0.12)',
                    transition: 'all 0.3s',
                }} />
            ))}
        </div>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100svh',
        background: '#050403',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0 0 40px',
        fontFamily: "'Rajdhani', sans-serif",
    },
    card: {
        width: '100%',
        maxWidth: '460px',
        padding: '52px 28px 40px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100svh',
    },
    crown: {
        fontSize: '1.4rem',
        color: '#c5a059',
        marginBottom: '20px',
        fontFamily: "'Cinzel', serif",
    },
    label: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '0.45rem',
        letterSpacing: '3px',
        color: 'rgba(197,160,89,0.5)',
        marginBottom: '12px',
        textTransform: 'uppercase',
    },
    title: {
        fontFamily: "'Cinzel', serif",
        fontSize: '1.4rem',
        color: '#fff',
        fontWeight: 400,
        letterSpacing: '1px',
        margin: '0 0 16px',
        lineHeight: 1.4,
    },
    stepTitle: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '0.75rem',
        color: '#fff',
        letterSpacing: '2px',
        margin: '0 0 14px',
    },
    divider: {
        width: '36px',
        height: '1px',
        background: '#c5a059',
        opacity: 0.35,
        marginBottom: '22px',
    },
    body: {
        fontSize: '0.92rem',
        color: 'rgba(255,255,255,0.42)',
        lineHeight: 1.75,
        margin: '0 0 14px',
    },
    btn: {
        width: '100%',
        padding: '14px',
        background: 'linear-gradient(135deg,#c5a059,#8b6914)',
        border: 'none',
        color: '#000',
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '0.52rem',
        fontWeight: 700,
        letterSpacing: '2px',
        cursor: 'pointer',
        borderRadius: '6px',
        marginTop: '8px',
        transition: 'opacity 0.15s',
    },
    backBtn: {
        width: 'auto',
        flex: 'none',
        paddingLeft: '18px',
        paddingRight: '18px',
        background: 'transparent',
        border: '1px solid rgba(197,160,89,0.25)',
        color: 'rgba(197,160,89,0.6)',
    },
    smallBtn: {
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.7rem',
        padding: '5px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: "'Rajdhani', sans-serif",
    },
    field: {
        marginBottom: '22px',
    },
    fieldLabel: {
        fontFamily: "'Orbitron', sans-serif",
        fontSize: '0.42rem',
        letterSpacing: '2px',
        color: 'rgba(197,160,89,0.55)',
        marginBottom: '8px',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    fieldHint: {
        fontSize: '0.78rem',
        color: 'rgba(255,255,255,0.25)',
        lineHeight: 1.55,
        marginBottom: '10px',
    },
    required: {
        color: 'rgba(224,82,82,0.7)',
        fontSize: '0.55rem',
        letterSpacing: '1px',
    },
    input: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#fff',
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: '1rem',
        padding: '11px 14px',
        borderRadius: '6px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    avatar: {
        width: '76px',
        height: '76px',
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'pointer',
    },
    avatarEmpty: {
        border: '1.5px solid rgba(197,160,89,0.25)',
        background: 'rgba(197,160,89,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: '#111',
        border: '1px solid rgba(197,160,89,0.2)',
        borderRadius: '6px',
        zIndex: 100,
        maxHeight: '200px',
        overflowY: 'auto',
    },
    dropdownItem: {
        padding: '10px 14px',
        fontSize: '0.9rem',
        color: 'rgba(255,255,255,0.6)',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    typeCard: {
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        background: 'rgba(255,255,255,0.02)',
    },
    typeCardActive: {
        border: '1px solid rgba(197,160,89,0.4)',
        background: 'rgba(197,160,89,0.06)',
    },
    hint: {
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.12)',
        textAlign: 'center',
        marginTop: '10px',
    },
    progress: {
        marginBottom: '0',
    },
    spinner: {
        width: '36px',
        height: '36px',
        border: '1px solid rgba(197,160,89,0.2)',
        borderTopColor: '#c5a059',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: 'auto',
        marginTop: '50vh',
    },
};

const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Orbitron:wght@400;700&family=Rajdhani:wght@400;500;600&display=swap');
    * { box-sizing: border-box; }
    .ob-tap:active { opacity: 0.75; }
    input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
    input:focus { border-color: rgba(197,160,89,0.5) !important; }
    @keyframes spin { to { transform: rotate(360deg); } }
`;
