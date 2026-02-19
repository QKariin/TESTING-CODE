// src/scripts/profile-state.ts

export interface ProfileState {
    isLocked: boolean;
    lastWorshipTime: number;
    cooldownMinutes: number;
    coins: number;
    points: number;
    memberId: string | null;
    userName: string;
    rank: string;
    revealMap: number[];
    libraryProgress: number;
}

const DEFAULT_STATE: ProfileState = {
    isLocked: false,
    lastWorshipTime: 0,
    cooldownMinutes: 1, // Default to 1 minute for testing, or sync with config
    coins: 0,
    points: 0,
    memberId: null,
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
    // Trigger UI updates or event listeners if needed
}

export function resetState() {
    state = { ...DEFAULT_STATE };
}

export function initProfileState(data: any) {
    setState({
        memberId: data.member_id,
        coins: data.coins || 0,
        points: data.points || 0,
        userName: data.name || "SLAVE",
        rank: data.rank || "INITIATE"
    });
}
