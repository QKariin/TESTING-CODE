import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Queen Karin",
  description: "Femdom Revolution with Queen Karin",
  openGraph: {
    title: 'Queen Karin',
    description: 'Femdom Revolution with Queen Karin',
    url: 'https://throne.qkarin.com',
    siteName: 'Throne',
    images: [{ url: 'https://throne.qkarin.com/og-cover.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Queen Karin',
    description: 'Femdom Revolution with Queen Karin',
    images: ['https://throne.qkarin.com/og-cover.png'],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
