// src/scripts/profile-logic.ts

import { getState, setState } from './profile-state';

export async function claimKneelReward(type: 'coins' | 'points') {
    const { memberId } = getState();
    if (!memberId) return;

    try {
        const amount = type === 'coins' ? 100 : 500; // Example values
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'CLAIM_KNEEL_REWARD',
                memberId,
                payload: { type, amount }
            })
        });
        const data = await res.json();
        if (data.success) {
            // Update local state
            const currentState = getState();
            if (type === 'coins') setState({ coins: currentState.coins + amount });
            else setState({ points: currentState.points + amount });

            // Hide overlays
            document.getElementById('kneelRewardOverlay')?.classList.add('hidden');
            document.getElementById('mobKneelReward')?.classList.add('hidden');

            // Trigger shower
            triggerCoinShower();
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
        document.getElementById(target)?.classList.remove('hidden');
    }

    // Update nav buttons
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(b => b.classList.remove('active'));
    // Find button with specific onclick or text
}

export async function revealFragment() {
    const { memberId } = getState();
    if (!memberId) return;

    try {
        const res = await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'REVEAL_FRAGMENT',
                memberId
            })
        });
        const data = await res.json();
        if (data.success) {
            const { pick, revealMapCount } = data.result;
            const currentState = getState();
            const newMap = [...currentState.revealMap, pick];
            setState({ revealMap: newMap });

            if (newMap.length === 9) {
                setState({
                    revealMap: [],
                    libraryProgress: currentState.libraryProgress + 1
                });
            }

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
    console.log("Coin shower triggered!");
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
    const { memberId } = getState();
    if (!memberId) return;

    try {
        const res = await fetch('/api/dashboard-data?memberId=' + memberId); // Use existing dashboard-data route or create a task-specific one
        const data = await res.json();
        const tasks = data.tasks || [];
        if (tasks.length > 0) {
            const task = tasks[Math.floor(Math.random() * tasks.length)];
            // Handle task assignment...
            console.log("Assigned task:", task);
        }
    } catch (err) {
        console.error("Error getting task", err);
    }
}

export async function cancelPendingTask() {
    const { memberId, coins } = getState();
    if (!memberId || coins < 300) return;

    try {
        await fetch('/api/profile-action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'TRANSACTION',
                memberId,
                payload: { amount: -300, category: 'TASK_SKIP' }
            })
        });
        setState({ coins: coins - 300 });
        // Handle UI reset...
    } catch (err) {
        console.error("Error skipping task", err);
    }
}
