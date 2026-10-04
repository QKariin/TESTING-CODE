import { NextResponse } from 'next/server';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.GITHUB_ACTIONS_TOKEN;
    if (!token) return NextResponse.json({ error: 'GITHUB_ACTIONS_TOKEN not set' }, { status: 500 });

    const res = await fetch(
        'https://api.github.com/repos/QKariin/TESTING-CODE/actions/workflows/tiktok-agent.yml/dispatches',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ref: 'main' }),
        }
    );

    if (res.status === 204) return NextResponse.json({ success: true });
    const body = await res.text();
    return NextResponse.json({ error: body }, { status: res.status });
}
