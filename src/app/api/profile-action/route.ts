// src/app/api/profile-action/route.ts
import { NextResponse } from 'next/server';
import { DbService } from '@/lib/supabase-service';
import { cacheDelete } from '@/lib/api-cache';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { type, memberId, payload } = await req.json();

        if (!memberId) throw new Error("Missing Member ID");

        let result: any = null;

        switch (type) {
            case 'REVEAL_FRAGMENT':
                result = await DbService.revealFragment(memberId);
                await DbService.sendMessage(memberId, `Slave revealed fragment #${result.pick} of Day ${result.progress}.`, 'system');
                break;

            case 'CLAIM_KNEEL_REWARD':
                result = await DbService.claimKneel(memberId, payload.amount, payload.type);
                await DbService.sendMessage(memberId, `Slave earned ${payload.amount} ${payload.type} for kneeling.`, 'system');
                break;

            case 'TRANSACTION':
                result = await DbService.processTransaction(memberId, payload.amount, payload.category);
                break;

            case 'UPDATE_PROFILE':
                result = await DbService.updateProfile(memberId, payload);
                break;

            case 'MESSAGE':
                result = await DbService.sendMessage(memberId, payload.text, payload.sender || 'slave', payload.mediaUrl);
                break;

            case 'SUBMIT_TASK':
                result = await DbService.submitTask(memberId, payload.proofUrl, payload.proofType, payload.taskText, payload.isRoutine, payload.thumbnailUrl);
                // Bust routine cache so next poll gets fresh uploadedToday status
                if (payload.isRoutine) cacheDelete(`routine:`);
                break;

            default:
                throw new Error("Invalid Action Type");
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Profile Action Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
