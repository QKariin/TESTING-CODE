// js/mobile-ui.js - THE MOBILE BRAIN

import { gameStats, userProfile, currentTask } from './state.js';
// We import the physics engine from your existing kneeling folder
import { handleHoldStart, handleHoldEnd } from '../profile/kneeling/kneeling.js';

// ==========================================
// 1. NAVIGATION SYSTEM (Footer Icons)
// ==========================================
window.navMobile = function(view) {
    // A. Update Footer Visuals
    document.querySelectorAll('.mf-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.mf-btn[onclick="navMobile('${view}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    // B. Hide All Sections first
    const sections = ['#viewMobileHome', '#historySection', '#viewNews', '#chatCard', '#viewVault', '#viewProtocol'];
    sections.forEach(id => {
        const el = document.querySelector(id);
        if(el) el.style.display = 'none';
    });

    // C. Show Target Section
    if(view === 'home') {
        document.querySelector('#viewMobileHome').style.display = 'flex';
        renderMobileDashboard(); // Refresh data when entering home
    }
    else if(view === 'record') {
        document.querySelector('#historySection').style.display = 'flex';
        if(window.renderGallery) window.renderGallery(); // Ensure gallery is drawn
    }
    else if(view === 'queen') {
        document.querySelector('#viewNews').style.display = 'block';
    }
    else if(view === 'logs') {
        const chat = document.querySelector('#chatCard');
        if(chat) {
            chat.style.display = 'flex';
            // Scroll to bottom fix
            const box = document.getElementById('chatBox');
            if(box) setTimeout(() => box.scrollTop = box.scrollHeight, 100);
        }
    }
};

// ==========================================
// 2. DASHBOARD RENDERER (The Data Sync)
// ==========================================
export function renderMobileDashboard() {
    if(!userProfile || !gameStats) return;

    // --- A. IDENTITY HEADER ---
    const elName = document.getElementById('mob_slaveName');
    const elRank = document.getElementById('mob_rankStamp');
    const elPic = document.getElementById('mob_profilePic');

    if(elName) elName.innerText = userProfile.name || "SLAVE";
    if(elRank) elRank.innerText = userProfile.hierarchy || "INITIATE";
    if(elPic && userProfile.profilePicture) elPic.src = userProfile.profilePicture;

    // --- B. DEVOTION GRID (24 Squares) ---
    const grid = document.getElementById('mob_streakGrid');
    if(grid) {
        grid.innerHTML = ''; // Clear old squares
        
        // Calculate Streak (How many kneels in current cycle)
        const totalKneels = gameStats.kneelCount || 0;
        const cycleProgress = totalKneels % 24; 
        
        // Create 24 Squares
        for(let i=0; i<24; i++) {
            const sq = document.createElement('div');
            // If i is less than progress, light it up
            sq.className = 'streak-sq' + (i < cycleProgress ? ' active' : '');
            grid.appendChild(sq);
        }
    }

    // --- C. OPERATIONS (Status & Timer) ---
    updateMobileOperations();
}

function updateMobileOperations() {
    const light = document.getElementById('mob_statusLight');
    const text = document.getElementById('mob_statusText');
    const btn = document.getElementById('mob_btnRequest');
    const timer = document.getElementById('mob_activeTimer');

    if(currentTask) {
        // WORKING STATE
        if(light) light.className = 'status-light green';
        if(text) text.innerText = "WORKING";
        if(btn) btn.classList.add('hidden');
        if(timer) timer.classList.remove('hidden');
    } else {
        // IDLE STATE
        if(light) light.className = 'status-light red';
        if(text) text.innerText = "UNPRODUCTIVE";
        if(btn) btn.classList.remove('hidden');
        if(timer) timer.classList.add('hidden');
    }
}

// ==========================================
// 3. PHYSICS BINDING (The Kneel Button)
// ==========================================
// We attach the existing desktop physics logic to the mobile button
document.addEventListener('DOMContentLoaded', () => {
    const zone = document.querySelector('.mob-kneel-zone');
    if(zone) {
        zone.addEventListener('mousedown', handleHoldStart);
        zone.addEventListener('touchstart', handleHoldStart, {passive: false});
        zone.addEventListener('mouseup', handleHoldEnd);
        zone.addEventListener('touchend', handleHoldEnd);
        zone.addEventListener('mouseleave', handleHoldEnd);
    }
    
    // Initial Render
    renderMobileDashboard();
});

// Force global export for HTML onclicks
window.renderMobileDashboard = renderMobileDashboard;
