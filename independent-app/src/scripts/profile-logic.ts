import { getState, setState } from './profile-state';
import { createClient } from '../utils/supabase/client';
import { getHierarchyReport } from './hierarchy-rules';

export async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
}

export async function claimKneelReward(type: 'coins' | 'points') {
    const { id, memberId } = getState();
    const pid = id || memberId;
    if (!pid) return;

    try {
        const amount = type === 'coins' ? 100 : 500;
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'CLAIM_KNEEL_REWARD',
                memberId: pid,
                payload: { type, amount }
            })
        });
        const data = await res.json();
        if (data.success) {
            const currentState = getState();
            if (type === 'coins') setState({ wallet: currentState.wallet + amount });
            else setState({ score: currentState.score + amount });

            document.getElementById('kneelRewardOverlay')?.classList.add('hidden');
            document.getElementById('mobKneelReward')?.classList.add('hidden');
            triggerCoinShower();

            // Re-render sidebar if desktop
            renderProfileSidebar(getState());
        }
    } catch (err) {
        console.error("Error claiming reward", err);
    }
}

export function switchTab(tab: string) {
    const views = ['viewServingTopDesktop', 'historySection', 'viewNews', 'viewBuy'];
    views.forEach(v => {
        document.getElementById(v)?.classList.add('hidden');
    });

    const target = {
        'serve': 'viewServingTopDesktop',
        'record': 'historySection',
        'news': 'viewNews',
        'buy': 'viewBuy'
    }[tab];

    if (target) {
        const el = document.getElementById(target);
        if (el) el.classList.remove('hidden');
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

export async function getRandomTask() {
    const { id, memberId } = getState();
    const pid = id || memberId;
    if (!pid) return;

    try {
        console.log("Requesting task for:", pid);
        // Implementation for task generation...
    } catch (err) {
        console.error("Error getting task", err);
    }
}

export async function cancelPendingTask() {
    const { id, memberId, wallet } = getState();
    const pid = id || memberId;
    if (!pid || wallet < 300) return;

    try {
        await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'TRANSACTION',
                memberId: pid,
                payload: { amount: -300, category: 'TASK_SKIP' }
            })
        });
        setState({ wallet: wallet - 300 });
        renderProfileSidebar(getState());
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
export function mobileSkipTask() { cancelPendingTask(); }
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
    if (!user) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop();
        const fileName = `avatars/${user.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            console.error('Upload failed:', uploadError);
            return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('member_id', user.email);

        // Live update the photo on page
        const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
        if (elProfilePic) elProfilePic.src = publicUrl;
        const elMobPic = document.getElementById('hudUserPic') as HTMLImageElement;
        if (elMobPic) elMobPic.src = publicUrl;

        // Re-fetch and re-render
        const { data: updated } = await supabase.from('profiles').select('*').eq('member_id', user.email).maybeSingle();
        if (updated) renderProfileSidebar(updated);
    };
    input.click();
}

export function openTextFieldModal(fieldId: string, label: string) {
    // Remove existing modal if any
    document.getElementById('_reqModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_reqModal';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;`;

    const box = document.createElement('div');
    box.style.cssText = `background:#0a0a0f;border:1px solid #c5a059;border-radius:12px;padding:28px;width:90%;max-width:440px;font-family:'Orbitron';`;
    box.innerHTML = `
        <div style="color:#c5a059;font-size:0.7rem;letter-spacing:2px;margin-bottom:12px;">${label.toUpperCase()}</div>
        <textarea id="_reqInput" placeholder="Enter your ${label.toLowerCase()}..." style="width:100%;min-height:100px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.3);color:#fff;padding:10px;border-radius:6px;font-family:'Cinzel';font-size:0.8rem;resize:vertical;"></textarea>
        <div style="display:flex;gap:10px;margin-top:14px;">
            <button id="_reqSave" style="flex:1;padding:10px;background:#c5a059;color:#000;border:none;border-radius:6px;font-family:'Orbitron';font-weight:bold;cursor:pointer;letter-spacing:1px;">SAVE</button>
            <button id="_reqCancel" style="flex:1;padding:10px;background:transparent;color:#c5a059;border:1px solid #c5a059;border-radius:6px;font-family:'Orbitron';cursor:pointer;">CANCEL</button>
        </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('_reqCancel')!.onclick = () => overlay.remove();
    document.getElementById('_reqSave')!.onclick = () => saveTextField(fieldId, label, overlay);
}

async function saveTextField(fieldId: string, label: string, overlay: HTMLElement) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const value = (document.getElementById('_reqInput') as HTMLTextAreaElement)?.value?.trim();
    if (!value) return;

    const { error } = await supabase
        .from('profiles')
        .update({ [fieldId]: value })
        .eq('member_id', user.email);

    if (error) { console.error(`Failed to save ${label}:`, error); return; }

    overlay.remove();

    // Re-fetch and re-render
    const { data: updated } = await supabase.from('profiles').select('*').eq('member_id', user.email).maybeSingle();
    if (updated) renderProfileSidebar(updated);
}

export function renderProfileSidebar(u: any) {
    if (!u || typeof document === 'undefined') return;

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
            let addBtn = '';
            if (!done && fieldId) {
                if (fieldId === 'avatar_url') {
                    addBtn = `<button onclick="window.__profileHandlers?.uploadPhoto()" style="padding:3px 10px;background:#c5a059;color:#000;border:none;border-radius:4px;font-family:'Orbitron';font-size:0.5rem;font-weight:bold;cursor:pointer;letter-spacing:1px;">ADD</button>`;
                } else {
                    addBtn = `<button onclick="window.__profileHandlers?.openField('${fieldId}','${label}')" style="padding:3px 10px;background:#c5a059;color:#000;border:none;border-radius:4px;font-family:'Orbitron';font-size:0.5rem;font-weight:bold;cursor:pointer;letter-spacing:1px;">ADD</button>`;
                }
            }
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

        // Register handlers on window so inline onclick can call them
        (window as any).__profileHandlers = {
            uploadPhoto: handleProfileUpload,
            openField: openTextFieldModal,
        };

        // Simple stat counters
        const elPoints = document.getElementById('points');
        if (elPoints) elPoints.innerText = (u.score || 0).toLocaleString();
        const elCoins = document.getElementById('coins');
        if (elCoins) elCoins.innerText = (u.wallet || 0).toLocaleString();
    }
}
