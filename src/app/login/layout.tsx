import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to Queen Karin. Access your profile, submit tributes and serve under Her rule.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
