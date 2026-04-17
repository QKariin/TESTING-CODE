// src/scripts/dashboard-state.ts
// Dashboard State Management - Converted to TypeScript

// --- CORE DATA ---
export let users: any[] = [];
export let globalQueue: any[] = [];
export let globalTributes: any[] = [];
export let availableDailyTasks: any[] = [];
export let queenContent: any[] = [];
export let stickerConfig: any[] = [];
export let broadcastPresets: any[] = [];

// --- UI STATE ---
export let currId: string | null = null;
export let adminEmail: string | null = null;
export let dashboardRole: 'queen' | 'chatter' = 'queen';
export let lastChatJson: string = "";
export let lastGalleryJson: string = "";
export let lastHistoryJson: string = "";
export let histLimit: number = 10;
export let cooldownInterval: any = null;
export let timerInterval: any = null;
export let dragSrcIndex: number | null = null;

// --- MODAL & OVERLAY STATE ---
export let currTask: any = null;
export let pendingApproveTask: any = null;
export let selectedStickerId: string | null = null;
export let pendingRewardMedia: any = null;
export let messageImg: any = null;
export let profileMedia: any = null;
export let broadcastMedia: any = null;

// --- PROTOCOL STATE ---
export let excludedIds: string[] = [];
export let broadcastExclusions: string[] = [];
export let protocolActive: boolean = false;
export let protocolGoal: number = 1000;
export let protocolProgress: number = 0;
export let newbieImmunity: boolean = true;

// --- MEDIA RECORDING ---
export let mediaRecorder: any = null;
export let audioChunks: any[] = [];

// --- ADMIN READ STATE (single source of truth for unread detection) ---
// Maps canonical email (lowercase) → read timestamp in ms
export let adminReadMap: Record<string, number> = {};
export function setAdminReadMap(map: Record<string, number>) { adminReadMap = map; }
export function markReadInMap(email: string, ts: number) { adminReadMap[email.toLowerCase()] = ts; }

// --- SETTERS ---
export function setUsers(newUsers: any[]) { users = newUsers; }
export function setGlobalQueue(newQueue: any[]) { globalQueue = newQueue; }
export function setGlobalTributes(newTributes: any[]) { globalTributes = newTributes; }
export function setAvailableDailyTasks(newTasks: any[]) { availableDailyTasks = newTasks; }
export function setQueenContent(newContent: any[]) { queenContent = newContent; }
export function setStickerConfig(newConfig: any[]) { stickerConfig = newConfig; }
export function setBroadcastPresets(newPresets: any[]) { broadcastPresets = newPresets; }

export function setCurrId(id: string | null) {
    currId = id;
    (window as any).currId = id;
}
export function setAdminEmail(email: string | null) {
    adminEmail = email;
    if (typeof window !== 'undefined') (window as any).adminEmail = email;
}
export function setDashboardRole(role: 'queen' | 'chatter') {
    dashboardRole = role;
    if (typeof window !== 'undefined') (window as any).__dashboardRole = role;
}
export function setLastChatJson(json: string) { lastChatJson = json; }
export function setLastGalleryJson(json: string) { lastGalleryJson = json; }
export function setLastHistoryJson(json: string) { lastHistoryJson = json; }
export function setHistLimit(limit: number) { histLimit = limit; }
export function setCooldownInterval(interval: any) { cooldownInterval = interval; }
export function setTimerInterval(interval: any) { timerInterval = interval; }
export function setDragSrcIndex(index: number | null) { dragSrcIndex = index; }

export function setCurrTask(task: any) { currTask = task; }
export function setPendingApproveTask(task: any) { pendingApproveTask = task; }
export function setSelectedStickerId(id: string | null) { selectedStickerId = id; }
export function setPendingRewardMedia(media: any) { pendingRewardMedia = media; }
export function setMessageImg(img: any) { messageImg = img; }
export function setProfileMedia(media: any) { profileMedia = media; }
export function setBroadcastMedia(media: any) { broadcastMedia = media; }

export function setExcludedIds(ids: string[]) { excludedIds = ids; }
export function setBroadcastExclusions(exclusions: string[]) { broadcastExclusions = exclusions; }
export function setProtocolActive(active: boolean) { protocolActive = active; }
export function setProtocolGoal(goal: number) { protocolGoal = goal; }
export function setProtocolProgress(progress: number) { protocolProgress = progress; }
export function setNewbieImmunity(immunity: boolean) { newbieImmunity = immunity; }

export function setMediaRecorder(recorder: any) { mediaRecorder = recorder; }
export function setAudioChunks(chunks: any[]) { audioChunks = chunks; }

// --- ARMORY STATE ---
export let armorySearchQuery: string = "";
export function setArmorySearchQuery(q: string) { armorySearchQuery = q; }

// Tracks where the next 'Enforce' click goes: "queue" or "active"
export let armoryTarget: string = "queue";
export function setArmoryTarget(val: string) { armoryTarget = val; }
