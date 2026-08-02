import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'Privacy Policy for Queen Karin — how we collect, use, and protect your personal data.',
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
                <p style={S.subtitle}>LAST UPDATED: AUGUST 2026</p>

                <p style={S.p}>
                    This Privacy Policy explains how Queen Karin (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects your personal information when you use our website and services at qkarin.com.
                </p>

                <div style={S.divider} />

                <h2 style={S.h2}>1. INFORMATION WE COLLECT</h2>
                <p style={S.p}>We may collect the following types of information:</p>
                <ul style={S.ul}>
                    <li>Account information: email address, display name, profile picture</li>
                    <li>Authentication data provided through third-party login (Google, Discord, Twitter/X)</li>
                    <li>Payment information: transaction records, payment method details (processed by third-party payment providers)</li>
                    <li>Usage data: pages visited, features used, interactions within the platform</li>
                    <li>Content you submit: messages, reviews, uploaded media</li>
                    <li>Device and browser information collected automatically</li>
                </ul>

                <h2 style={S.h2}>2. HOW WE USE YOUR INFORMATION</h2>
                <ul style={S.ul}>
                    <li>To provide and maintain our services</li>
                    <li>To process payments and verify transactions</li>
                    <li>To communicate with you about your account and services</li>
                    <li>To personalize your experience within the platform</li>
                    <li>To maintain security and prevent fraud</li>
                    <li>To comply with legal obligations</li>
                </ul>

                <h2 style={S.h2}>3. THIRD-PARTY SERVICES</h2>
                <p style={S.p}>
                    We use third-party services for authentication (Supabase Auth), payment processing (DeStream, cryptocurrency providers), analytics (Vercel Analytics), and hosting. These services may collect information as described in their own privacy policies. We do not sell your personal data to third parties.
                </p>

                <h2 style={S.h2}>4. DATA STORAGE AND SECURITY</h2>
                <p style={S.p}>
                    Your data is stored securely using industry-standard encryption and security measures. We use Supabase for database storage with row-level security policies. While we take reasonable steps to protect your information, no method of transmission over the internet is 100% secure.
                </p>

                <h2 style={S.h2}>5. COOKIES AND TRACKING</h2>
                <p style={S.p}>
                    We use essential cookies for authentication and session management. We use Vercel Analytics for anonymous usage statistics. We do not use advertising cookies or trackers.
                </p>

                <h2 style={S.h2}>6. YOUR RIGHTS</h2>
                <p style={S.p}>You have the right to:</p>
                <ul style={S.ul}>
                    <li>Access the personal data we hold about you</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your account and associated data</li>
                    <li>Withdraw consent for data processing</li>
                    <li>Request a copy of your data in a portable format</li>
                </ul>

                <h2 style={S.h2}>7. DATA RETENTION</h2>
                <p style={S.p}>
                    We retain your data for as long as your account is active or as needed to provide services. Upon account deletion, your personal data will be removed within 30 days, except where retention is required by law.
                </p>

                <h2 style={S.h2}>8. AGE REQUIREMENT</h2>
                <p style={S.p}>
                    Our services are intended for individuals 18 years of age or older. We do not knowingly collect information from anyone under 18. If we become aware of such collection, we will delete the data immediately.
                </p>

                <h2 style={S.h2}>9. CHANGES TO THIS POLICY</h2>
                <p style={S.p}>
                    We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of our services after changes constitutes acceptance of the updated policy.
                </p>

                <div style={S.divider} />

                <h2 style={S.h2}>10. CONTACT</h2>
                <p style={S.p}>
                    If you have questions about this Privacy Policy or wish to exercise your data rights, contact us through the platform or via our Discord server.
                </p>

                <p style={S.contact}>
                    Queen Karin &middot; qkarin.com
                </p>
            </div>
        </div>
    );
}
