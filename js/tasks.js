// tasks.js - FIXED FOR MOBILE TASK TEXT SYNC

import { 
    currentTask, pendingTaskState, taskDatabase, taskQueue, gameStats, 
    resetUiTimer, cooldownInterval, taskJustFinished, ignoreBackendUpdates,
    setCurrentTask, setPendingTaskState, setGameStats, 
    setIgnoreBackendUpdates, setTaskJustFinished, setResetUiTimer, setCooldownInterval
} from './state.js';
import { triggerSound, cleanHTML } from './utils.js';

// Default insults
const DEFAULT_TRASH = [
    "Pathetic. Pay the price.",
    "Disappointing as always.",
    "Your failure feeds me.",
    "Try harder next time, worm.",
    "Obedience is not optional."
];

export function getRandomTask() {
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        injectChatMessage(false, "ACCESS DENIED: 300 🪙 REQUIRED");
        alert("You are too poor to serve. Earn 300 coins first.");
        return;
    }

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
    
    restorePendingUI();
    if(window.updateTaskUIState) window.updateTaskUIState(true);
    if(window.toggleTaskDetails) window.toggleTaskDetails(true);
    
    window.parent.postMessage({ type: "savePendingState", pendingState: newPendingState, consumeQueue: true }, "*");
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 5000);
}

export function restorePendingUI() {
    if (resetUiTimer) { clearTimeout(resetUiTimer); setResetUiTimer(null); }
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    // UI Updates (Visibility)
    const mainBtns = document.getElementById('mainButtonsArea');
    if(mainBtns) mainBtns.classList.add('hidden');
    
    const uploadBtn = document.getElementById('uploadBtnContainer');
    if(uploadBtn) uploadBtn.classList.remove('hidden');
    const timerRow = document.getElementById('activeTimerRow');
    if(timerRow) timerRow.classList.remove('hidden');
    const idleMsg = document.getElementById('idleMessage');
    if(idleMsg) idleMsg.classList.add('hidden');

    // --- FIX: UPDATE BOTH DESKTOP AND MOBILE TEXT ---
    const taskEl = document.getElementById('readyText');
    const mobTaskEl = document.getElementById('mobTaskText'); 
    
    if (currentTask) {
        if (taskEl) taskEl.innerHTML = currentTask.text;
        if (mobTaskEl) {
            mobTaskEl.innerHTML = currentTask.text;
            mobTaskEl.classList.remove('text-pulse'); // Stop "Loading" animation
        }
    }
    
    // Timer Logic
    const targetTime = parseInt(pendingTaskState?.endTime);
    if (!targetTime) return;

    const newInterval = setInterval(() => {
        const diff = targetTime - Date.now();
        
        // GET THE BOXES (Desktop & Mobile share these IDs now via sync or duplicate logic)
        // Note: In your current HTML, Mobile uses qm_timerH. 
        // We will target generic IDs here, main.js sync loop handles the rest, 
        // BUT for safety we can target specific mobile IDs if main.js sync is slow.
        const tH = document.getElementById('timerH');
        const tM = document.getElementById('timerM');
        const tS = document.getElementById('timerS');

        if (diff <= 0) {
            clearInterval(newInterval);
            setCooldownInterval(null);
            if(tH) tH.innerText = "00";
            if(tM) tM.innerText = "00";
            if(tS) tS.innerText = "00";
            applyPenaltyFail("TIMEOUT");
            return;
        }

        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        
        if(tH) tH.innerText = h;
        if(tM) tM.innerText = m;
        if(tS) tS.innerText = s;

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
        taskTitle: "REDACTED", 
        reason: reason
    }, "*");

    finishTask(false);
}

export function finishTask(success) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    setTaskJustFinished(true);
    setPendingTaskState(null);
    setCooldownInterval(null);
    
    if(window.toggleTaskDetails) window.toggleTaskDetails(false);

    if (success) {
        injectChatMessage(true, "DIRECTIVE COMPLETE");
    } else {
        const trashList = (window.CMS_HIERARCHY && window.CMS_HIERARCHY.trash) 
                          ? window.CMS_HIERARCHY.trash 
                          : DEFAULT_TRASH;
        const insult = trashList[Math.floor(Math.random() * trashList.length)];
        
        const failMsg = `FAILURE RECORDED (-300 🪙)<br><span style="font-style:italic; opacity:0.7; font-size:0.8em; margin-top:5px; display:block;">"${insult}"</span>`;
        injectChatMessage(false, failMsg);
    }
    
    resetTaskDisplay(success);
    setTimeout(() => { setTaskJustFinished(false); setIgnoreBackendUpdates(false); }, 5000);
}

function injectChatMessage(isSuccess, htmlContent) {
    const chatBox = document.getElementById('chatContent');
    if (!chatBox) return;

    const cssClass = isSuccess ? "sys-gold" : "sys-red";
    
    const msgHTML = `
        <div class="msg-row system-row">
            <div class="msg-system ${cssClass}">
                ${htmlContent}
            </div>
        </div>`;

    chatBox.innerHTML += msgHTML;
    
    const container = document.getElementById('chatBox');
    if(container) container.scrollTop = container.scrollHeight;
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
    if(window.updateTaskUIState) window.updateTaskUIState(false);
    
    // --- FIX: UPDATE BOTH DESKTOP AND MOBILE STATUS ---
    const tc = document.getElementById('readyText');
    const mobTc = document.getElementById('mobTaskText');
    
    const color = success ? '#c5a059' : '#8b0000';
    const text = success ? 'COMPLETE' : 'FAILED';
    const html = `<span style="color:${color}">${text}</span>`;

    if(tc) tc.innerHTML = html;
    if(mobTc) mobTc.innerHTML = html;
    
    setCurrentTask(null);
    
    const timer = setTimeout(() => {
        if(tc) tc.innerText = "AWAITING ORDERS";
        if(mobTc) mobTc.innerText = "AWAITING ORDERS"; // Reset Mobile text
        setResetUiTimer(null);
    }, 4000);
    
    setResetUiTimer(timer);
}
