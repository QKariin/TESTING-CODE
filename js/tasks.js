// tasks.js - ID MISMATCH FIXED

import { 
    currentTask, pendingTaskState, taskDatabase, taskQueue, gameStats, 
    resetUiTimer, cooldownInterval, taskJustFinished, ignoreBackendUpdates,
    setCurrentTask, setPendingTaskState, setGameStats, 
    setIgnoreBackendUpdates, setTaskJustFinished, setResetUiTimer, setCooldownInterval
} from './state.js';
import { triggerSound } from './utils.js';

export function getRandomTask() {
    // 1. Check Collateral
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        alert("You are too poor to serve. Earn 300 coins first.");
        return;
    }

    // 2. Generate Task
    setIgnoreBackendUpdates(true);
    if (resetUiTimer) { clearTimeout(resetUiTimer); setResetUiTimer(null); }
    
    let taskText = "AWAITING DIRECTIVE..."; 
    if (taskQueue && taskQueue.length > 0) taskText = taskQueue[0];
    else if (taskDatabase && taskDatabase.length > 0) taskText = taskDatabase[Math.floor(Math.random() * taskDatabase.length)];
    
    const newTask = { text: taskText, category: 'general', timestamp: Date.now() };
    setCurrentTask(newTask);
    
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: newTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    // 3. Update UI
    restorePendingUI();
    
    // Switch to Working Mode (Function in main.js)
    if(window.updateTaskUIState) window.updateTaskUIState(true);
    
    // Auto-Open Drawer to show the task
    if(window.toggleTaskDetails) window.toggleTaskDetails(true);
    
    // 4. Save
    window.parent.postMessage({ type: "savePendingState", pendingState: newPendingState, consumeQueue: true }, "*");
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 5000);
}

export function restorePendingUI() {
    if (resetUiTimer) { clearTimeout(resetUiTimer); setResetUiTimer(null); }
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    // --- UPDATED IDS HERE ---
    document.getElementById('mainButtonsArea').classList.add('hidden');
    
    // Show Upload Button
    const uploadBtn = document.getElementById('uploadBtnContainer');
    if(uploadBtn) uploadBtn.classList.remove('hidden');

    // Show Timer
    const timerRow = document.getElementById('activeTimerRow');
    if(timerRow) timerRow.classList.remove('hidden');
    
    // Hide Idle Text
    const idleMsg = document.getElementById('idleMessage');
    if(idleMsg) idleMsg.classList.add('hidden');

    // Set Task Text
    const taskEl = document.getElementById('readyText');
    if (taskEl && currentTask) {
        taskEl.innerHTML = currentTask.text;
    }
    
    // Start Timer Logic
    const targetTime = parseInt(pendingTaskState?.endTime);
    if (!targetTime) return;

    const newInterval = setInterval(() => {
        const diff = targetTime - Date.now();
        if (diff <= 0) {
            clearInterval(newInterval);
            setCooldownInterval(null);
            const td = document.getElementById('timerDisplay');
            if(td) td.textContent = "00:00:00";
            applyPenaltyFail("TIMEOUT");
            return;
        }
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        
        const td = document.getElementById('timerDisplay');
        if(td) td.textContent = `${h}:${m}:${s}`;
    }, 1000);
    
    setCooldownInterval(newInterval);
}

function applyPenaltyFail(reason) {
    triggerSound('sfx-deny');
    const newBalance = Math.max(0, gameStats.coins - 300);
    setGameStats({ coins: newBalance });
    const coinsEl = document.getElementById('coins');
    if (coinsEl) coinsEl.textContent = newBalance;

    window.parent.postMessage({ 
        type: "taskSkipped", 
        taskTitle: currentTask ? currentTask.text : "Unknown Task",
        reason: reason
    }, "*");

    finishTask(false);
}

export function finishTask(success) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    setTaskJustFinished(true);
    setPendingTaskState(null);
    setCooldownInterval(null);
    
    const celebration = document.getElementById('celebrationOverlay');
    if (celebration && success) {
        celebration.classList.add('active');
        setTimeout(() => celebration.classList.remove('active'), 2500);
    }
    
    resetTaskDisplay(success);
    setTimeout(() => { setTaskJustFinished(false); setIgnoreBackendUpdates(false); }, 5000);
}

export function cancelPendingTask() {
    if (!currentTask) return;
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        alert("You cannot afford the 300 coin skip fee.");
        return;
    }
    applyPenaltyFail("MANUAL_SKIP");
}

export function resetTaskDisplay(success) {
    // Switch to Idle Mode
    if(window.updateTaskUIState) window.updateTaskUIState(false);
    
    const tc = document.getElementById('readyText');
    if(tc) {
        const color = success ? '#c5a059' : '#8b0000';
        const text = success ? 'DIRECTIVE COMPLETE' : 'FAILURE RECORDED (-300 🪙)';
        tc.innerHTML = `<span style="color:${color}">${text}</span>`;
    }
    
    setCurrentTask(null);
    
    const timer = setTimeout(() => {
        if(tc) tc.innerText = "AWAITING ORDERS";
        setResetUiTimer(null);
    }, 4000);
    
    setResetUiTimer(timer);
}
