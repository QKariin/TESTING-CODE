import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_EMAIL = 'newuser@throne.test';
const DEV_ID = 'dev-local-user';

export async function getCallerEmail(): Promise<string | null> {
    if (IS_DEV) return DEV_EMAIL;
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) return user.email.toLowerCase();
        // Twitter/Discord users: look up member_id from profiles
        if (user?.id) {
            const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
            if (p?.member_id) return p.member_id.toLowerCase();
        }
        return null;
    } catch {
        return null;
    }
}

export async function getCallerId(): Promise<string | null> {
    if (IS_DEV) return DEV_ID;
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id || null;
    } catch {
        return null;
    }
}

export async function getCaller(): Promise<{ email: string; id: string } | null> {
    if (IS_DEV) return { email: DEV_EMAIL, id: DEV_ID };
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        let email = user.email?.toLowerCase() || '';
        // Twitter/Discord users: look up member_id from profiles
        if (!email && user.id) {
            const { data: p } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
            if (p?.member_id) email = p.member_id.toLowerCase();
        }
        if (!email) return null;
        return { email, id: user.id };
    } catch {
        return null;
    }
}

export function isCEO(email: string): boolean {
    if (IS_DEV) return true;
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
