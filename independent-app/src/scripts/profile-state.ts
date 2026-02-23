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
    raw: any; // <--- The Backup storage
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

    // 👇 FIX 1: Look for the REAL database column "lastWorship"
    // We check multiple casings just to be safe
    const rawTime = data.lastWorship || data.LastWorship || data.lastKneelDate;

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
        
        lastWorshipTime: lastWorshipTime, // Sets the lock
        cooldownMinutes: 60,
        
        // 👇 FIX 2: Save the full data object so we don't lose stats later
        raw: data 
    });
}
