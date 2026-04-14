import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Queen Karin - Exclusive Access',
    description: 'Not for everyone. For those who know what they are and what they want. Queen Karin\'s private world awaits.',
    openGraph: {
        title: 'Queen Karin - Exclusive Access',
        description: 'Not for everyone. For those who know what they are and what they want.',
        images: [
            {
                url: '/queen-bg-desktop.png',
                width: 1920,
                height: 1080,
                alt: 'Queen Karin',
            },
        ],
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Queen Karin - Exclusive Access',
        description: 'Not for everyone. For those who know what they are and what they want.',
        images: ['/queen-bg-desktop.png'],
    },
};

export default function TributeLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
