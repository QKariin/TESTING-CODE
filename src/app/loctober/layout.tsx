import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'LOCKTOBER — 31 Days Locked Under Queen Karin',
    description: 'Only 7 spots. 31 days locked with daily video tasks, a real keyholder app, personal review, and no way out. Locktober with Queen Karin.',
    alternates: { canonical: 'https://throne.qkarin.com/loctober' },
    openGraph: {
        title: 'LOCKTOBER — 31 Days Locked Under Queen Karin',
        description: 'Only 7 spots. 31 days locked with daily video tasks, a real keyholder app, and no way out.',
        url: 'https://throne.qkarin.com/loctober',
        images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'Locktober — Queen Karin' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'LOCKTOBER — 31 Days Locked Under Queen Karin',
        description: 'Only 7 spots. 31 days locked with daily video tasks, a real keyholder app, and no way out.',
        images: ['/og-cover.png'],
    },
};

export default function LoctoberLayout({ children }: { children: React.ReactNode }) {
    return children;
}
