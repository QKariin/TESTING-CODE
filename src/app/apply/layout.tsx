import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Apply to Serve',
    description: 'Submit your application to Queen Karin. Prove your devotion and earn your place in the household. Serious applicants only.',
    alternates: { canonical: 'https://throne.qkarin.com/apply' },
    openGraph: {
        title: 'Apply to Serve Queen Karin',
        description: 'Submit your application. Prove your devotion and earn your place in the household.',
        url: 'https://throne.qkarin.com/apply',
        images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'Queen Karin' }],
    },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
    return children;
}
