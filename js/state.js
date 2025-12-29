// --- 1. DATA STORAGE ---
export let gameStats = { 
    totalTasks: 0, 
    completedTasks: 0, 
    currentStreak: 0, 
    points: 0, 
    coins: 0,
    kneelCount: 0,      // Added for the Kneel button
    todayKneeling: 0    // Added for the Kneel button
};

export let stats = { 
    approvedTasks: 0, 
    rejectedTasks: 0, 
    skippedTasks: 0, 
    dailyCompletedTasks: 0, 
    dailyStreak: 0, 
    dailyScore: 0, 
    monthlyTotalTasks: 0, 
    monthlyScore: 0
};

export let userProfile = { 
    name: "Slave", 
    hierarchy: "Loading...", 
    avatar: "",
    joined: null 
};

// --- NEW: REWARD SYSTEM DATA ---
export let activeRevealMap = [];
export let vaultItems = [];
export let currentLibraryMedia = "";
export let libraryProgressIndex = 1;

// --- 2. APP STATE VARIABLES ---
export let isLocked = false;
export const COOLDOWN_MINUTES = 60;
export let currentTask = null;
export let taskDatabase = [];
export let galleryData = [];
export let pendingTaskState = null;
export let taskJustFinished = false;
export let cooldownInterval = null;
export let ignoreBackendUpdates = false;
export let lastChatJson = "";
export let lastGalleryJson = "";
export let isInitialLoad = true;
export let chatLimit = 50;
export let lastNotifiedMessageId = null;
export let historyLimit = 12;
export let pendingLimit = 4;
export let currentView = 'serve';
export let resetUiTimer = null;
export let taskQueue = [];
export let audioUnlocked = false;
export let cmsHierarchyData = null;
export let WISHLIST_ITEMS = [];
export let lastWorshipTime = 0;
export let currentHistoryIndex = 0;
export let touchStartX = 0;

// js/state.js - THE ONLY WAY TO RECONNECT DATA
export function setGameStats(newStats) {
    Object.assign(gameStats, newStats); // Correct: Updates the existing brain
}

export function setStats(newStats) {
    Object.assign(stats, newStats);
}

export function setUserProfile(newProfile) {
    Object.assign(userProfile, newProfile);
}

export function setCurrentTask(task) { currentTask = task; }
export function setPendingTaskState(state) { pendingTaskState = state; }
export function setTaskDatabase(tasks) { taskDatabase = tasks; }
export function setGalleryData(data) { galleryData = data; }
export function setWishlistItems(items) { WISHLIST_ITEMS = items; }
export function setCmsHierarchyData(data) { cmsHierarchyData = data; }

// CRITICAL: These were missing and caused your crash!
export function setCooldownInterval(val) { cooldownInterval = val; }
export function setTaskJustFinished(val) { taskJustFinished = val; }
export function setIgnoreBackendUpdates(val) { ignoreBackendUpdates = val; }
export function setLastChatJson(val) { lastChatJson = val; }
export function setLastGalleryJson(val) { lastGalleryJson = val; }
export function setIsInitialLoad(val) { isInitialLoad = val; }
export function setChatLimit(val) { chatLimit = val; }
export function setLastNotifiedMessageId(val) { lastNotifiedMessageId = val; }
export function setHistoryLimit(val) { historyLimit = val; }
export function setPendingLimit(val) { pendingLimit = val; }
export function setCurrentView(val) { currentView = val; }
export function setResetUiTimer(val) { resetUiTimer = val; }
export function setTaskQueue(val) { taskQueue = val; }
export function setLastWorshipTime(val) { lastWorshipTime = val; }
export function setIsLocked(val) { isLocked = val; }
export function setCurrentHistoryIndex(val) { currentHistoryIndex = val; }
export function setTouchStartX(val) { touchStartX = val; }

// --- NEW: REWARD SETTERS ---
export function setActiveRevealMap(val) { activeRevealMap = val || []; }
export function setVaultItems(val) { vaultItems = val || []; }
export function setCurrentLibraryMedia(val) { currentLibraryMedia = val || ""; }
export function setLibraryProgressIndex(val) { libraryProgressIndex = val || 1; }
