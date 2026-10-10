// src/lib/member-tier.ts
// Subscription tier resolution for feature gating
//
// Tiers (stored in profiles.parameters.subscriptionTier):
//   'initiate'  — €18.99/mo: photo proof only, weekly review, no chat, kneeling + leaderboard
//   'devotee'   — €55/mo:    video proof, 48h review, Queen comments, chat, routine, challenges
//   'property'  — €99/mo:    video tasks, open chat, everything, personalized stories
//   'owned'     — Ownership: application-based, full custom

export type MemberTier = 'initiate' | 'devotee' | 'property' | 'owned';

// Features gated by tier
const TIER_RANK: Record<MemberTier, number> = {
    initiate: 1,
    devotee:  2,
    property: 3,
    owned:    4,
};

export function getMemberTier(profile: any): MemberTier {
    // Primary source: dedicated column
    const col = profile?.subscription_tier as string | undefined;
    if (col === 'property' || col === 'owned') return col as MemberTier;
    if (col === 'devotee') return 'devotee';
    if (col === 'initiate') return 'initiate';

    // Fallback: legacy JSONB field (for rows not yet backfilled)
    const params = profile?.parameters || {};
    const raw = params.subscriptionTier as string | undefined;
    if (raw === 'property' || raw === 'owned') return raw as MemberTier;
    if (raw === 'devotee' || raw === 'royal') return 'devotee';
    if (raw === 'initiate' || raw === 'basic') return 'initiate';
    if (raw === 'ownership') return 'property';

    // No tier data at all — if they have wallet/score they paid, give full access
    const paid = (profile?.wallet || 0) > 0 || (profile?.score || 0) > 0;
    return paid ? 'property' : 'initiate';
}

export function tierAtLeast(profile: any, minimum: MemberTier): boolean {
    return TIER_RANK[getMemberTier(profile)] >= TIER_RANK[minimum];
}

export function canChat(profile: any): boolean {
    return tierAtLeast(profile, 'devotee');
}

export function canSubmitVideoProof(profile: any): boolean {
    return tierAtLeast(profile, 'devotee');
}

export function canReceiveVideoTasks(profile: any): boolean {
    return tierAtLeast(profile, 'property');
}

export function reviewSLA(profile: any): '48h' | 'weekly' {
    return tierAtLeast(profile, 'devotee') ? '48h' : 'weekly';
}

export function canSeeQueenComments(profile: any): boolean {
    return tierAtLeast(profile, 'devotee');
}
