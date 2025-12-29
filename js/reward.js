// js/reward.js - THE REVEAL ENGINE
import { activeRevealMap, currentLibraryMedia, libraryProgressIndex } from './state.js';
import { getOptimizedUrl, triggerSound } from './utils.js';

export function renderRewardGrid() {
    const gridContainer = document.getElementById('revealGridContainer');
    if (!gridContainer || !currentLibraryMedia) return;

    // 1. SET THE TARGET MEDIA
    const isVideo = currentLibraryMedia.match(/\.(mp4|mov|webm)/i);
    const mediaHtml = isVideo 
        ? `<video src="${currentLibraryMedia}" autoplay loop muted playsinline class="reveal-bg-media"></video>`
        : `<img src="${getOptimizedUrl(currentLibraryMedia, 800)}" class="reveal-bg-media">`;

    // 2. BUILD THE 3x3 FROSTED OVERLAY
    let gridHtml = '<div class="reveal-grid-overlay">';
    for (let i = 1; i <= 9; i++) {
        const isUnblurred = activeRevealMap.includes(i);
        gridHtml += `
            <div class="reveal-square ${isUnblurred ? 'clear' : 'frosted'}" id="sq-${i}">
                ${!isUnblurred ? `<span class="sq-num">${i}</span>` : ''}
            </div>`;
    }
    gridHtml += '</div>';

    gridContainer.innerHTML = mediaHtml + gridHtml;
    
    // Update label to show which Level/Day they are on
    const label = document.getElementById('revealLevelLabel');
    if (label) label.innerText = `LEVEL ${libraryProgressIndex} CONTENT`;
}

export function handleRevealFragment() {
    // 1. Tell Wix to pick a random square
    window.parent.postMessage({ type: "REVEAL_FRAGMENT" }, "*");
    
    // 2. Close the choice menu (so they see the grid)
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');
    
    // 3. Switch to the Serving tab so they see the grid unblurring
    if (window.switchTab) window.switchTab('serve');

    triggerSound('coinSound');
}

// Global binding
window.handleRevealFragment = handleRevealFragment;
