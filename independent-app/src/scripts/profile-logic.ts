import { getState, setState } from './profile-state';
import { createClient } from '../utils/supabase/client';

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
export function handleProfileUpload(input: HTMLInputElement) { console.log("Profile upload", input.files); }
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

const REWARD_DATA = {
    ranks: [
        {
            name: "HALL BOY", tax: 20,
            req: { tasks: 0, kneels: 0, score: 0, spent: 0, streak: 0 },
            benefits: ["Identity: You are granted a Name.", "Labor: Permission to begin Basic Tasks.", "Speak Cost: 20 Coins."]
        },
        {
            name: "FOOTMAN", tax: 15,
            req: { tasks: 5, kneels: 10, score: 2000, spent: 0, streak: 0, name: true, photo: true },
            benefits: ["Presence: Your Face may be revealed.", "Order: Access to the Daily Routine.", "Speak Cost: 15 Coins."]
        },
        {
            name: "SILVERMAN", tax: 10,
            req: { tasks: 25, kneels: 65, score: 5000, spent: 5000, streak: 5, limits: true, kinks: true },
            benefits: ["Chat Upgrade: Permission to send Photos.", "Devotion: Tasks tailored to your Desires.", "Booking: Permission to request Sessions.", "Speak Cost: 10 Coins."]
        },
        {
            name: "BUTLER", tax: 5,
            req: { tasks: 100, kneels: 250, score: 10000, spent: 10000, streak: 10 },
            benefits: ["Chat Upgrade: Permission to send Videos.", "Voice: Access to Audio Sessions.", "Speak Cost: 5 Coins."]
        },
        {
            name: "CHAMBERLAIN", tax: 0,
            req: { tasks: 300, kneels: 750, score: 50000, spent: 50000, streak: 30 },
            benefits: ["Speech: All messaging is Free.", "Visuals: Access to Video Sessions.", "Honor: Access to Elite Trials."]
        },
        {
            name: "SECRETARY", tax: 0,
            req: { tasks: 500, kneels: 1500, score: 100000, spent: 100000, streak: 100 },
            benefits: ["The Line: A direct Audio Connection.", "Authority: Access to System Commands.", "The Throne: Total, Unfiltered Access."]
        },
        {
            name: "QUEEN'S CHAMPION", tax: 0,
            req: { tasks: 1000, kneels: 3000, score: 250000, spent: 1000000, streak: 365 },
            benefits: ["Absolute Authority.", "Manifest Will.", "Total Ownership."]
        }
    ]
};

export function renderProfileSidebar(u: any) {
    if (!u || typeof document === 'undefined') return;

    const ranks = REWARD_DATA.ranks;
    const cleanName = (name: string) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const currentRaw = u.rank || u.hierarchy || "Hall Boy";

    let currentIdx = ranks.findIndex(r => cleanName(r.name) === cleanName(currentRaw));
    if (currentIdx === -1) currentIdx = 0;

    const currentRankObj = ranks[currentIdx];
    const isMax = currentIdx >= ranks.length - 1;
    const nextRankObj = isMax ? currentRankObj : ranks[currentIdx + 1];

    // Update Text Headers
    const elCurRank = document.getElementById('desk_CurrentRank');
    if (elCurRank) elCurRank.innerText = currentRankObj.name;

    const elWorkingOnRank = document.getElementById('desk_WorkingOnRank');
    if (elWorkingOnRank) elWorkingOnRank.innerText = isMax ? "MAXIMUM RANK" : nextRankObj.name;

    // Update Dashboard Classification card
    const elDashRank = document.getElementById('desk_DashboardRank');
    if (elDashRank) elDashRank.innerText = currentRankObj.name;

    // Update Name
    const elSubName = document.getElementById('subName');
    if (elSubName) elSubName.innerText = u.name || 'SLAVE';

    // Update Profile Photos (syncs after initial render)
    const photoSrc = u.avatar_url || u.profile_picture_url || '';
    if (photoSrc) {
        const elProfilePic = document.getElementById('profilePic') as HTMLImageElement;
        if (elProfilePic) elProfilePic.src = photoSrc;

        const elMobUserPic = document.getElementById('hudUserPic') as HTMLImageElement;
        if (elMobUserPic) elMobUserPic.src = photoSrc;
    }

    const elNextBen = document.getElementById('desk_NextBenefits');


    // Update Email (New)
    const elCurEmail = document.getElementById('subEmail');
    if (elCurEmail) elCurEmail.innerText = u.member_id || "";

    const elMobEmail = document.getElementById('mob_slaveEmail');
    if (elMobEmail) elMobEmail.innerText = u.member_id || "";

    const elMobSlavePic = document.getElementById('hudSlavePic') as HTMLImageElement;
    if (elNextBen) {
        if (isMax) {
            elNextBen.innerHTML = "<li>You have reached the apex of servitude.</li>";
        } else {
            elNextBen.innerHTML = nextRankObj.benefits.map(b => `<li>${b}</li>`).join('');
        }
    }

    const elCurBen = document.getElementById('desk_CurrentBenefits');
    if (elCurBen) {
        elCurBen.innerText = currentRankObj.benefits[0] || "";
    }

    // Build Progress Bars
    const req = nextRankObj.req;
    const container = document.getElementById('desk_ProgressContainer');

    if (container) {
        const stats = {
            tasks: u.parameters?.taskdom_completed_tasks || 0,
            kneels: u.parameters?.kneel_count || 0,
            score: u.score || 0,
            spent: u.parameters?.total_coins_spent || 0,
            streak: u.parameters?.routine_streak || 0
        };

        const buildBar = (label: string, current: number, target: number, icon: string) => {
            if (isMax) target = current;
            if (target <= 0) target = 1;

            const pct = Math.min((current / target) * 100, 100);
            const isDone = current >= target;
            const color = isDone ? "#00ff00" : "#c5a059";
            const labelColor = isDone ? "#fff" : "rgba(255,255,255,0.4)";
            const valColor = isDone ? "#00ff00" : "#fff";

            return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:0.6rem; font-family:'Orbitron'; margin-bottom:4px; color:${labelColor}; letter-spacing:1px;">
                    <span>${icon} ${label}</span>
                    <span style="color:${valColor}">${current.toLocaleString()} / ${target.toLocaleString()}</span>
                </div>
                <div style="width:100%; height:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; position:relative;">
                    <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 10px ${color}40; transition: width 0.5s ease;"></div>
                </div>
            </div>`;
        };

        let html = '';
        html += buildBar("LABOR", stats.tasks, req.tasks, "🛠️");
        html += buildBar("ENDURANCE", stats.kneels, req.kneels, "🧎");
        html += buildBar("MERIT", stats.score, req.score, "✨");
        if (req.spent > 0) html += buildBar("SACRIFICE", stats.spent, req.spent, "💰");

        container.innerHTML = html;

        // Update simple stats
        const elPoints = document.getElementById('points');
        if (elPoints) elPoints.innerText = stats.score.toString();
        const elCoins = document.getElementById('coins');
        if (elCoins) elCoins.innerText = (u.wallet || 0).toString();
    }
}
