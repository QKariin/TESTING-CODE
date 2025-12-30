// js/reward.js - THE REVEAL ENGINE
import { activeRevealMap, currentLibraryMedia, libraryProgressIndex } from './state.js';
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

    gridContainer.innerHTML = mediaHtml + gridHtml;
    
    const label = document.getElementById('revealLevelLabel');
    if (label) label.innerText = `LEVEL ${libraryProgressIndex} CONTENT`;
}

export function toggleRewardGrid() {
    const section = document.getElementById('revealSection');
    const btn = document.getElementById('toggleGridBtn');
    if (!section || !btn) return;

    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.style.opacity = '1';
        btn.style.filter = 'drop-shadow(0 0 5px var(--neon-blue))';
    } else {
        section.style.display = 'none';
        btn.style.opacity = '0.6';
        btn.style.filter = 'none';
    }
}

// Global binding
window.toggleRewardGrid = toggleRewardGrid;

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
export function runTargetingAnimation(winnerId, finalCallback) {
    const frostedSquares = Array.from(document.querySelectorAll('.reveal-square.frosted'));
    if (frostedSquares.length === 0) return finalCallback();

    let currentIndex = 0;
    let jumps = 0;
    const maxJumps = 15; // How many times the light jumps before stopping

    const interval = setInterval(() => {
        // 1. Remove targeting from everyone
        frostedSquares.forEach(sq => sq.classList.remove('is-expanded', 'is-targeting'));

        // 2. Pick a random square for the "Scanning" look
        const randomSq = frostedSquares[Math.floor(Math.random() * frostedSquares.length)];
        randomSq.classList.add('is-targeting');

        jumps++;

        // 3. Check if we are at the end
        if (jumps >= maxJumps) {
            clearInterval(interval);
            
            // 4. Lock onto the REAL winner
            const actualWinner = document.getElementById(`sq-${winnerId}`);
            if (actualWinner) {
                frostedSquares.forEach(sq => sq.classList.remove('is-targeting'));
                actualWinner.classList.add('locked-item'); // Trigger the 3x flash
                
                // Wait for the flashes to finish, then reveal
                setTimeout(() => {
                    finalCallback();
                }, 1500);
            } else {
                finalCallback();
            }
        }
    }, 100); // Jump speed (100ms)
}

// Bind to window
window.runTargetingAnimation = runTargetingAnimation;

// Global Bindings
window.handleRevealFragment = handleRevealFragment;
window.initSlider = initSlider;
