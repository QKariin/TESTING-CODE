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
    console.log("[STATE] Initializing with Data:", data);

    let lastWorshipTime = 0;

    // 1. Try to find the timestamp in various possible locations
    // Note: data.lastWorship comes from the merged 'tasks' table
    const rawTime = data.lastWorship || data.lastKneelDate || data.LastWorship;

    if (rawTime) {
        const parsed = new Date(rawTime).getTime();
        if (!isNaN(parsed)) {
            lastWorshipTime = parsed;
            console.log("[STATE] Found Last Worship:", new Date(lastWorshipTime).toLocaleTimeString());
        }
    } else {
        console.warn("[STATE] No Last Worship Time found in data.");
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
        
        // SAVE THE BACKUP!
        raw: data 
    });
}
