// src/scripts/dashboard-protocol.ts
// Dashboard Protocol Management - Converted to TypeScript

import {
    excludedIds, broadcastExclusions, protocolActive, protocolGoal,
    protocolProgress, newbieImmunity, users, broadcastMedia, broadcastPresets,
    setExcludedIds, setBroadcastExclusions, setProtocolActive, setProtocolGoal,
    setProtocolProgress, setNewbieImmunity, setBroadcastMedia, setBroadcastPresets,
    ACCOUNT_ID, API_KEY
} from './dashboard-state';

export function toggleProtocol() {
    const btn = document.getElementById('pdBtn');
    const controls = document.getElementById('pdControls');
    const progress = document.getElementById('pdProgress');

    if (!btn || !controls || !progress) return;

    if (!protocolActive) {
        setProtocolActive(true);
        const goalInp = document.getElementById('pdGoal') as HTMLInputElement;
        setProtocolGoal(parseInt(goalInp?.value) || 1000);
        setProtocolProgress(0);

        btn.innerText = 'ACTIVE';
        btn.classList.add('active-btn');
        controls.style.display = 'none';
        progress.style.display = 'flex';
        updateProtocolProgress();
    } else {
        setProtocolActive(false);
        btn.innerText = 'ENGAGE';
        btn.classList.remove('active-btn');
        controls.style.display = 'flex';
        progress.style.display = 'none';
    }
}

export function updateProtocolProgress() {
    const fill = document.getElementById('pdFill');
    const percEl = document.getElementById('pdPercentage');
    const goalEl = document.getElementById('pdGoalDisplay');
    const circle = document.querySelector('.vg-circle') as HTMLElement;

    const percentage = Math.min(100, (protocolProgress / (protocolGoal || 1)) * 100);

    if (fill) fill.style.width = percentage + '%';
    if (percEl) percEl.innerText = Math.round(percentage) + '%';
    if (goalEl) goalEl.innerText = protocolGoal.toString();
    if (circle) circle.style.background = `conic-gradient(var(--blue-accent) ${percentage}%, transparent 0%)`;

    if (protocolActive && protocolProgress >= protocolGoal) {
        toggleProtocol();
    }
}

export function toggleNewbieImmunity() {
    setNewbieImmunity(!newbieImmunity);
}

export function openExclusionModal() {
    const modal = document.getElementById('exclusionModal');
    if (modal) modal.classList.add('active');
}

export function closeExclusionModal() {
    const modal = document.getElementById('exclusionModal');
    if (modal) modal.classList.remove('active');
}

export function toggleExclusion(id: string) {
    if (excludedIds.includes(id)) {
        setExcludedIds(excludedIds.filter(x => x !== id));
    } else {
        setExcludedIds([...excludedIds, id]);
    }
}

export function openBroadcastModal() {
    const modal = document.getElementById('broadcastModal');
    if (modal) modal.classList.add('active');
}

export function closeBroadcastModal() {
    const modal = document.getElementById('broadcastModal');
    if (modal) modal.classList.remove('active');
}

export async function handleBroadcastFile(input: HTMLInputElement) {
    if (input.files?.[0]) {
        console.log("Broadcast file upload requested:", input.files[0].name);
    }
}

import { insertMessage } from '@/actions/velo-actions';

export async function sendBroadcast() {
    const txtEl = document.getElementById('brText') as HTMLTextAreaElement;
    const txt = txtEl?.value;

    if (!txt) {
        alert("Please enter a message.");
        return;
    }

    const targets = users.filter(u => !excludedIds.includes(u.memberId));
    if (targets.length === 0) {
        alert("No targets selected (check exclusions).");
        return;
    }

    if (!confirm(`Send broadcast to ${targets.length} users?`)) return;

    // Show loading state
    const btn = document.querySelector('.br-btn') as HTMLButtonElement;
    if (btn) btn.innerText = "SENDING...";

    try {
        // Send in chunks or sequentially to avoid overwhelming browser/network if many
        // For now, sequential await needed because insertMessage is async
        let count = 0;
        for (const u of targets) {
            await insertMessage({
                memberId: u.memberId,
                message: txt,
                sender: 'queen',
                type: 'text',
                read: false
            });
            count++;
        }

        alert(`Broadcast sent to ${count} slaves.`);
        txtEl.value = "";
        closeBroadcastModal();
    } catch (e: any) {
        console.error("Broadcast partial failure", e);
        alert("Error during broadcast: " + e.message);
    } finally {
        if (btn) btn.innerText = "SEND BROADCAST";
    }
}

export function saveBroadcastPreset() {
    console.log("Broadcast preset saved");
}

export function togglePresets() {
    const list = document.getElementById('presetList');
    if (list) list.style.display = list.style.display === 'none' ? 'flex' : 'none';
}

if (typeof window !== 'undefined') {
    (window as any).toggleProtocol = toggleProtocol;
    (window as any).updateProtocolProgress = updateProtocolProgress;
    (window as any).toggleNewbieImmunity = toggleNewbieImmunity;
    (window as any).openExclusionModal = openExclusionModal;
    (window as any).closeExclusionModal = closeExclusionModal;
    (window as any).toggleExclusion = toggleExclusion;
    (window as any).openBroadcastModal = openBroadcastModal;
    (window as any).closeBroadcastModal = closeBroadcastModal;
    (window as any).handleBroadcastFile = handleBroadcastFile;
    (window as any).sendBroadcast = sendBroadcast;
    (window as any).saveBroadcastPreset = saveBroadcastPreset;
    (window as any).togglePresets = togglePresets;
}
