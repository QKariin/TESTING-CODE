import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const CEO_EMAILS = ['ceo@qkarin.com', 'queen@qkarin.com'];

export async function GET() {
    // Auth-gate: queen only
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase();
    if (!email || !CEO_EMAILS.includes(email)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ message: 'Debug endpoint disabled in production' });
}
