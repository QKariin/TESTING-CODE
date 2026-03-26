// src/scripts/state.ts
// CENTRAL DATA STORE - Converted to TypeScript

// --- 1. DATA STORAGE ---
export interface GameStats {
    totalTasks: number;
    completedTasks: number;
    currentStreak: number;
    points: number;
    coins: number;
    kneelCount: number;
    todayKneeling: number;
    taskdom_streak: number;
    taskdom_total_tasks: number;
}

export let gameStats: GameStats = {
    totalTasks: 0,
    completedTasks: 0,
    currentStreak: 0,
    points: 0,
    coins: 0,
    kneelCount: 0,
    todayKneeling: 0,
    taskdom_streak: 0,
    taskdom_total_tasks: 0
};

export interface Stats {
    approvedTasks: number;
    rejectedTasks: number;
    skippedTasks: number;
    dailyCompletedTasks: number;
    dailyStreak: number;
    dailyScore: number;
    monthlyTotalTasks: number;
    monthlyScore: number;
}

export let stats: Stats = {
    approvedTasks: 0,
    rejectedTasks: 0,
    skippedTasks: 0,
    dailyCompletedTasks: 0,
    dailyStreak: 0,
    dailyScore: 0,
    monthlyTotalTasks: 0,
    monthlyScore: 0
};

export interface UserProfile {
    name: string;
    hierarchy: string;
    avatar: string;
    joined: string | null;
    profilePicture: string;
    kneelHistory: any;
    routine: string;
    kinks: string;
    limits: string;
    routinestreak: number;
    rawImage: string;
    tributeHistory: any[];
}

export let userProfile: UserProfile = {
    name: "Slave",
    hierarchy: "Loading...",
    avatar: "",
    joined: null,
    profilePicture: "",
    kneelHistory: null,
    routine: "",
    kinks: "",
    limits: "",
    routinestreak: 0,
    rawImage: "",
    tributeHistory: []
};

// --- REWARD SYSTEM DATA ---
export let activeRevealMap: any[] = [];
export let vaultItems: any[] = [];
export let currentLibraryMedia: string = "";
export let libraryProgressIndex: number = 1;

// --- 2. APP STATE VARIABLES ---
export let isLocked: boolean = false;
export const COOLDOWN_MINUTES: number = 60;
export let currentTask: any = null;
export let taskDatabase: any[] = [];
export let galleryData: any[] = [];
export let pendingTaskState: any = null;
export let taskJustFinished: boolean = false;
export let cooldownInterval: any = null;
export let ignoreBackendUpdates: boolean = false;
export let lastChatJson: string = "";
export let lastGalleryJson: string = "";
export let isInitialLoad: boolean = true;
export let chatLimit: number = 50;
export let lastNotifiedMessageId: string | null = null;
export let historyLimit: number = 12;
export let pendingLimit: number = 4;
export let currentView: string = 'serve';
export let resetUiTimer: any = null;
export let taskQueue: any[] = [];
export let audioUnlocked: boolean = false;
export let cmsHierarchyData: any = null;
export let WISHLIST_ITEMS: any[] = [];
export let lastWorshipTime: number = 0;
export let currentHistoryIndex: number = 0;
export let touchStartX: number = 0;
export let hierarchyReport: any = null;

// --- 3. SETTERS ---

export function setGameStats(newStats: Partial<GameStats>) {
    Object.assign(gameStats, newStats);
}

export function setStats(newStats: Partial<Stats>) {
    Object.assign(stats, newStats);
}

export function setUserProfile(newProfile: Partial<UserProfile>) {
    Object.assign(userProfile, newProfile);
}

export function setCurrentTask(task: any) { currentTask = task; }
export function setPendingTaskState(state: any) { pendingTaskState = state; }
export function setTaskDatabase(tasks: any[]) { taskDatabase = tasks; }
export function setGalleryData(data: any[]) { galleryData = data; }
export function setWishlistItems(items: any[]) { WISHLIST_ITEMS = items; }
export function setCmsHierarchyData(data: any) { cmsHierarchyData = data; }

// SYSTEM SETTERS
export function setCooldownInterval(val: any) { cooldownInterval = val; }
export function setTaskJustFinished(val: boolean) { taskJustFinished = val; }
export function setIgnoreBackendUpdates(val: boolean) { ignoreBackendUpdates = val; }
export function setLastChatJson(val: string) { lastChatJson = val; }
export function setLastGalleryJson(val: string) { lastGalleryJson = val; }
export function setIsInitialLoad(val: boolean) { isInitialLoad = val; }
export function setChatLimit(val: number) { chatLimit = val; }
export function setLastNotifiedMessageId(val: string | null) { lastNotifiedMessageId = val; }
export function setHistoryLimit(val: number) { historyLimit = val; }
export function setPendingLimit(val: number) { pendingLimit = val; }
export function setCurrentView(val: string) { currentView = val; }
export function setResetUiTimer(val: any) { resetUiTimer = val; }
export function setTaskQueue(val: any[]) { taskQueue = val; }
export function setLastWorshipTime(val: number) { lastWorshipTime = val; }
export function setIsLocked(val: boolean) { isLocked = val; }
export function setCurrentHistoryIndex(val: number) { currentHistoryIndex = val; }
export function setTouchStartX(val: number) { touchStartX = val; }
export function setHierarchyReport(val: any) { hierarchyReport = val; }

// REWARD SETTERS
export function setActiveRevealMap(val: any[]) { activeRevealMap = val || []; }
export function setVaultItems(val: any[]) { vaultItems = val || []; }
export function setCurrentLibraryMedia(val: string) { currentLibraryMedia = val || ""; }
export function setLibraryProgressIndex(val: number) { libraryProgressIndex = val || 1; }
