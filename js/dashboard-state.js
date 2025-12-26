// Dashboard State Management
// All global variables and state setters for the dashboard

// --- CORE DATA ---
export let users = [];
export let globalQueue = [];
export let globalTributes = [];
export let availableDailyTasks = [];
export let queenContent = [];
export let stickerConfig = [];
export let broadcastPresets = [];

// --- UI STATE ---
export let currId = null;
export let lastChatJson = "";
export let lastGalleryJson = "";
export let lastHistoryJson = "";
export let histLimit = 10;
export let cooldownInterval = null;
export let timerInterval = null;
export let dragSrcIndex = null;

// --- MODAL & OVERLAY STATE ---
export let currTask = null;
export let pendingApproveTask = null;
export let selectedStickerId = null;
export let pendingRewardMedia = null;
export let messageImg = null;
export let profileMedia = null;
export let broadcastMedia = null;

// --- PROTOCOL STATE ---
export let excludedIds = [];
export let broadcastExclusions = [];
export let protocolActive = false;
export let protocolGoal = 1000;
export let protocolProgress = 0;
export let newbieImmunity = true;

// --- MEDIA RECORDING ---
export let mediaRecorder = null;
export let audioChunks = [];

// --- CONSTANTS ---
export const ACCOUNT_ID = "kW2K8hR";
export const API_KEY = "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ";

// --- SETTERS ---
export function setUsers(newUsers) { users = newUsers; }
export function setGlobalQueue(newQueue) { globalQueue = newQueue; }
export function setGlobalTributes(newTributes) { globalTributes = newTributes; }
export function setAvailableDailyTasks(newTasks) { availableDailyTasks = newTasks; }
export function setQueenContent(newContent) { queenContent = newContent; }
export function setStickerConfig(newConfig) { stickerConfig = newConfig; }
export function setBroadcastPresets(newPresets) { broadcastPresets = newPresets; }

export function setCurrId(id) { currId = id; }
export function setLastChatJson(json) { lastChatJson = json; }
export function setLastGalleryJson(json) { lastGalleryJson = json; }
export function setLastHistoryJson(json) { lastHistoryJson = json; }
export function setHistLimit(limit) { histLimit = limit; }
export function setCooldownInterval(interval) { cooldownInterval = interval; }
export function setTimerInterval(interval) { timerInterval = interval; }
export function setDragSrcIndex(index) { dragSrcIndex = index; }

export function setCurrTask(task) { currTask = task; }
export function setPendingApproveTask(task) { pendingApproveTask = task; }
export function setSelectedStickerId(id) { selectedStickerId = id; }
export function setPendingRewardMedia(media) { pendingRewardMedia = media; }
export function setMessageImg(img) { messageImg = img; }
export function setProfileMedia(media) { profileMedia = media; }
export function setBroadcastMedia(media) { broadcastMedia = media; }

export function setExcludedIds(ids) { excludedIds = ids; }
export function setBroadcastExclusions(exclusions) { broadcastExclusions = exclusions; }
export function setProtocolActive(active) { protocolActive = active; }
export function setProtocolGoal(goal) { protocolGoal = goal; }
export function setProtocolProgress(progress) { protocolProgress = progress; }
export function setNewbieImmunity(immunity) { newbieImmunity = immunity; }

export function setMediaRecorder(recorder) { mediaRecorder = recorder; }
export function setAudioChunks(chunks) { audioChunks = chunks; }

// --- ARMORY STATE ---
export let armorySearchQuery = "";
export function setArmorySearchQuery(q) { armorySearchQuery = q; }
