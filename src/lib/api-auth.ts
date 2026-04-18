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

export async function getCallerId(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id || null;
    } catch {
        return null;
    }
}

export async function getCaller(): Promise<{ email: string; id: string } | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return null;
        return { email: user.email.toLowerCase(), id: user.id };
    } catch {
        return null;
    }
}

export function isCEO(email: string): boolean {
    return CEO_EMAILS.includes(email.toLowerCase());
}

/** Returns true if caller is CEO or if the provided memberId/email matches the caller */
export function isOwnerOrCEO(caller: { email: string; id: string }, memberId: string): boolean {
    if (isCEO(caller.email)) return true;
    // UUID comparison
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
        return caller.id === memberId;
    }
    // Email comparison
    return caller.email === memberId.toLowerCase();
}
