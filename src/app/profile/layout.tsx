'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const appearance = {
    theme: 'night' as const,
    variables: {
        colorPrimary: '#c5a059',
        colorBackground: '#0d0d1a',
        colorText: '#ffffff',
        colorDanger: '#ff4444',
        fontFamily: 'Orbitron, sans-serif',
        borderRadius: '8px',
        spacingUnit: '4px',
    },
};

function PaymentForm({ email, onSuccess }: { email: string; onSuccess: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [expressReady, setExpressReady] = useState(false);

    async function handleSuccess(intentId: string) {
        await fetch('/api/paywall/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId, memberId: email }),
        }).catch(() => {});
        onSuccess();
    }

    async function confirmCard() {
        if (!stripe || !elements) return;
        setProcessing(true);
        setError('');
        const { error: err, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.href },
            redirect: 'if_required',
        });
        if (err) {
            setError(err.message || 'Payment failed');
            setProcessing(false);
            return;
        }
        if (paymentIntent?.status === 'succeeded') {
            await handleSuccess(paymentIntent.id);
        }
    }

    async function confirmExpress(event: any) {
        if (!stripe || !elements) { event?.paymentFailed?.({ reason: 'fail' }); return; }
        const { error: submitErr } = await elements.submit();
        if (submitErr) { event?.paymentFailed?.({ reason: 'fail' }); return; }
        const { error: err, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.href },
            redirect: 'if_required',
        });
        if (err) { event?.paymentFailed?.({ reason: 'fail' }); return; }
        if (paymentIntent?.status === 'succeeded') {
            await handleSuccess(paymentIntent.id);
        }
    }

    return (
        <div style={{ width: '100%' }}>
            <ExpressCheckoutElement
                onConfirm={confirmExpress}
                options={{ paymentMethods: { googlePay: 'never', link: 'auto' } }}
                onReady={(e: any) => {
                    const methods = e?.availablePaymentMethods;
                    setExpressReady(!!(methods && Object.keys(methods).length > 0));
                }}
            />
            {expressReady && (
                <div style={{ textAlign: 'center', fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '3px', margin: '16px 0' }}>
                    OR PAY BY CARD
                </div>
            )}
            <PaymentElement />
            {error && (
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.4rem', color: '#ff4444', marginTop: 12, textAlign: 'center' }}>
                    {error}
                </div>
            )}
            <button
                onClick={confirmCard}
                disabled={processing || !stripe}
                style={{ width: '100%', marginTop: 20, padding: '16px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 10, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '3px', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1, boxShadow: '0 8px 30px rgba(197,160,89,0.3)' }}
            >
                {processing ? 'PROCESSING...' : 'CONFIRM PAYMENT'}
            </button>
        </div>
    );
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const [silenced, setSilenced] = useState(false);
    const [silenceReason, setSilenceReason] = useState('');
    const [paywalled, setPaywalled] = useState(false);
    const [paywallReason, setPaywallReason] = useState('');
    const [paywallAmount, setPaywallAmount] = useState(0);
    const [email, setEmail] = useState('');
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('__silenced') === '1') {
            setSilenced(true);
            setSilenceReason(sessionStorage.getItem('__silenceReason') || '');
        }
        if (sessionStorage.getItem('__paywalled') === '1') {
            setPaywalled(true);
            setPaywallReason(sessionStorage.getItem('__paywallReason') || '');
            setPaywallAmount(Number(sessionStorage.getItem('__paywallAmount') || '0'));
        }

        let active = true;
        let pollInterval: ReturnType<typeof setInterval> | null = null;
        let realtimeChannel: any = null;

        function applyFromRow(fresh: any, userEmail: string) {
            if (!active) return;
            // Silence
            if (fresh.silence === true) {
                const reason = fresh.parameters?.silence_reason || '';
                sessionStorage.setItem('__silenced', '1');
                sessionStorage.setItem('__silenceReason', reason);
                setSilenced(true);
                setSilenceReason(reason);
            } else {
                sessionStorage.removeItem('__silenced');
                sessionStorage.removeItem('__silenceReason');
                setSilenced(false);
            }
            // Paywall
            const paywall = fresh.parameters?.paywall;
            if (paywall?.active) {
                const reason = paywall.reason || '';
                const amount = paywall.amount || 0;
                sessionStorage.setItem('__paywalled', '1');
                sessionStorage.setItem('__paywallReason', reason);
                sessionStorage.setItem('__paywallAmount', String(amount));
                setPaywalled(true);
                setPaywallReason(reason);
                setPaywallAmount(amount);
            } else {
                sessionStorage.removeItem('__paywalled');
                sessionStorage.removeItem('__paywallReason');
                sessionStorage.removeItem('__paywallAmount');
                setPaywalled(false);
            }
        }

        async function init() {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const userEmail = session?.user?.email;
                if (!userEmail || !active) return;
                setEmail(userEmail);
                const emailLower = userEmail.toLowerCase();

                async function check() {
                    try {
                        const res = await fetch('/api/silence-check', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ memberId: userEmail }),
                        });
                        const data = await res.json();
                        if (!active) return;

                        if (data.silence === true) {
                            sessionStorage.setItem('__silenced', '1');
                            sessionStorage.setItem('__silenceReason', data.reason || '');
                            setSilenced(true);
                            setSilenceReason(data.reason || '');
                        } else {
                            sessionStorage.removeItem('__silenced');
                            sessionStorage.removeItem('__silenceReason');
                            setSilenced(false);
                        }

                        if (data.paywall === true) {
                            sessionStorage.setItem('__paywalled', '1');
                            sessionStorage.setItem('__paywallReason', data.paywallReason || '');
                            sessionStorage.setItem('__paywallAmount', String(data.paywallAmount || 0));
                            setPaywalled(true);
                            setPaywallReason(data.paywallReason || '');
                            setPaywallAmount(data.paywallAmount || 0);
                        } else {
                            sessionStorage.removeItem('__paywalled');
                            sessionStorage.removeItem('__paywallReason');
                            sessionStorage.removeItem('__paywallAmount');
                            setPaywalled(false);
                        }
                    } catch {}
                }

                // Initial check on load
                await check();

                // ── Realtime subscription — fires INSTANTLY when admin updates the profile ──
                // No row filter: avoids case-sensitive eq() mismatch. Filter in JS below.
                realtimeChannel = supabase
                    .channel('layout-lock-' + emailLower)
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
                        const fresh = payload.new;
                        if (!fresh) return;
                        if ((fresh.member_id || '').toLowerCase() !== emailLower) return;
                        applyFromRow(fresh, emailLower);
                    })
                    .subscribe();

                // Poll every 15s as fallback only — Realtime handles instant updates
                pollInterval = setInterval(() => { if (active) check(); }, 15000);
            } catch {}
        }

        init();
        return () => {
            active = false;
            if (pollInterval) clearInterval(pollInterval);
            if (realtimeChannel) {
                try { createClient().removeChannel(realtimeChannel); } catch {}
            }
        };
    }, []);

    async function handlePayNow() {
        setLoading(true);
        try {
            const res = await fetch('/api/stripe/paywall-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: email }),
            });
            const data = await res.json();
            if (data.clientSecret) setClientSecret(data.clientSecret);
        } catch {}
        setLoading(false);
    }

    function handleSuccess() {
        sessionStorage.removeItem('__paywalled');
        sessionStorage.removeItem('__paywallReason');
        sessionStorage.removeItem('__paywallAmount');
        setPaid(true);
        setPaywalled(false);
        window.location.reload();
    }

    if (silenced) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(8,2,2,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="rgba(220,60,60,0.7)">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.68L5.68 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.68L18.32 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z" />
                    </svg>
                </div>
                <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: 'rgba(220,60,60,0.6)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>ACCESS REVOKED</div>
                <div style={{ background: 'rgba(220,60,60,0.04)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 14, padding: '28px 24px' }}>
                    <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(220,60,60,0.4)', letterSpacing: '3px', marginBottom: 12 }}>MESSAGE FROM QUEEN KARIN</div>
                    <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.05rem', color: '#fff', lineHeight: 1.6, letterSpacing: '0.5px' }}>{silenceReason}</div>
                </div>
            </div>
        </div>
    );

    if (paywalled && !paid) return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(2,5,18,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
            <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
                {!clientSecret ? (
                    <>
                        <div style={{ fontFamily: 'Cinzel,serif', fontSize: '2rem', color: '#c5a059', marginBottom: 8 }}>✦</div>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.55rem', color: 'rgba(197,160,89,0.5)', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24 }}>ACCESS SUSPENDED</div>
                        <div style={{ background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.25)', borderRadius: 14, padding: '28px 24px', marginBottom: 28 }}>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.38rem', color: 'rgba(197,160,89,0.45)', letterSpacing: '3px', marginBottom: 12 }}>MESSAGE FROM QUEEN KARIN</div>
                            <div style={{ fontFamily: 'Cinzel,serif', fontSize: '1.05rem', color: '#fff', lineHeight: 1.6, letterSpacing: '0.5px' }}>{paywallReason}</div>
                            <div style={{ height: 1, background: 'linear-gradient(to right,transparent,rgba(197,160,89,0.2),transparent)', margin: '20px 0' }}></div>
                            <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '1.4rem', color: '#c5a059', fontWeight: 700, letterSpacing: '2px' }}>€{Number(paywallAmount).toFixed(2)}</div>
                        </div>
                        <button onClick={handlePayNow} disabled={loading} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg,#c5a059,#8b6914)', border: 'none', borderRadius: 10, color: '#000', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '3px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 8px 30px rgba(197,160,89,0.3)' }}>
                            {loading ? 'LOADING...' : 'PAY NOW'}
                        </button>
                        <div style={{ fontFamily: 'Orbitron,sans-serif', fontSize: '0.35rem', color: 'rgba(255,255,255,0.15)', letterSpacing: '1px', marginTop: 16 }}>Secure payment via Stripe</div>
                    </>
                ) : (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                        <PaymentForm email={email} onSuccess={handleSuccess} />
                    </Elements>
                )}
            </div>
        </div>
    );

    return <>{children}</>;
}
