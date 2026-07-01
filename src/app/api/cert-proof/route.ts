import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCaller, isCEO, isOwnerOrCEO } from '@/lib/api-auth';
import { getHierarchyReport } from '@/lib/hierarchyRules';
import { mapUserProfile } from '@/lib/mapUserProfile';
import { checkAndPromote } from '@/lib/promote';

const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Submit cert proof, approve/reject, or mark download
export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── USER: Mark certificate as downloaded (once per rank) ──
    if (action === 'download') {
        const { memberId, rank } = body;
        if (!memberId || !rank) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        if (!isOwnerOrCEO(caller, memberId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: profile } = await adminClient
            .from('profiles')
            .select('ID, parameters')
            .eq(isUUID ? 'ID' : 'member_id', memberId)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const params = profile.parameters || {};
        const downloaded = params.certs_downloaded || {};
        const rankKey = rank.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Track download but never block re-downloads
        downloaded[rankKey] = new Date().toISOString();
        params.certs_downloaded = downloaded;

        await adminClient
            .from('profiles')
            .update({ parameters: params })
            .eq('ID', profile.ID);

        return NextResponse.json({ success: true });
    }

    // ── USER: Submit proof ──
    if (action === 'submit') {
        const { memberId, mediaUrl } = body;
        if (!memberId || !mediaUrl) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        if (!isOwnerOrCEO(caller, memberId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: profile } = await adminClient
            .from('profiles')
            .select('ID, member_id, name, hierarchy, parameters')
            .eq(isUUID ? 'ID' : 'member_id', memberId)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // Lock until user reaches a new rank
        const params = profile.parameters || {};
        const lastProofRank = params.last_cert_proof_rank || '';
        if (lastProofRank && lastProofRank.toLowerCase() === (profile.hierarchy || '').toLowerCase()) {
            return NextResponse.json({ error: 'Proof already submitted for this rank. Unlock at next rank.' }, { status: 429 });
        }

        // Store which rank the proof was submitted for
        await adminClient
            .from('profiles')
            .update({ parameters: { ...params, last_cert_proof_rank: profile.hierarchy || 'Hall Boy' } })
            .eq('ID', profile.ID);

        // Send as chat message (type: 'chat' so it shows in regular messages on both sides)
        await adminClient.from('chats').insert({
            member_id: profile.member_id,
            sender_email: profile.member_id,
            content: `CERT_PROOF::${JSON.stringify({ mediaUrl, userName: profile.name || '', memberId: profile.member_id, currentRank: profile.hierarchy || 'Hall Boy' })}`,
            type: 'chat',
            metadata: { isCertProof: true },
        });

        return NextResponse.json({ success: true });
    }

    // ── CEO: Approve proof ──
    if (action === 'approve') {
        if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { memberId } = body;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: profile } = await adminClient
            .from('profiles')
            .select('*')
            .eq(isUUID ? 'ID' : 'member_id', memberId)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // Determine which rank this cert is for (the user's next rank)
        const { data: taskRow } = await adminClient
            .from('tasks')
            .select('*')
            .eq('ID', profile.ID)
            .maybeSingle();

        const mapped = mapUserProfile(profile, taskRow);
        const report = getHierarchyReport(mapped);
        const nextRank = report.nextRank;

        const REWARD = 300;
        const params = { ...(profile.parameters || {}), cert_approved_for: nextRank };

        await adminClient
            .from('profiles')
            .update({
                wallet: (profile.wallet || 0) + REWARD,
                parameters: params,
            })
            .eq('ID', profile.ID);

        // Send confirmation message to user
        await adminClient.from('chats').insert({
            member_id: profile.member_id,
            sender_email: 'ceo@qkarin.com',
            content: `CERT_APPROVED::${JSON.stringify({ reward: REWARD, userName: profile.member_id, rank: nextRank })}`,
            type: 'chat',
            metadata: { isCertApproved: true },
        });

        // Check if user now qualifies for promotion (cert was the last missing requirement)
        checkAndPromote(profile.ID).catch(() => {});

        return NextResponse.json({ success: true, newWallet: (profile.wallet || 0) + REWARD, certApprovedFor: nextRank });
    }

    // ── CEO: Reject proof ──
    if (action === 'reject') {
        if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { memberId } = body;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: profile } = await adminClient
            .from('profiles')
            .select('ID, member_id, parameters')
            .eq(isUUID ? 'ID' : 'member_id', memberId)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // Reset lock so they can try again
        const params = profile.parameters || {};
        delete params.last_cert_proof_rank;
        await adminClient
            .from('profiles')
            .update({ parameters: params })
            .eq('ID', profile.ID);

        // Send rejection message
        await adminClient.from('chats').insert({
            member_id: profile.member_id,
            sender_email: 'ceo@qkarin.com',
            content: `CERT_REJECTED::{}`,
            type: 'chat',
            metadata: { isCertRejected: true },
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
