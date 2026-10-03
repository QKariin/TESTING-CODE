import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const PAYWALL_TYPES = new Set([
    'PAYWALL_TRIBUTE', 'PAYWALL_TRIBUTE_CRYPTO', 'PAYWALL_TRIBUTE_THRONE',
    'PAYWALL_TRIBUTE_PAYPAL', 'TRIBUTE_CRYPTO',
]);

function getAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function startOf(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET() {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getAdmin();

    const [profilesRes, appsRes, queueRes, pendingAppsRes] = await Promise.all([
        supabase.from('profiles').select('name, member_id, parameters, hierarchy'),
        supabase.from('applications').select('email, name, payment_amount, created_at').eq('payment_status', 'paid'),
        supabase.from('tasks').select('member_id').not('taskdom_pending_state', 'is', null).neq('taskdom_pending_state', ''),
        supabase.from('applications').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
    ]);

    const profiles = profilesRes.data || [];
    const apps = appsRes.data || [];

    // Build transaction list
    const allTx: { amount: number; timestamp: string; name: string; type: string }[] = [];

    for (const app of apps) {
        allTx.push({
            amount: app.payment_amount ? app.payment_amount / 100 : 95,
            timestamp: app.created_at,
            name: app.name || app.email || 'Unknown',
            type: 'ENTRANCE',
        });
    }

    for (const p of profiles) {
        const history: any[] = p.parameters?.purchaseHistory || [];
        for (const entry of history) {
            if (!PAYWALL_TYPES.has(entry.type || '')) continue;
            if (!entry.amount || Number(entry.amount) <= 0) continue;
            allTx.push({
                amount: Number(entry.amount),
                timestamp: entry.timestamp,
                name: entry.name || p.name || p.member_id || 'Unknown',
                type: entry.type,
            });
        }
    }

    allTx.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Revenue buckets
    const dayStart = startOf('day');
    const weekStart = startOf('week');
    const monthStart = startOf('month');
    let today = 0, week = 0, month = 0, allTime = 0;
    for (const tx of allTx) {
        const d = new Date(tx.timestamp);
        allTime += tx.amount;
        if (d >= monthStart) month += tx.amount;
        if (d >= weekStart) week += tx.amount;
        if (d >= dayStart) today += tx.amount;
    }

    // 7-day chart data
    const now = new Date();
    const chartData: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const de = new Date(ds.getTime() + 86400000);
        const total = allTx
            .filter(tx => { const t = new Date(tx.timestamp); return t >= ds && t < de; })
            .reduce((s, tx) => s + tx.amount, 0);
        chartData.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), value: total });
    }

    const activeMembers = profiles.length;
    const queueCount = queueRes.data?.length || 0;
    const newApps = pendingAppsRes.count || 0;

    // Personal plan from CEO profile
    const defaultPlan = {
        meals: { breakfast: '', lunch: '', dinner: '' },
        gym: { enabled: false, workout: '' },
        tasks: [] as string[],
        notes: '',
    };
    const { data: ceoProfile } = await supabase
        .from('profiles')
        .select('parameters')
        .ilike('member_id', caller.email)
        .maybeSingle();
    const plan = ceoProfile?.parameters?.morningPlan
        ? { ...defaultPlan, ...ceoProfile.parameters.morningPlan }
        : defaultPlan;

    // AI briefing
    const briefing = await generateBriefing({ revenue: { today, week, month }, activeMembers, queueCount, newApps, recentTributes: allTx.slice(0, 3), plan });

    return NextResponse.json({
        revenue: { today, week, month, allTime },
        activeMembers,
        queueCount,
        newApps,
        recentTributes: allTx.slice(0, 12),
        chartData,
        plan,
        briefing,
    });
}

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { plan } = await req.json();
    if (!plan) return NextResponse.json({ error: 'Missing plan' }, { status: 400 });

    const supabase = getAdmin();

    const { data: profile } = await supabase
        .from('profiles')
        .select('parameters')
        .ilike('member_id', caller.email)
        .maybeSingle();

    const updated = { ...(profile?.parameters || {}), morningPlan: plan };

    const { error } = await supabase
        .from('profiles')
        .update({ parameters: updated })
        .ilike('member_id', caller.email);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

async function generateBriefing(data: {
    revenue: { today: number; week: number; month: number };
    activeMembers: number;
    queueCount: number;
    newApps: number;
    recentTributes: { amount: number; name: string }[];
    plan: { meals: { breakfast: string; lunch: string; dinner: string }; gym: { enabled: boolean; workout: string }; tasks: string[]; notes: string };
}): Promise<string> {
    try {
        const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const tributeStr = data.recentTributes.length > 0
            ? data.recentTributes.map(t => `${t.name} (€${Number(t.amount).toFixed(0)})`).join(', ')
            : 'none';
        const gymStr = data.plan.gym.enabled ? `gym: ${data.plan.gym.workout || 'workout'}` : 'no gym today';
        const taskCount = data.plan.tasks.filter(Boolean).length;

        const prompt = `Write a 3-sentence morning briefing for Queen Karin. Today is ${todayStr}.

Revenue: €${data.revenue.today.toFixed(0)} today / €${data.revenue.week.toFixed(0)} this week / €${data.revenue.month.toFixed(0)} this month.
Members: ${data.activeMembers} active. Queue: ${data.queueCount} tasks pending review. New applications: ${data.newApps}.
Recent tributes: ${tributeStr}.
Personal plan: ${gymStr}. ${taskCount} task${taskCount !== 1 ? 's' : ''} scheduled.

Write exactly 3 sentences. No lists, no bullet points. Address her in second person ("Your empire..."). Tone: sharp, powerful, imperial — a general's morning report to a queen. Highlight what's most notable.`;

        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}` },
            body: JSON.stringify({
                model: 'mistral-medium-latest',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 160,
                temperature: 0.75,
            }),
        });

        const json = await res.json();
        return json.choices?.[0]?.message?.content?.trim() || '';
    } catch {
        return '';
    }
}
