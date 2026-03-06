import { redirect } from 'next/navigation';

export default function Home() {
  const isDev = process.env.NODE_ENV === 'development';
  redirect(isDev ? '/profile' : '/login');
}
