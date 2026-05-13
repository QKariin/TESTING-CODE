import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Queen Karin — Femdom, Keyholder & Online Domination',
    description: 'The only FemDom APP built and ruled by a single Domme. Online domination, chastity keyholder, task training, financial domination and female led hierarchy. Apply to serve, unlock your submissive side!',
};

export default function TestLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: `if('scrollRestoration' in history)history.scrollRestoration='manual';window.scrollTo(0,0);` }} />
            <style>{`html, body { background-color: #000 !important; background-image: none !important; color-scheme: dark !important; }`}</style>
            {children}
        </>
    );
}
