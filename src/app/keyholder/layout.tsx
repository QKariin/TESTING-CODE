import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Keyholder — Chastity Under Her Control',
    description: 'Surrender your key to Queen Karin. Real chastity keyholder sessions — trial, weekly or monthly lockup under absolute female control.',
    keywords: ['keyholder online', 'online keyholder service', 'online keyholder app', 'find online keyholder', 'digital keyholder', 'chastity key holding', 'keyholder website', 'keyholder meaning', 'chastity control', 'key holding chastity'],
    alternates: { canonical: 'https://throne.qkarin.com/keyholder' },
    openGraph: {
        title: 'Keyholder — Chastity Under Her Control',
        description: 'Surrender your key to Queen Karin. Real chastity keyholder sessions under absolute female control.',
        url: 'https://throne.qkarin.com/keyholder',
        images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'Queen Karin - Online Keyholder' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Keyholder — Chastity Under Her Control',
        description: 'Surrender your key to Queen Karin. Real chastity keyholder sessions under absolute female control.',
        images: ['/og-cover.png'],
    },
};

export default function KeyholderLayout({ children }: { children: React.ReactNode }) {
    return children;
}
