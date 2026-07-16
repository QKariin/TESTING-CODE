import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../css/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://throne.qkarin.com'),
  title: {
    default: 'Queen Karin — Femdom, Findom & Female Domination',
    template: '%s | Queen Karin',
  },
  description: 'Enter the world of Queen Karin. Real femdom, findom & female domination. No agencies, no bots, no fakes. Apply to serve or stay locked out.',
  keywords: ['femdom', 'femdom meaning', 'femdom definition', 'findom', 'findomme', 'findom meaning', 'female domination', 'financial domination', 'queen karin', 'dominatrix', 'female supremacy', 'femdom online', 'online domination', 'chastity', 'keyholder', 'keyholder online', 'online keyholder service', 'online keyholder app', 'find online keyholder', 'keyholder meaning', 'keyholder website', 'digital keyholder', 'chastity key holding', 'female led relationship', 'flr relationship', 'woman led relationship', 'paypigs', 'findom tribute', 'worship', 'submission', 'fin domination', 'virtual keyholder', 'virtual domme', 'virtual mistress', 'virtual dominatrix', 'virtual femdom', 'virtual chastity', 'online mistress', 'online domme', 'online dominatrix', 'real online mistress', 'find a domme online', 'online slave training', 'online sub training', 'obedience training femdom'],
  authors: [{ name: 'Queen Karin' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Queen Karin — Femdom, Findom & Female Domination',
    description: 'Enter the world of Queen Karin. Real femdom, findom & female domination. No agencies, no bots, no fakes.',
    url: 'https://throne.qkarin.com',
    siteName: 'Queen Karin',
    images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'Queen Karin' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Queen Karin — Femdom, Findom & Female Domination',
    description: 'Enter the world of Queen Karin. Real femdom, findom & female domination. No agencies, no bots, no fakes.',
    images: ['/og-cover.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: '#000', colorScheme: 'dark' }}>
      <head>
        {/* Capture PWA install prompt as early as possible — before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window._deferredInstallPrompt=e;});` }} />
        <meta name="google-site-verification" content="e56kAIRP-tEuNTFI58HkKz7QakNCanWNiliRRpFXdnc" />
        <meta name="msvalidate.01" content="3B101EEC47F0F538AB04232357A1699E" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Queen Karin" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#c5a059" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@200;300;400;600&family=Orbitron:wght@400;700;900&family=Rajdhani:wght@500;700&family=Black+Ops+One&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch((e) => { console.warn('[SW] registration failed:', e); });
            });
          }
        `}} />
      </body>
    </html>
  );
}
