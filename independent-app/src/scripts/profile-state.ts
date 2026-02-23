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
    raw: any; // <--- The Backup
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
    raw: {} 
};

let state: ProfileState = { ...DEFAULT_STATE };

export function getState(): ProfileState { return state; }

export function setState(updates: Partial<ProfileState>) {
    state = { ...state, ...updates };
}

export function resetState() {
    state = { ...DEFAULT_STATE };
}

export function initProfileState(data: any) {
    let lastWorshipTime = 0;

    // 1. Grab the timestamp from the merged data (Task DB)
    // We check lastWorship (exact from DB) or lastKneelDate (legacy)
    const rawTime = data.lastWorship || data.lastKneelDate;

    if (rawTime) {
        const parsed = new Date(rawTime).getTime();
        if (!isNaN(parsed)) lastWorshipTime = parsed;
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
        
        // 👇 SAVE THE WORKING DATA OBJECT
        raw: data 
    });
}
