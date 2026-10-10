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
    const params = profile?.parameters || {};
    const raw = params.subscriptionTier as string | undefined;

    if (raw === 'property' || raw === 'owned') return raw as MemberTier;
    if (raw === 'devotee') return 'devotee';
    if (raw === 'initiate') return 'initiate';

    // Legacy tiers from old stripe/subscribe route — map to nearest equivalent
    if (raw === 'royal') return 'devotee';
    if (raw === 'ownership') return 'property';
    if (raw === 'basic') return 'initiate';

    // Existing members with no explicit subscriptionTier = full access (property)
    // The new tiers apply only to new sign-ups who pick a tier at checkout
    const paid = params.subscriptionStatus === 'Active'
        || (params.wishlist_spent || 0) > 0
        || params.keyholder_tier
        || (profile?.wallet || 0) > 0
        || (profile?.score || 0) > 0;

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
