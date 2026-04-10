import { createClient } from '@/utils/supabase/server';

export const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

export async function getCallerEmail(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email?.toLowerCase() || null;
    } catch {
        return null;
    }
}

export function isCEO(email: string): boolean {
    return CEO_EMAILS.includes(email.toLowerCase());
}
