import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// DEPRECATED: This route backfilled routines into Taskdom_History.
// Routines now live in user_routines table with JSONB history.
export async function GET() {
    return NextResponse.json({ success: true, message: 'Deprecated — routines now use user_routines table', backfilled: 0 });
}
