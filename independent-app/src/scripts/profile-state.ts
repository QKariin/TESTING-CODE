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
}

const DEFAULT_STATE: ProfileState = {
    isLocked: false,
    lastWorshipTime: 0,
    cooldownMinutes: 1, 
    wallet: 0,
    score: 0,
    memberId: null,
    id: null,
    userName: "SLAVE",
    rank: "INITIATE",
    revealMap: [],
    libraryProgress: 1
};

let state: ProfileState = { ...DEFAULT_STATE };

export function getState(): ProfileState {
    return state;
}

export function setState(updates: Partial<ProfileState>) {
    state = { ...state, ...updates };
}

export function resetState() {
    state = { ...DEFAULT_STATE };
}

export function initProfileState(data: any) {
    let lastWorshipTime = 0;

    // 👇 THE FIX: Look for 'lastWorship' (from tasks table), fall back to 'lastKneelDate'
    const rawTime = data.lastWorship || data.lastKneelDate;

    if (rawTime) {
        const parsed = new Date(rawTime).getTime();
        if (!isNaN(parsed)) lastWorshipTime = parsed;
    }

    console.log("[STATE] Initialized. Last Worship:", lastWorshipTime);

    setState({
        memberId: data.member_id,
        id: data.id,
        wallet: data.wallet || 0,
        score: data.score || 0,
        userName: data.name || "SLAVE",
        rank: data.hierarchy || "Hall Boy",
        revealMap: data.parameters?.reveal_map || [],
        libraryProgress: data.parameters?.library_progress || 1,
        
        // Pass the parsed time into the state
        lastWorshipTime: lastWorshipTime,
        
        // Ensure cooldown matches your game rules (60 mins)
        cooldownMinutes: 60, 
    });
}
