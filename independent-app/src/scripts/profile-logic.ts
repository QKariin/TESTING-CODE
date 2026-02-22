import { getState, setState } from './profile-state';
import { createClient } from '../utils/supabase/client';
import { getHierarchyReport } from './hierarchy-rules';

export async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
}

export async function claimKneelReward(type: 'coins' | 'points') {
    // 1. Get Current State
    const currentState = getState();
    const { id, memberId, wallet, score } = currentState;
    const pid = id || memberId;
    
    if (!pid) return;

    // 2. Define Correct Amounts
    const amount = type === 'coins' ? 10 : 50;

    // 3. OPTIMISTIC UPDATE (Update UI Immediately)
    console.log(`[REWARD] Claiming ${amount} ${type}...`);

    // Update Local State
    if (type === 'coins') {
        setState({ wallet: (wallet || 0) + amount });
        triggerCoinShower();
    } else {
        setState({ score: (score || 0) + amount });
    }

    // Hide Overlays Instantly (Handle both class and inline styles)
    const deskOverlay = document.getElementById('kneelRewardOverlay');
    if (deskOverlay) {
        deskOverlay.classList.add('hidden');
        deskOverlay.style.display = 'none';
    }

    const mobOverlay = document.getElementById('mobKneelReward');
    if (mobOverlay) {
        mobOverlay.classList.add('hidden');
        mobOverlay.style.display = 'none';
    }

    // Play Sound
    const snd = document.getElementById('coinSound') as HTMLAudioElement;
    if (snd) {
        snd.currentTime = 0; // Reset sound so it plays fresh
        snd.play().catch(e => console.log("Audio blocked", e));
    }

    // Re-render Sidebar Numbers
    renderProfileSidebar(getState());

    // 4. BACKGROUND SAVE (Don't wait for this)
    try {
        fetch('/api/profile-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'CLAIM_KNEEL_REWARD',
                memberId: pid,
                payload: { type, amount }
            })
        }).then(res => res.json())
          .then(data => {
              if (!data.success) console.warn('[REWARD] Server sync warning:', data.error);
          });
    } catch (err) {
        console.error("[REWARD] Background save failed", err);
        // Note: We don't rollback state here to keep the game feeling smooth.
        // The next page load will sync with the true DB value anyway.
    }
}

export function switchTab(tab: string) {
    const views = ['viewServingTopDesktop', 'historySection', 'viewNews', 'viewBuy'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none'; // Force hide to override legacy CSS
        }
    });

    const target = {
        'serve': 'viewServingTopDesktop',
        'record': 'historySection',
        'news': 'viewNews',
        'buy': 'viewBuy'
    }[tab];

    if (target) {
        const el = document.getElementById(target);
        if (el) {
            el.classList.remove('hidden');
            // Desktop serve view is a grid, others are flex columns
            el.style.display = target === 'viewServingTopDesktop' ? 'grid' : 'flex';
        }
    }

    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => b.classList.remove('active'));
}

export async function revealFragment() {
    const { id, memberId } = getState();
    const pid = id || memberId;
    if (!pid) return;

    try {
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({ type: 'REVEAL_FRAGMENT', memberId: pid })
        });
        const data = await res.json();
        if (data.success) {
            const { pick, progress, revealMapCount } = data.result;
            setState({
                revealMap: data.result.revealMap || [],
                libraryProgress: progress
            });
            renderProfileSidebar(getState());
            return data.result;
        }
    } catch (err) {
        console.error("Error revealing fragment", err);
    }
}

export function toggleRewardGrid() {
    const section = document.getElementById('revealSection');
    if (section) {
        section.style.display = section.style.display === 'none' ? 'flex' : 'none';
    }
}

export function triggerCoinShower() {
    console.log("💰 Coin shower triggered!");
}

export function toggleTributeHunt() {
    const overlay = document.getElementById('tributeHuntOverlay');
    overlay?.classList.toggle('hidden');
}

export function openLobby() {
    document.getElementById('lobbyOverlay')?.classList.remove('hidden');
}

export function closeLobby() {
    document.getElementById('lobbyOverlay')?.classList.add('hidden');
}

let taskInterval: any = null;

export function startTaskTimer(ms: number) {
    if (taskInterval) clearInterval(taskInterval);

    const updateUI = (totalMs: number) => {
        const hrs = document.getElementById('timerH');
        const mins = document.getElementById('timerM');
        const secs = document.getElementById('timerS');

        const h = Math.floor(totalMs / (1000 * 60 * 60));
        const m = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((totalMs % (1000 * 60)) / 1000);

        if (hrs) hrs.innerText = String(h).padStart(2, '0');
        if (mins) mins.innerText = String(m).padStart(2, '0');
        if (secs) secs.innerText = String(s).padStart(2, '0');
    };

    let remaining = ms;
    updateUI(remaining);

    taskInterval = setInterval(() => {
        remaining -= 1000;
        if (remaining <= 0) {
            clearInterval(taskInterval);
            remaining = 0;
            const mainArea = document.getElementById('mainButtonsArea');
            const activeArea = document.getElementById('activeTaskContent');
            const readyText = document.getElementById('readyText');
            const qmIdle = document.getElementById('qm_TaskIdle');
            const qmActive = document.getElementById('qm_TaskActive');
            const mobTaskText = document.getElementById('mobTaskText');

            if (mainArea) mainArea.style.display = 'flex';
            if (activeArea) activeArea.classList.add('hidden');
            if (readyText) readyText.innerText = '-';
            if (qmIdle) qmIdle.classList.remove('hidden');
            if (qmActive) qmActive.classList.add('hidden');
            if (mobTaskText) mobTaskText.innerText = '-';
        }
        updateUI(remaining);
    }, 1000);
}

export async function getRandomTask(isSilentInit = false) {
    const { id, memberId } = getState();
    const pid = id || memberId;
    if (!pid) return;

    try {
        console.log("Requesting task from tasks_database API...");

        const mainArea = document.getElementById('mainButtonsArea');
        const activeArea = document.getElementById('activeTaskContent');
        const readyText = document.getElementById('readyText');
        const uploadCont = document.getElementById('uploadBtnContainer');

        // Mobile IDs
        const qmIdle = document.getElementById('qm_TaskIdle');
        const qmActive = document.getElementById('qm_TaskActive');
        const mobTaskText = document.getElementById('mobTaskText');

        if (!isSilentInit) {
            if (mainArea) mainArea.style.display = 'none';
            if (activeArea) activeArea.classList.remove('hidden');
            if (readyText) readyText.innerText = 'Connecting to the Void...';

            if (qmIdle) qmIdle.classList.add('hidden');
            if (qmActive) qmActive.classList.remove('hidden');
            if (mobTaskText) mobTaskText.innerText = 'Transmitting orders...';
        }

        // If not silent init, we are FORCING a new task assignment
        const forceNew = !isSilentInit;
        const res = await fetch(`/api/tasks/random?memberEmail=${encodeURIComponent(pid)}&forceNew=${forceNew}`);
        const data = await res.json();

        if (!data.success) {
            if (isSilentInit) return;
            console.error("Supabase API Error:", data.error);
            if (readyText) readyText.innerText = 'Failed to retrieve task. See console.';
            return;
        }

        // If no task returned (not active and not forced), reset UI to "Request Task"
        if (!data.task) {
            if (mainArea) mainArea.style.display = 'block';
            if (activeArea) activeArea.classList.add('hidden');
            if (qmIdle) qmIdle.classList.remove('hidden');
            if (qmActive) qmActive.classList.add('hidden');
            return;
        }

        // Show active task area and buttons
        if (mainArea) mainArea.style.display = 'none';
        if (activeArea) {
            activeArea.classList.remove('hidden');
            activeArea.style.display = 'flex';
        }
        if (uploadCont) {
            uploadCont.classList.remove('hidden');
            uploadCont.style.display = 'flex';
        }

        if (qmIdle) qmIdle.classList.add('hidden');
        if (qmActive) {
            qmActive.classList.remove('hidden');
            qmActive.style.display = 'block';
        }

        // Update UI with the task text
        const taskMsg = data.task.TaskText || data.task.tasktext || 'Perform the assigned duty.';
        if (readyText) readyText.innerText = taskMsg;
        if (mobTaskText) mobTaskText.innerText = taskMsg;

        // Handle Timer
        const timeLeftMs = data.timeLeftMs || (24 * 60 * 60 * 1000);
        startTaskTimer(timeLeftMs);

    } catch (err) {
        console.error("Error getting task", err);
        const readyText = document.getElementById('readyText');
        if (!isSilentInit && readyText) readyText.innerText = 'An error occurred fetching the task.';
    }
}

export async function skipTask() {
    const { id, memberId, wallet } = getState();
    const pid = id || memberId;
    if (!pid) return;

    if (wallet < 300) {
        alert("Insufficient Capital. 300 coins required to skip duties.");
        return;
    }

    if (!confirm("Are you sure you wish to skip this duty for 300 coins?")) return;

    try {
        const res = await fetch('/api/tasks/skip', {
            method: 'POST',
            body: JSON.stringify({ memberEmail: pid })
        });
        const data = await res.json();

        if (data.success) {
            setState({ wallet: data.newWallet });
            renderProfileSidebar(getState());

            // Reset UI
            if (taskInterval) clearInterval(taskInterval);
            const mainArea = document.getElementById('mainButtonsArea');
            const activeArea = document.getElementById('activeTaskContent');
            const readyText = document.getElementById('readyText');
            const qmIdle = document.getElementById('qm_TaskIdle');
            const qmActive = document.getElementById('qm_TaskActive');
            const mobTaskText = document.getElementById('mobTaskText');

            if (mainArea) mainArea.style.display = 'flex';
            if (activeArea) activeArea.classList.add('hidden');
            if (readyText) readyText.innerText = '-';
            if (qmIdle) qmIdle.classList.remove('hidden');
            if (qmActive) qmActive.classList.add('hidden');
            if (mobTaskText) mobTaskText.innerText = '-';
        } else {
            alert(data.error || "Failed to skip task.");
        }
    } catch (err) {
        console.error("Error skipping task", err);
    }
}

export function openQueenMenu() {
    document.getElementById('queenOverlay')?.classList.remove('hidden');
}

export function closeQueenMenu() {
    document.getElementById('queenOverlay')?.classList.add('hidden');
}

export function toggleMobileStats() {
    const content = document.getElementById('mobStatsContent');
    const arrow = document.getElementById('mobStatsArrow');
    if (content) {
        const isHidden = content.classList.toggle('hidden');
        if (arrow) arrow.innerText = isHidden ? '▼' : '▲';
    }
}

export function toggleMobileChat(show: boolean) {
    if (show) {
        document.getElementById('inlineChatPanel')?.classList.remove('hidden');
        document.getElementById('btnEnterChatPanel')?.classList.add('hidden');
    } else {
        document.getElementById('inlineChatPanel')?.classList.add('hidden');
        document.getElementById('btnEnterChatPanel')?.classList.remove('hidden');
    }
}

export function mobileRequestTask() { getRandomTask(); }
export function mobileSkipTask() { skipTask(); }
export function mobileUploadEvidence(input: HTMLInputElement) { console.log("Upload evidence", input.files); }

export function handleRoutineUpload(input: HTMLInputElement) { console.log("Routine upload", input.files); }
export function handleProfileUpload(input?: HTMLInputElement) { _doProfileUpload(); }
export function handleAdminUpload(input: HTMLInputElement) { console.log("Admin upload", input.files); }

export function handleMediaPlus() {
    const input = document.getElementById('chatMediaInput') as HTMLInputElement;
    input?.click();
}

export function handleChatKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') sendChatMessage();
}

export async function sendChatMessage() {
    const { id, memberId } = getState();
    const pid = id || memberId;
    const input = document.getElementById('chatMsgInput') as HTMLInputElement;
    const msg = input?.value;

    if (msg && pid) {
        try {
            await fetch('/api/profile-action', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'MESSAGE',
                    memberId: pid,
                    payload: { text: msg }
                })
            });
            console.log("Message sent:", msg);
            input.value = '';
            // Ideally trigger a chat refresh or optimistic UI update
        } catch (err) {
            console.error("Failed to send message", err);
        }
    }
}

export async function buyRealCoins(amount: number) {
    console.log("Redirecting to Stripe for amount:", amount);
    // In a real flow: window.location.href = `/api/stripe/checkout?amount=${amount}`;
}

export function toggleRewardSubMenu(show: boolean) {
    document.getElementById('reward-buy-menu')?.classList.toggle('hidden', !show);
    document.getElementById('reward-main-menu')?.classList.toggle('hidden', show);
}

export async function buyRewardFragment(cost: number) {
    const { id, memberId, wallet } = getState();
    const pid = id || memberId;
    if (!pid || wallet < cost) return;

    try {
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'TRANSACTION',
                memberId: pid,
                payload: { amount: -cost, category: 'FRAGMENT_BUY' }
            })
        });
        const data = await res.json();
        if (data.success) {
            setState({ wallet: wallet - cost });
            await revealFragment();
            renderProfileSidebar(getState());
        }
    } catch (err) {
        console.error("Error buying fragment", err);
    }
}

export function closeModal() { document.getElementById('glassModal')!.style.display = 'none'; }
export function closePoverty() { document.getElementById('povertyOverlay')?.classList.add('hidden'); }
export function goToExchequer() { switchTab('buy'); closePoverty(); }
export function closeRewardCard() { document.getElementById('rewardCardOverlay')?.classList.add('hidden'); }
export function closeExchequer() { document.getElementById('mobExchequer')?.classList.add('hidden'); }

export function showLobbyAction(type: string) {
    document.getElementById('lobbyMenu')?.classList.add('hidden');
    document.getElementById('lobbyActionView')?.classList.remove('hidden');
}

export function confirmLobbyAction() {
    backToLobbyMenu();
}

export function backToLobbyMenu() {
    document.getElementById('lobbyMenu')?.classList.remove('hidden');
    document.getElementById('lobbyActionView')?.classList.add('hidden');
}

export function selectRoutineItem(el: HTMLElement, type: string) {
    document.querySelectorAll('.routine-tile').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

// ─── ADD HANDLERS FOR MISSING REQUIREMENTS ────────────────────────────────────

async function _doProfileUpload() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        // Show uploading indicator on the avatar
        const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
        if (elProfilePic) elProfilePic.style.opacity = '0.5';

        // Read file as base64 data URL (no storage bucket needed)
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;

            const res = await fetch('/api/profile-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberEmail: user.email, field: 'avatar_url', value: dataUrl })
            });
            const data = await res.json();

            if (elProfilePic) elProfilePic.style.opacity = '1';

            if (data.success && data.profile) {
                // Live update photos
                if (elProfilePic) elProfilePic.src = dataUrl;
                const elMobPic = document.getElementById('hudUserPic') as HTMLImageElement;
                if (elMobPic) elMobPic.src = dataUrl;
                renderProfileSidebar(data.profile);
            } else {
                console.error('Photo save failed:', data.error);
                alert('Photo upload failed: ' + (data.error || 'Unknown error'));
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ─── CHIP LISTS (ported from Velo KINK_LIST) ──────────────────────────────────
const CHIP_LIST = [
    "JOI", "Humiliation", "SPH", "Findom", "D/s", "Control", "Ownership",
    "Chastity", "CEI", "Blackmail play", "Objectification", "Degradation",
    "Task submission", "CBT", "Training", "Power exchange", "Verbal domination",
    "Protocol", "Obedience", "Psychological domination"
];
const ROUTINE_OPTIONS = ["Morning Kneel", "Chastity Check", "Cleanliness Check", "Custom Order"];

export function openTextFieldModal(fieldId: string, label: string) {
    document.getElementById('_reqModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_reqModal';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;`;

    const box = document.createElement('div');
    box.style.cssText = `background:#07080f;border:1px solid #c5a059;border-radius:12px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;font-family:'Orbitron';`;

    const isChip = fieldId === 'kinks' || fieldId === 'limits';
    const isRoutine = fieldId === 'routine';
    const costPerItem = fieldId === 'kinks' ? 100 : fieldId === 'limits' ? 200 : 0;

    let inner = `<div style="color:#c5a059;font-size:0.75rem;letter-spacing:3px;margin-bottom:6px;">${label.toUpperCase()}</div>`;

    if (isChip) {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:14px;letter-spacing:1px;">SELECT AT LEAST 3 · ${costPerItem} COINS EACH</div>`;
        inner += `<div id="_chipGrid" style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;margin-bottom:14px;padding-right:4px;">`;
        CHIP_LIST.forEach(item => {
            inner += `<div class="_reqChip" data-value="${item}" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid #2a2a2a;background:rgba(0,0,0,0.5);color:#888;font-family:'Cinzel',serif;font-size:0.8rem;cursor:pointer;border-radius:4px;transition:all 0.2s;">
                <span>${item}</span><span style="font-size:0.65rem;color:#555;">${costPerItem}</span>
            </div>`;
        });
        inner += `</div>`;
        inner += `<div id="_reqCostDisplay" style="color:#c5a059;font-size:0.65rem;letter-spacing:2px;margin-bottom:12px;">TOTAL COST: 0 COINS</div>`;

    } else if (isRoutine) {
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:14px;letter-spacing:1px;">PRESET: 1,000 COINS · CUSTOM: 2,000 COINS</div>`;
        inner += `<div id="_chipGrid" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">`;
        ROUTINE_OPTIONS.forEach(item => {
            const cost = item === 'Custom Order' ? 2000 : 1000;
            inner += `<div class="_reqChip _routineChip" data-value="${item}" data-cost="${cost}" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border:1px solid #2a2a2a;background:rgba(0,0,0,0.5);color:#888;font-family:'Cinzel',serif;font-size:0.85rem;cursor:pointer;border-radius:4px;transition:all 0.2s;">
                <span>${item}</span><span style="font-size:0.65rem;color:#555;">${cost.toLocaleString()}</span>
            </div>`;
        });
        inner += `</div>`;
        inner += `<div id="_customRoutineWrap" style="display:none;margin-bottom:12px;">
            <input id="_customRoutineInput" placeholder="Describe your custom routine..." style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;border-radius:6px;font-family:'Cinzel';font-size:0.8rem;" />
        </div>`;
        inner += `<div id="_reqCostDisplay" style="color:#c5a059;font-size:0.65rem;letter-spacing:2px;margin-bottom:12px;">SELECT A PROTOCOL</div>`;

    } else {
        // Plain textarea for name / identity
        inner += `<div style="color:rgba(255,255,255,0.35);font-size:0.55rem;margin-bottom:12px;">STORED IN YOUR PROFILE · FREE</div>`;
        inner += `<textarea id="_reqInput" placeholder="Enter your ${label.toLowerCase()}..." style="width:100%;min-height:90px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;padding:10px;border-radius:6px;font-family:'Cinzel';font-size:0.8rem;resize:vertical;"></textarea>`;
    }

    inner += `<div id="_reqError" style="color:#ff4444;font-size:0.55rem;margin-top:6px;display:none;margin-bottom:8px;"></div>`;
    inner += `<div style="display:flex;gap:10px;margin-top:10px;">
        <button id="_reqSave" style="flex:1;padding:10px;background:#c5a059;color:#000;border:none;border-radius:6px;font-family:'Orbitron';font-weight:bold;cursor:pointer;letter-spacing:1px;">SAVE</button>
        <button id="_reqCancel" style="flex:1;padding:10px;background:transparent;color:#c5a059;border:1px solid #c5a059;border-radius:6px;font-family:'Orbitron';cursor:pointer;">CANCEL</button>
    </div>`;

    box.innerHTML = inner;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // ── Chip click logic (kinks/limits)
    if (isChip) {
        box.querySelectorAll<HTMLElement>('._reqChip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('_selected');
                const isOn = chip.classList.contains('_selected');
                chip.style.borderColor = isOn ? '#c5a059' : '#2a2a2a';
                chip.style.color = isOn ? '#c5a059' : '#888';
                chip.style.background = isOn ? 'rgba(197,160,89,0.1)' : 'rgba(0,0,0,0.5)';
                const count = box.querySelectorAll('._selected').length;
                const costDisplay = document.getElementById('_reqCostDisplay')!;
                if (costDisplay) costDisplay.textContent = `TOTAL COST: ${(count * costPerItem).toLocaleString()} COINS`;
            });
        });
    }

    // ── Routine chip logic (single select)
    if (isRoutine) {
        box.querySelectorAll<HTMLElement>('._routineChip').forEach(chip => {
            chip.addEventListener('click', () => {
                box.querySelectorAll<HTMLElement>('._routineChip').forEach(c => {
                    c.classList.remove('_selected');
                    c.style.borderColor = '#2a2a2a'; c.style.color = '#888'; c.style.background = 'rgba(0,0,0,0.5)';
                });
                chip.classList.add('_selected');
                chip.style.borderColor = '#c5a059'; chip.style.color = '#c5a059'; chip.style.background = 'rgba(197,160,89,0.1)';
                const cost = parseInt(chip.getAttribute('data-cost') || '1000');
                const costDisplay = document.getElementById('_reqCostDisplay')!;
                if (costDisplay) costDisplay.textContent = `COST: ${cost.toLocaleString()} COINS`;
                const customWrap = document.getElementById('_customRoutineWrap')!;
                if (customWrap) customWrap.style.display = chip.getAttribute('data-value') === 'Custom Order' ? 'block' : 'none';
            });
        });
    }

    document.getElementById('_reqCancel')!.addEventListener('click', () => overlay.remove());
    document.getElementById('_reqSave')!.addEventListener('click', () => saveModalData(fieldId, label, overlay, box, isChip, isRoutine, costPerItem));
}

async function saveModalData(
    fieldId: string, label: string, overlay: HTMLElement, box: HTMLElement,
    isChip: boolean, isRoutine: boolean, costPerItem: number
) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    const saveBtn = document.getElementById('_reqSave') as HTMLButtonElement;
    const errEl = document.getElementById('_reqError') as HTMLElement;
    const showErr = (msg: string) => {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; }
        if (saveBtn) { saveBtn.textContent = 'SAVE'; saveBtn.disabled = false; }
    };

    if (saveBtn) { saveBtn.textContent = 'SAVING...'; saveBtn.disabled = true; }

    let value: string;
    let cost = 0;

    if (isChip) {
        const selected = Array.from(box.querySelectorAll<HTMLElement>('._selected'))
            .map(el => el.getAttribute('data-value') || '').filter(Boolean);
        if (selected.length < 3) { showErr('Select at least 3 items.'); return; }
        value = selected.join(', ');
        cost = selected.length * costPerItem;

    } else if (isRoutine) {
        const selectedChip = box.querySelector<HTMLElement>('._routineChip._selected');
        if (!selectedChip) { showErr('Please select a protocol.'); return; }
        const picked = selectedChip.getAttribute('data-value') || '';
        cost = parseInt(selectedChip.getAttribute('data-cost') || '1000');
        if (picked === 'Custom Order') {
            const custom = (document.getElementById('_customRoutineInput') as HTMLInputElement)?.value?.trim();
            if (!custom) { showErr('Please describe your custom routine.'); return; }
            value = custom;
        } else {
            value = picked;
        }

    } else {
        value = (document.getElementById('_reqInput') as HTMLTextAreaElement)?.value?.trim() || '';
        if (!value) { showErr('Cannot be empty.'); return; }
    }

    const res = await fetch('/api/profile-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberEmail: user.email, field: fieldId, value, cost })
    });
    const data = await res.json();

    if (data.error === 'INSUFFICIENT_FUNDS') {
        showErr(`Insufficient coins. You need ${cost} coins but have ${data.wallet || 0}.`);
    } else if (data.success && data.profile) {
        overlay.remove();
        renderProfileSidebar(data.profile);
    } else {
        showErr('Save failed: ' + (data.error || 'Unknown error'));
    }
}

export function renderProfileSidebar(u: any) {
    if (!u || typeof document === 'undefined') return;

    // Register handlers immediately so ADD buttons always work
    (window as any).__profileHandlers = {
        uploadPhoto: handleProfileUpload,
        openField: openTextFieldModal,
    };

    // --- DYNAMIC RANK CALCULATION (matches Velo logic exactly) ---
    const report = getHierarchyReport(u);
    const { currentRank, nextRank, isMax, currentBenefits, nextBenefits, requirements } = report;

    // Update rank labels
    const elCurRank = document.getElementById('desk_CurrentRank');
    if (elCurRank) elCurRank.innerText = currentRank.toUpperCase();

    const elWorkingOnRank = document.getElementById('desk_WorkingOnRank');
    if (elWorkingOnRank) elWorkingOnRank.innerText = isMax ? 'MAXIMUM RANK' : nextRank.toUpperCase();

    const elDashRank = document.getElementById('desk_DashboardRank');
    if (elDashRank) elDashRank.innerText = currentRank.toUpperCase();

    // Name
    const elSubName = document.getElementById('subName');
    if (elSubName) elSubName.innerText = u.name || 'SLAVE';

    // Email
    const elCurEmail = document.getElementById('subEmail');
    if (elCurEmail) elCurEmail.innerText = u.member_id || '';
    const elMobEmail = document.getElementById('mob_slaveEmail');
    if (elMobEmail) elMobEmail.innerText = u.member_id || '';

    // Photos
    const photoSrc = u.avatar_url || u.profile_picture_url || '';
    if (photoSrc) {
        const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
        if (elProfilePic) elProfilePic.src = photoSrc;
        const elMobUserPic = document.getElementById('hudUserPic') as HTMLImageElement;
        if (elMobUserPic) elMobUserPic.src = photoSrc;
    }

    // Current benefits (first item shown inline)
    const elCurBen = document.getElementById('desk_CurrentBenefits');
    if (elCurBen) elCurBen.innerText = currentBenefits[0] || '';

    // Next rank benefits
    const elNextBen = document.getElementById('desk_NextBenefits');
    if (elNextBen) {
        elNextBen.innerHTML = isMax
            ? '<li>You have reached the apex of servitude.</li>'
            : nextBenefits.map(b => `<li>${b}</li>`).join('');
    }

    // Progress bars and check items
    const container = document.getElementById('desk_ProgressContainer');
    if (container) {
        const buildBar = (label: string, icon: string, current: number, target: number) => {
            const t = isMax ? current : (target || 1);
            const pct = Math.min((current / t) * 100, 100);
            const done = current >= t;
            const color = done ? '#00ff00' : '#c5a059';
            const lc = done ? '#fff' : 'rgba(255,255,255,0.4)';
            const vc = done ? '#00ff00' : '#fff';
            return `<div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;font-size:0.6rem;font-family:'Orbitron';margin-bottom:4px;color:${lc};letter-spacing:1px;">
                    <span>${icon} ${label}</span><span style="color:${vc}">${current.toLocaleString()} / ${t.toLocaleString()}</span>
                </div>
                <div style="width:100%;height:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${color};box-shadow:0 0 10px ${color}40;transition:width 0.5s ease;"></div>
                </div></div>`;
        };

        const buildCheck = (label: string, status: string, fieldId?: string) => {
            const done = status === 'VERIFIED';
            const color = done ? '#00ff00' : '#ff4444';
            const addBtn = (!done && fieldId)
                ? `<button data-prof-action="${fieldId === 'avatar_url' ? 'photo' : 'field'}" data-prof-field="${fieldId}" data-prof-label="${label}" style="padding:3px 10px;background:#c5a059;color:#000;border:none;border-radius:4px;font-family:'Orbitron';font-size:0.5rem;font-weight:bold;cursor:pointer;letter-spacing:1px;">ADD</button>`
                : '';
            return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.6rem;font-family:'Orbitron';letter-spacing:1px;">
                <span style="color:rgba(255,255,255,0.5);">${label}</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:${color};font-weight:bold;">${done ? '✓ VERIFIED' : '✗ MISSING'}</span>
                    ${addBtn}
                </div>
            </div>`;
        };

        const iconMap: Record<string, string> = { LABOR: '🛠️', ENDURANCE: '🧎', MERIT: '✨', SACRIFICE: '💰', CONSISTENCY: '📅' };

        // Map field IDs for ADD buttons
        const fieldIdMap: Record<string, string> = {
            IDENTITY: 'name', PHOTO: 'avatar_url',
            LIMITS: 'limits', KINKS: 'kinks', ROUTINE: 'routine'
        };

        let html = '';
        requirements.forEach(r => {
            if (r.type === 'bar') html += buildBar(r.label, iconMap[r.label] || '•', r.current, r.target);
            else html += buildCheck(r.label, r.status, fieldIdMap[r.label]);
        });

        container.innerHTML = html;

        // Attach click listeners to ADD buttons using data attributes (no fragile global/inline JS)
        container.querySelectorAll<HTMLButtonElement>('[data-prof-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-prof-action');
                const field = btn.getAttribute('data-prof-field') || '';
                const label = btn.getAttribute('data-prof-label') || '';
                if (action === 'photo') {
                    handleProfileUpload();
                } else if (action === 'field') {
                    openTextFieldModal(field, label);
                }
            });
        });

        // Simple stat counters
        const elPoints = document.getElementById('points');
        if (elPoints) elPoints.innerText = (u.score || 0).toLocaleString();
        const elCoins = document.getElementById('coins');
        if (elCoins) elCoins.innerText = (u.wallet || 0).toLocaleString();
    }
}
