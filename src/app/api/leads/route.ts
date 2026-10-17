import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

// POST - capture a lead (called from auth callback when user has no profile)
export async function POST(req: NextRequest) {
    try {
        const { email, provider } = await req.json();
        if (!email) return NextResponse.json({ success: false, error: 'No email' }, { status: 400 });

        const id = email.trim().toLowerCase();

        // Try to find existing lead
        const { data: existing } = await supabaseAdmin
            .from('leads')
            .select('id, attempts')
            .eq('email', id)
            .maybeSingle();

        if (existing) {
            await supabaseAdmin
                .from('leads')
                .update({ last_seen: new Date().toISOString(), attempts: (existing.attempts || 1) + 1 })
                .eq('email', id);
        } else {
            await supabaseAdmin
                .from('leads')
                .insert({ email: id, provider: provider || 'unknown', first_seen: new Date().toISOString(), last_seen: new Date().toISOString(), attempts: 1 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[leads POST]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// GET - list all leads for the dashboard
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('leads')
            .select('*')
            .order('last_seen', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, leads: data || [] });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, leads: [] }, { status: 500 });
    }
}

// PATCH - sync from auth.users: find all auth users who are NOT real members and add them as leads
// This catches anyone who slipped through (trigger-created profiles, email/password logins, etc.)
export async function PATCH() {
    try {
        // Auth check — CEO only
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const callerEmail = (user?.email || '').toLowerCase();
        if (!CEO_EMAILS.includes(callerEmail)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 1. Get all auth users
        const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const authUsers = authData?.users || [];

        // 2. Get all profiles with activity data
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('member_id, score, hierarchy, wallet');

        // 3. Get existing leads
        const { data: existingLeads } = await supabaseAdmin
            .from('leads')
            .select('email');

        const profileMap = new Map<string, any>();
        (profiles || []).forEach((p: any) => profileMap.set((p.member_id || '').toLowerCase(), p));
        const leadSet = new Set((existingLeads || []).map((l: any) => l.email.toLowerCase()));

        // 4. Find auth users who are NOT real members and NOT already leads
        const now = new Date().toISOString();
        let added = 0;
        for (const au of authUsers) {
            let email = (au.email || '').toLowerCase().trim();
            if (!email && au.app_metadata?.provider) {
                email = `${au.app_metadata.provider}_${au.id}@${au.app_metadata.provider}.com`;
            }
            if (!email || CEO_EMAILS.includes(email)) continue;
            if (leadSet.has(email)) continue;

            // Check if they're a real member (has activity beyond trigger defaults)
            const profile = profileMap.get(email);
            const isRealMember = profile && (
                Number(profile.score || 0) > 0 ||
                (profile.hierarchy && profile.hierarchy !== 'Hall Boy') ||
                (profile.wallet !== null && profile.wallet !== 5000 && profile.wallet !== undefined)
            );

            if (!isRealMember) {
                const provider = au.app_metadata?.provider || 'unknown';
                const createdAt = au.created_at || now;
                await supabaseAdmin.from('leads').insert({
                    email,
                    provider,
                    first_seen: createdAt,
                    last_seen: createdAt,
                    attempts: 1,
                });
                added++;
            }
        }

        return NextResponse.json({ success: true, synced: added, totalAuthUsers: authUsers.length });
    } catch (err: any) {
        console.error('[leads PATCH sync]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
