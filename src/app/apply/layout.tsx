import type { Metadata } from "next";

export const metadata: Metadata = {
    title: 'Apply to Serve',
    description: 'Submit your application to Queen Karin. Prove your devotion and earn your place in the household. Serious applicants only.',
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
    return children;
}
