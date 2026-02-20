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
    cooldownMinutes: 1, // Default to 1 minute for testing, or sync with config
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
    setState({
        memberId: data.member_id,
        id: data.id,
        wallet: data.wallet || 0,
        score: data.score || 0,
        userName: data.name || "SLAVE",
        rank: data.hierarchy || "Hall Boy",
        revealMap: data.parameters?.reveal_map || [],
        libraryProgress: data.parameters?.library_progress || 1
    });
}
