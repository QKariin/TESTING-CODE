import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { memberEmail } = await req.json();

        if (!memberEmail) {
            return NextResponse.json({ success: false, error: 'Missing memberEmail' }, { status: 400 });
        }

        const profile = await DbService.getProfile(memberEmail);
        if (!profile || !profile.id) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        }

        // Check wallet
        const wallet = profile.wallet || 0;
        if (wallet < 300) {
            return NextResponse.json({ success: false, error: 'Insufficient Capital. 300 coins required to skip duties.' }, { status: 403 });
        }

        // 1. Deduct 300 coins
        await DbService.processTransaction(memberEmail, -300, 'Skip Task Fee');

        // 2. Clear active task
        await DbService.clearTask(memberEmail);

        return NextResponse.json({
            success: true,
            newWallet: wallet - 300
        });
    } catch (error: any) {
        console.error("Failed to skip task:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
