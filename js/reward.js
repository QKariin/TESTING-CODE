// js/reward.js - THE REVEAL ENGINE
import { activeRevealMap, currentLibraryMedia, libraryProgressIndex, gameStats, vaultItems } from './state.js';
import { getOptimizedUrl, triggerSound } from './utils.js';

// --- 1. THE GRID RENDERER (Draws the 3x3 frosted glass) ---
// js/reward.js - THE REVEAL ENGINE (REACTIVE VERSION)

export function renderRewardGrid() {
    const gridContainer = document.getElementById('revealGridContainer');
    const section = document.getElementById('revealSection');

    // If no media is loaded yet, keep the section hidden
    if (!gridContainer || !currentLibraryMedia) {
        if (section) section.style.display = 'none';
        return;
    }

    // A. Detect Media Type
    const isVideo = currentLibraryMedia.match(/\.(mp4|mov|webm)/i);
    const mediaHtml = isVideo 
        ? `<video src="${currentLibraryMedia}" autoplay loop muted playsinline class="reveal-bg-media"></video>`
        : `<img src="${getOptimizedUrl(currentLibraryMedia, 800)}" class="reveal-bg-media">`;

    // B. Build Grid
    // (Inside renderRewardGrid loop)
    let gridHtml = '<div class="reveal-grid-overlay">';
    for (let i = 1; i <= 9; i++) {
        const isUnblurred = activeRevealMap.includes(i);
        
        // If it's the last unblurred square added to the list, we give it a special ID
        const isNewest = (activeRevealMap[activeRevealMap.length - 1] === i);
        
        gridHtml += `
            <div class="reveal-square ${isUnblurred ? 'clear' : 'frosted'}" 
                 style="${isNewest ? 'z-index: 10;' : ''}"
                 id="sq-${i}">
                ${!isUnblurred ? `<span class="sq-num">${(i).toString().padStart(2, '0')}</span>` : ''}
            </div>`;
    }
    gridHtml += '</div>';

    // 1. Manually clear only the old image/grid
        const oldElements = gridContainer.querySelectorAll('.reveal-bg-media, .reveal-grid-overlay');
        oldElements.forEach(el => el.remove());
        
        // 2. Add the new image/grid WITHOUT deleting the buttons
        gridContainer.insertAdjacentHTML('afterbegin', mediaHtml + gridHtml);
    
    const label = document.getElementById('revealLevelLabel');
    if (label) label.innerText = `LEVEL ${libraryProgressIndex} CONTENT`;
}

// --- STEP 2: PURCHASE LOGIC ---
export function buyRewardFragment(cost) {
    // 1. Check if the slave can afford it
    if (gameStats.coins < cost) {
        triggerSound('sfx-deny');
        alert("SYSTEM ERROR: INSUFFICIENT COINS (" + cost + " required).");
        return;
    }

    // 2. Tell Wix to subtract the coins and pick the squares
    // cost will be 100 or 500
    window.parent.postMessage({ 
        type: "PURCHASE_REVEAL", 
        cost: cost 
    }, "*");

    // 3. Close the choice menu so they see the animation/result
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');
    
    // 4. Force the grid view to open
    const section = document.getElementById('revealSection');
    if (section) section.style.display = 'flex';

    triggerSound('coinSound');
}

export function toggleRewardGrid() {
    console.log("EXECUTION: toggleRewardGrid fired"); // <--- LOG 1
    const section = document.getElementById('revealSection');
    const btn = document.getElementById('toggleGridBtn');
    if (!section || !btn) {
        console.log("ERROR: revealSection or toggleGridBtn missing in DOM");
        return;
    }

    if (section.style.display === 'none' || section.style.display === '') {
        section.style.display = 'flex'; 
        btn.style.opacity = '1';
    } else {
        section.style.display = 'none';
        btn.style.opacity = '0.6';
        toggleRewardSubMenu(false);
    }
}

export function toggleRewardSubMenu(show) {
    console.log("EXECUTION: toggleRewardSubMenu fired with:", show); // <--- LOG 2
    const mainMenu = document.getElementById('reward-main-menu');
    const buyMenu = document.getElementById('reward-buy-menu');
    
    if (!mainMenu || !buyMenu) {
        console.log("ERROR: Menu containers missing");
        return;
    }

    if (show) {
        mainMenu.style.display = 'none';
        buyMenu.style.display = 'flex';
        buyMenu.classList.remove('hidden');
    } else {
        mainMenu.style.display = 'flex';
        buyMenu.style.display = 'none';
    }
}

export function buyRewardFragment(cost) {
    console.log("EXECUTION: buyRewardFragment fired for cost:", cost); // <--- LOG 3
    if (gameStats.coins < cost) {
        triggerSound('sfx-deny');
        alert("INSUFFICIENT COINS.");
        return;
    }
    window.parent.postMessage({ type: "PURCHASE_REVEAL", cost: cost }, "*");
    triggerSound('coinSound');
}


// --- 2. THE REVEAL FRAGMENT BUTTON (The 3rd Option) ---
export function handleRevealFragment() {
    // 1. Force the grid to open so they see the result
    const section = document.getElementById('revealSection');
    if (section) section.style.display = 'block';
    
    // 2. Tell Wix to pick a square
    window.parent.postMessage({ type: "REVEAL_FRAGMENT" }, "*");
    
    // 3. Close the choice menu
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');
    
    triggerSound('coinSound');
}

// --- 3. THE IPHONE SLIDER ENGINE (For Points/Coins) ---
let isDragging = false;
let currentSlider = null;
let startX = 0;

export function initSlider(e, choice) {
    if (isDragging) return;
    isDragging = true;
    currentSlider = e.currentTarget;
    
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    
    const moveHandler = (moveEvent) => {
        const clientX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const knob = currentSlider.querySelector('.slider-knob');
        const fill = currentSlider.querySelector('.slider-fill');
        const text = currentSlider.querySelector('.slider-track-text');
        
        const trackWidth = currentSlider.offsetWidth - knob.offsetWidth - 10;
        let moveX = clientX - startX;
        moveX = Math.max(0, Math.min(moveX, trackWidth));
        const percent = (moveX / trackWidth) * 100;

        knob.style.transform = `translateX(${moveX}px)`;
        fill.style.width = `${percent}%`;
        if (text) text.style.opacity = 1 - (percent / 100);

        // TRIGGER REWARD: If they slide 98% of the way
        if (percent >= 98) {
            isDragging = false;
            stopHandlers();
            
            // This calls your separate reward function in kneeling.js
            import('./kneeling.js').then(({ claimKneelReward }) => {
                claimKneelReward(choice);
            });
        }
    };

    const stopHandlers = () => {
        if (!isDragging) return;
        isDragging = false;
        
        // Snap back if they let go early
        const knob = currentSlider.querySelector('.slider-knob');
        const fill = currentSlider.querySelector('.slider-fill');
        const text = currentSlider.querySelector('.slider-track-text');
        
        knob.style.transition = "transform 0.3s ease";
        fill.style.transition = "width 0.3s ease";
        knob.style.transform = "translateX(0)";
        fill.style.width = "0%";
        if (text) text.style.opacity = "1";
        
        setTimeout(() => {
            knob.style.transition = "none";
            fill.style.transition = "none";
        }, 300);

        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('mouseup', stopHandlers);
        document.removeEventListener('touchend', stopHandlers);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('mouseup', stopHandlers);
    document.addEventListener('touchend', stopHandlers);
}

// --- STEP 2: THE DIGITAL ROULETTE ENGINE ---
// --- STEP 2: THE DIGITAL ROULETTE ENGINE ---
export function runTargetingAnimation(winnerId, finalCallback) {
    // 1. Find only the squares that are still blurry (frosted)
    const availableSquares = Array.from(document.querySelectorAll('.reveal-square.frosted'));
    
    if (availableSquares.length === 0) {
        return finalCallback(); // No squares left? Just show the photo.
    }

    let jumps = 0;
    const maxJumps = 18; // How many times the light jumps

    const interval = setInterval(() => {
        // Remove the blue glow from everyone
        availableSquares.forEach(sq => sq.classList.remove('is-targeting'));

        // Pick a random square from the hidden ones to light up
        const randomIndex = Math.floor(Math.random() * availableSquares.length);
        availableSquares[randomIndex].classList.add('is-targeting');

        jumps++;

        // 2. CHECK IF WE ARE AT THE END
        if (jumps >= maxJumps) {
            clearInterval(interval);
            allSquares.forEach(sq => sq.classList.remove('is-targeting'));

            // 1. FIND THE WINNER
            const actualWinner = document.getElementById(`sq-${winnerId}`);
            if (actualWinner) {
                // 2. TRIGGER LOCK-IN FLASHES
                actualWinner.classList.add('locked-item');
                
                // 3. THE LOCAL AUTHORITY FIX:
                // We manually clear the square RIGHT NOW so we don't wait for Wix
                actualWinner.classList.remove('frosted');
                actualWinner.classList.add('clear');

                // 4. SHORTER TIMEOUT: Only wait 600ms for the flash to finish
                setTimeout(() => {
                    finalCallback(); // This syncs the data in the background
                }, 100); 
            } else {
                finalCallback();
            }
        }
    }, 50); // Speed: 80ms is a fast "Digital" jump
}

export function renderVault() {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    if (!vaultItems || vaultItems.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#444; font-family:'Rajdhani'; font-size:0.7rem; letter-spacing:2px;">YOUR VAULT IS CURRENTLY EMPTY.</div>`;
        return;
    }

    // Draw each unlocked reward as a high-class card
    grid.innerHTML = vaultItems.map((item, index) => {
        // Detect if the item is an old string URL or the new high-detail object
        const url = typeof item === 'string' ? item : item.mediaUrl;
        const dayNum = typeof item === 'object' ? item.day : (index + 1);
        const isVideo = url.match(/\.(mp4|mov|webm)/i);

        return `
            <div class="gallery-item" onclick="window.openVaultMedia('${url}', ${isVideo ? 'true' : 'false'})">
                <img src="${getOptimizedUrl(url, 400)}" class="gi-thumb" style="opacity: 1 !important; filter: none !important;">
                <div class="gi-badge" style="color:var(--neon-yellow); border-color:var(--neon-yellow);">LEVEL ${dayNum}</div>
                ${item.unlockedAt ? `<div style="position:absolute; bottom:5px; right:5px; font-size:0.4rem; color:#666; font-family:'Share Tech Mono';">SECURED: ${new Date(item.unlockedAt).toLocaleDateString()}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Helper to open the big glass modal for vault items
window.openVaultMedia = function(url, isVideo) {
    import('./gallery.js').then(({ openModal }) => {
        // We reuse your perfect history modal for the vault
        openModal(url, "UNLOCKED", "High-Class Reward", isVideo);
    });
};
// --- STEP 2: TIERED MENU TOGGLE ---
export function toggleRewardSubMenu(show) {
    const mainMenu = document.getElementById('reward-main-menu');
    const buyMenu = document.getElementById('reward-buy-menu');
    
    if (!mainMenu || !buyMenu) return;

    if (show) {
        // HIDE MAIN
        mainMenu.style.setProperty('display', 'none', 'important');
        mainMenu.classList.add('hidden');

        // SHOW BUY
        buyMenu.classList.remove('hidden');
        buyMenu.style.setProperty('display', 'flex', 'important');
    } else {
        // SHOW MAIN
        mainMenu.classList.remove('hidden');
        mainMenu.style.setProperty('display', 'flex', 'important');

        // HIDE BUY
        buyMenu.style.setProperty('display', 'none', 'important');
        buyMenu.classList.add('hidden');
    }
}

// Global binding
window.toggleRewardGrid = toggleRewardGrid;
// Bind it to window
window.toggleRewardSubMenu = toggleRewardSubMenu;
// Bind to window
window.renderVault = renderVault;
// Global binding
window.buyRewardFragment = buyRewardFragment;
// Bind to window
window.runTargetingAnimation = runTargetingAnimation;

// Global Bindings
window.handleRevealFragment = handleRevealFragment;
window.initSlider = initSlider;
