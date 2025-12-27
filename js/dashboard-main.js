// --- 1. CORE STATE IMPORTS ---
import { 
    users, globalQueue, globalTributes, availableDailyTasks, queenContent, 
    stickerConfig, broadcastPresets, timerInterval, currId,
    setUsers, setGlobalQueue, setGlobalTributes, setAvailableDailyTasks, 
    setQueenContent, setStickerConfig, setBroadcastPresets, setTimerInterval
} from './dashboard-state.js';

// --- 2. MODULE IMPORTS ---
import { renderSidebar } from './dashboard-sidebar.js';
import { renderOperationsMonitor } from './dashboard-operations.js';
import { renderChat } from './dashboard-chat.js';
import { updateDetail } from './dashboard-users.js';
import { toggleMobStats } from './dashboard-utils.js';

// --- 3. SYSTEM & BRIDGE IMPORTS ---
import { Bridge } from './bridge.js';
import './dashboard-modals.js'; // This wakes up the Command Armory
import './dashboard-navigation.js';


// Initialize dashboard
// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. AUDIO WAKE-UP (Priming the engine so notifications work) ---
    document.addEventListener('click', () => {
        const sfx = document.getElementById('sfx-notify');
        if (sfx) {
            // Play and immediately pause to "unlock" audio for the session
            sfx.play().then(() => {
                sfx.pause();
                sfx.currentTime = 0;
                console.log("Audio Engine Primed");
            }).catch(e => console.log("Audio wait..."));
        }
    }, { once: true });

    // --- 2. DAILY ID (Synced Shadow Math) ---
    const today = new Date();
    const m = today.getMonth() + 1; 
    const d = today.getDate();
    const dayCode = ((110 - m) * 100 + (82 - d)).toString().padStart(4, '0');
    
    const codeEl = document.getElementById('adminDailyCode');
    if (codeEl) codeEl.innerText = dayCode;
    
    // --- 3. START SYSTEMS ---
    startTimerLoop();
    renderMainDashboard();
    
    console.log('Dashboard initialized with Daily ID:', dayCode);
});

// This tells the dashboard to listen to the "Radio Channel" (Vercel) 
// exactly like it listens to Wix.
Bridge.listen((data) => {
    window.postMessage(data, "*"); 
});

// Main message listener for communication with Wix backend
window.addEventListener("message", async (event) => {
    const data = event.data;
    
    if (data.type === "updateDashboard") {
        setUsers(data.users || []);
        setGlobalQueue(data.globalQueue || []);
        setGlobalTributes(data.globalTributes || []);
        setAvailableDailyTasks(data.dailyTasks || []);
        setQueenContent(data.queenCMS || []);
        
        // --- THE STICKER MAPPING (10, 20, 30, 40, 50, 100) ---
        // We hunt for the specific row in your CMS that contains the sticker links
        const stickerSource = data.queenCMS?.find(item => item["10"] || item["100"]);
        if (stickerSource) {
            const vals = [10, 20, 30, 40, 50, 100];
            const newConfig = vals.map(v => ({
                id: `s${v}`,
                name: `${v} PTS`,
                val: v,
                url: stickerSource[v.toString()] || "" // Grabs link from column "10", "20", etc.
            }));
            setStickerConfig(newConfig);
        }

        renderMainDashboard();
        
        // Update current user if viewing one
        if (currId) {
            const u = users.find(x => x.memberId === currId);
            if (u) updateDetail(u);
        }
    }
    
    else if (data.type === "updateChat") {
        // 1. Draw the messages in the chat box
        renderChat(data.messages || []);
        
        const u = users.find(x => x.memberId === data.memberId);
        
        // 2. Only proceed if the user exists and there are messages
        if (u && data.messages && data.messages.length > 0) {
            const lastMsg = data.messages[data.messages.length - 1];
            const realMsgTime = new Date(lastMsg._createdDate).getTime();

            // --- THE SOUND TRIGGER ---
            // Trigger sound ONLY if:
            // 1. realMsgTime is NEWER than the last message we recorded for this user
            // 2. The sender is NOT the admin
            // 3. We are NOT currently looking at this slave (don't beep while reading)
            if (realMsgTime > (u.lastMessageTime || 0) && 
                lastMsg.sender !== 'admin' && 
                data.memberId !== currId) {
                
                const sfx = document.getElementById('sfx-notify');
                if (sfx) {
                    sfx.currentTime = 0;
                    sfx.play().catch(e => console.log("Audio waiting for first click..."));
                }
            }
            
            // 3. Update the state with the real time
            u.lastMessageTime = realMsgTime;

            // 4. THE HANDSHAKE: If I am currently looking at this guy, mark as "Read" instantly
            if (data.memberId === currId) {
                localStorage.setItem('read_' + data.memberId, Date.now().toString());
            }

            // 5. Only redraw sidebar (for icons/jumps) if it's NOT the person on screen
            if (u.memberId !== currId) {
                renderSidebar(); 
            }
        }
    }
    
    else if (data.type === "stickerConfig") {
        // Handle manual config updates if sent separately
        setStickerConfig(data.stickers || []);
    }
    
    else if (data.type === "broadcastPresets") {
        setBroadcastPresets(data.presets || []);
    }
    
    else if (data.type === "protocolUpdate") {
        import('./dashboard-protocol.js').then(({ updateProtocolProgress }) => {
            updateProtocolProgress();
        });
    }

    // --- THE INSTANT ECHO HANDLERS (Kills the 4s lag) ---
    else if (data.type === "instantUpdate") {
        const u = users.find(x => x.memberId === data.memberId);
        if (u) {
            u.points = data.newPoints; // Instant points update
            updateDetail(u);
        }
    }

    else if (data.type === "instantReviewSuccess") {
        const u = users.find(x => x.memberId === data.memberId);
        if (u && u.reviewQueue) {
            // Remove the approved/rejected task from the list immediately
            u.reviewQueue = u.reviewQueue.filter(t => t.id !== data.taskId);
            renderMainDashboard();
            if (currId === data.memberId) updateDetail(u);
        }
    }
});

export function renderMainDashboard() {
    renderSidebar();
    renderDashboardStats();
    renderOperationsMonitor();
}

function renderDashboardStats() {
    // Calculate stats from users data
    const totalTributes = globalTributes.length;
    const activeTasks = users.filter(u => u.activeTask && u.endTime && u.endTime > Date.now()).length;
    const pendingReviews = globalQueue.length;
    const failedTasks = users.reduce((sum, u) => sum + (u.history?.filter(h => h.status === 'fail').length || 0), 0);
    
    // Update stat cards
    const statElements = {
        'statTributes': totalTributes,
        'statActive': activeTasks,
        'statPending': pendingReviews,
        'statSkipped': failedTasks
    };
    
    Object.entries(statElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    });
}

function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    
    const interval = setInterval(() => {
        document.querySelectorAll('.ac-timer').forEach(el => {
            const end = parseInt(el.getAttribute('data-end'));
            if (end) {
                const diff = end - Date.now();
                if (diff <= 0) {
                    el.innerText = "00:00";
                } else {
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    el.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        });
    }, 1000);
    
    setTimerInterval(interval);
}

// Admin task actions
export function adminTaskAction(memberId, action) {
    window.parent.postMessage({ 
        type: "adminTaskAction",
        memberId: memberId,
        action: action
    }, "*");
}

// Make functions available globally
window.renderMainDashboard = renderMainDashboard;
window.adminTaskAction = adminTaskAction;
window.toggleMobStats = toggleMobStats;

// Send ready signal to parent
if (window.parent) {
    window.parent.postMessage({ type: "DASHBOARD_READY" }, "*");
}

console.log('Dashboard main controller loaded');
