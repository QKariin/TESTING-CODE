import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'Privacy Policy for Queen Karin — how I collect, use, and protect your personal data.',
};

const S = {
    page: { minHeight: '100vh', background: '#020202', color: '#fff', padding: '0 20px 80px' } as const,
    container: { maxWidth: 720, margin: '0 auto', paddingTop: 100 } as const,
    h1: { fontFamily: 'Cinzel, serif', fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 600, letterSpacing: '4px', color: '#fff', marginBottom: 8, textAlign: 'center' as const },
    subtitle: { fontFamily: 'Rajdhani, sans-serif', fontSize: '0.65rem', fontWeight: 500, color: 'rgba(197,160,89,0.5)', letterSpacing: '6px', textAlign: 'center' as const, marginBottom: 48 },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 600, letterSpacing: '2px', color: 'rgba(197,160,89,0.8)', marginTop: 40, marginBottom: 12 },
    p: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.85rem', lineHeight: 1.9, color: 'rgba(255,255,255,0.45)', fontWeight: 300, marginBottom: 16 },
    ul: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.85rem', lineHeight: 2, color: 'rgba(255,255,255,0.45)', fontWeight: 300, paddingLeft: 20, marginBottom: 16 },
    divider: { height: 1, background: 'rgba(197,160,89,0.08)', margin: '32px 0' },
    contact: { fontFamily: 'Rajdhani, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textAlign: 'center' as const, marginTop: 48 },
};

export default function PrivacyPage() {
    return (
        <div style={S.page}>
            <div style={S.container}>
                <h1 style={S.h1}>PRIVACY POLICY</h1>
                <p style={S.subtitle}>LAST UPDATED: JULY 22, 2026</p>

                <h2 style={S.h2}>1. WHO I AM</h2>
                <p style={S.p}>
                    This website is operated exclusively by Queen Karin (&quot;I,&quot; &quot;me,&quot; &quot;my&quot;). This Privacy Policy explains how I collect, use, and protect your personal information when you join and use my platform and services. By using this site, you agree to the terms described below.
                </p>

                <div style={S.divider} />

                <h2 style={S.h2}>2. AGE &amp; CONTENT</h2>
                <p style={S.p}>
                    This platform contains adult content and is strictly intended for users who are 18 years of age or older. By accessing this site, you confirm that you meet this requirement.
                </p>

                <h2 style={S.h2}>3. WHAT I COLLECT</h2>
                <p style={S.p}>I collect only what is necessary to provide my services:</p>
                <ul style={S.ul}>
                    <li><strong style={{ color: 'rgba(255,255,255,0.55)' }}>Account information:</strong> Your email address, chosen display name, and any profile preferences you provide during registration.</li>
                    <li><strong style={{ color: 'rgba(255,255,255,0.55)' }}>Usage data:</strong> Task activity, routine uploads, progression history, and engagement data within the platform, used to power your personalized experience.</li>
                    <li><strong style={{ color: 'rgba(255,255,255,0.55)' }}>Communications:</strong> Messages sent through the built-in chat system are stored securely on my servers.</li>
                    <li><strong style={{ color: 'rgba(255,255,255,0.55)' }}>Payment information:</strong> Payments are processed by third-party providers. I do NOT store or access your card numbers, billing addresses, or any financial credentials. I receive only payment confirmation and the email address linked to your account.</li>
                </ul>

                <h2 style={S.h2}>4. HOW I USE YOUR INFORMATION</h2>
                <ul style={S.ul}>
                    <li>To provide, operate, and improve the platform</li>
                    <li>To communicate with you regarding your account and activity</li>
                    <li>To process payments securely through third-party providers</li>
                    <li>To protect platform security and prevent misuse</li>
                </ul>
                <p style={S.p}>
                    I do not sell, rent, or share your personal data with third parties for marketing purposes. Ever.
                </p>

                <h2 style={S.h2}>5. PAYMENT PROCESSING</h2>
                <p style={S.p}>
                    Card payments are handled by third-party providers. Cryptocurrency payments are processed on-chain. In both cases, I receive only a payment confirmation and your email &mdash; no card numbers, no billing details, no exceptions.
                </p>

                <h2 style={S.h2}>6. DATA STORAGE &amp; SECURITY</h2>
                <p style={S.p}>
                    Your data is stored on secured, encrypted servers. I apply industry-standard security measures to protect your information. Account data and chat messages are accessible only through authenticated sessions.
                </p>

                <h2 style={S.h2}>7. YOUR RIGHTS</h2>
                <p style={S.p}>You have the right to:</p>
                <ul style={S.ul}>
                    <li>Access the personal data I hold about you</li>
                    <li>Request correction of inaccurate information</li>
                    <li>Request deletion of your account and associated data</li>
                </ul>
                <p style={S.p}>
                    To exercise any of these rights, contact me directly!
                </p>
                <p style={S.p}>
                    Account deletion requests will be reviewed and processed within 90 days of submission. During this period your account will remain inactive but your data will be retained. After the 90-day review period has passed, your personal data will be permanently deleted, unless retention is required by law.
                </p>

                <h2 style={S.h2}>8. COOKIES</h2>
                <p style={S.p}>
                    I use only essential cookies required for authentication and session management. I do not use advertising, tracking, or analytics cookies.
                </p>

                <h2 style={S.h2}>9. DATA RETENTION</h2>
                <p style={S.p}>
                    Your data is retained for as long as your account remains active. Upon a verified deletion request, I will remove your personal data within 90 days, unless retention is required by law.
                </p>

                <h2 style={S.h2}>10. THIRD-PARTY LINKS</h2>
                <p style={S.p}>
                    This site may contain links to external platforms. I am not responsible for the privacy practices of any third-party websites. Please review their policies independently.
                </p>

                <h2 style={S.h2}>11. CHANGES TO THIS POLICY</h2>
                <p style={S.p}>
                    I may update this policy periodically. Any significant changes will be communicated through the platform. Continued use of the service after an update constitutes your acceptance of the revised policy.
                </p>

                <div style={S.divider} />

                <p style={S.contact}>
                    Queen Karin &middot; qkarin.com
                </p>
            </div>
        </div>
    );
}
