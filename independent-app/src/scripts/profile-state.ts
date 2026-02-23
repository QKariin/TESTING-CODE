// src/scripts/profile-state.ts

export interface ProfileState {
    isLocked: boolean;
    lastWorshipTime: number;
    cooldownMinutes: number;
    wallet: number;
    score: number;
    memberId: string | null;
    id: string | null;
    userName: string;
    rank: string;
    revealMap: number[];
    libraryProgress: number;
    raw: any; // <--- NEW: Backup of the full DB object
}

const DEFAULT_STATE: ProfileState = {
    isLocked: false,
    lastWorshipTime: 0,
    cooldownMinutes: 60,
    wallet: 0,
    score: 0,
    memberId: null,
    id: null,
    userName: "SLAVE",
    rank: "INITIATE",
    revealMap: [],
    libraryProgress: 1,
    raw: {} // Default empty
};

let state: ProfileState = { ...DEFAULT_STATE };

export function getState(): ProfileState {
    return state;
}

export function setState(updates: Partial<ProfileState>) {
    state = { ...state, ...updates };
    
    // Sync the raw backup if we updated wallet/score so the sidebar sees it
    if (updates.wallet !== undefined) state.raw.wallet = updates.wallet;
    if (updates.score !== undefined) state.raw.score = updates.score;
}

export function resetState() {
    state = { ...DEFAULT_STATE };
}

export function initProfileState(data: any) {
    let lastWorshipTime = 0;

    // 1. Look for lowercase 'lastworship' (from our normalization)
    // We also check lastWorship just in case, and lastKneelDate as legacy fallback
    const rawTime = data.lastworship || data.lastWorship || data.lastKneelDate;

    if (rawTime) {
        const parsed = new Date(rawTime).getTime();
        if (!isNaN(parsed)) {
            lastWorshipTime = parsed;
            console.log("[STATE] Lock Active. Time:", new Date(lastWorshipTime).toLocaleTimeString());
        }
    }

    setState({
        memberId: data.member_id,
        id: data.id,
        wallet: data.wallet || 0,
        score: data.score || 0,
        userName: data.name || "SLAVE",
        rank: data.hierarchy || "Hall Boy",
        revealMap: data.parameters?.reveal_map || [],
        libraryProgress: data.parameters?.library_progress || 1,
        
        lastWorshipTime: lastWorshipTime,
        cooldownMinutes: 60,
        
        // IMPORTANT: Save the full merged data object for the sidebar
        raw: data 
    });
}
