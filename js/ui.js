// UI management functions - FULL LOGIC WITH WISHLIST & VAULT SYNC & SLAVE RECORD FIX
import { currentView, cmsHierarchyData, setCurrentView, WISHLIST_ITEMS, gameStats } from './state.js';
import { CMS_HIERARCHY } from './config.js';
import { renderGallery, loadMoreHistory } from './gallery.js'; // IMPORTED loadMoreHistory
import { getOptimizedUrl } from './media.js';
import { renderVault } from '../profile/kneeling/reward.js';

export function switchTab(mode) {
    // 1. Update the buttons
    const allBtns = document.querySelectorAll('.tab-btn, .nav-btn'); // Added .nav-btn support for new layout
    allBtns.forEach(b => b.classList.remove('active'));
    
    // 2. Update the "State" correctly
    setCurrentView(mode);
    
    allBtns.forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || "";
        if (onclickAttr.includes(`'${mode}'`)) {
            btn.classList.add('active');
        }
    });

    // 3. Mobile Navigation Logic
    if (window.innerWidth < 768) {
        allBtns.forEach(btn => {
            const cmd = btn.getAttribute('onclick') || "";
            if (mode === 'serve') {
                btn.classList.remove('nav-hidden');
            } else {
                btn.classList.add('nav-hidden');
                if (cmd.includes('serve') || cmd.includes(mode)) {
                    btn.classList.remove('nav-hidden');
                }
            }
        });
    }
    
    // 4. Hide all views - Including historySection
    const allViews = [
        'viewServingTop', 'viewNews', 'viewSession', 
        'viewVault', 'viewProtocol', 'viewBuy', 
        'viewTribute', 'viewHierarchy', 'viewRewards', 'historySection'
    ];
    
    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none'; // Force hide to be safe
        }
    });

    // 5. THE CLEAN VIEW MAP (Added 'history')
    const viewMap = {
        'serve': 'viewServingTop',
        'news': 'viewNews',
        'session': 'viewSession',
        'rewards': 'viewVault',    
        'protocol': 'viewProtocol',
        'buy': 'viewBuy',
        'history': 'historySection', // NEW MAPPING
        'vault': 'viewVault' // Added vault explicitly just in case
    };

    const targetId = viewMap[mode];
    if (targetId) {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.classList.remove('hidden');
            
            // New Layout Logic: Grids need Flex, Main Layout needs Block (or Flex Column)
            if (['viewNews', 'viewVault', 'historySection', 'viewServingTop'].includes(targetId)) {
                targetEl.style.display = 'flex';
                targetEl.style.flexDirection = 'column';
            } else {
                targetEl.style.display = 'block';
            }
        }
    }
       
    // 6. TRIGGER RENDERS & MESSAGES
    if (mode === 'news') {
        window.parent.postMessage({ type: "LOAD_Q_FEED" }, "*");
    }
    
    if (mode === 'rewards' || mode === 'vault') {
        renderVault(); 
    }

    if (mode === 'serve') {
        //renderGallery(); 
    }

    // THE MISSING LINK: Load History Data
    if (mode === 'history') {
        loadMoreHistory();
    }
}

// --- THE WISHLIST RENDERER ---
export function renderWishlist(maxBudget = 999999) {
    const grid = document.getElementById('storeGrid');
    if (!grid) return;

    // Filter by the budget chosen in Step 3
    const items = WISHLIST_ITEMS.filter(i => i.price <= maxBudget);

    if (items.length === 0) {
        grid.innerHTML = `<div style="grid-column: span 2; text-align:center; padding:40px; color:#666; font-family:'Rajdhani';">NOTHING FOUND IN THIS BUDGET.</div>`;
        return;
    }

    grid.innerHTML = items.map(item => {
        const canAfford = gameStats.coins >= item.price;
        const displayImg = getOptimizedUrl(item.img, 400);

        return `
            <div class="store-item ${canAfford ? 'can-afford' : 'locked'}">
                <div class="si-img-box">
                    <img src="${displayImg}" class="si-img">
                    <div class="si-price">${item.price} 🪙</div>
                </div>
                <div class="si-info">
                    <div class="si-name">${item.name}</div>
                    <button class="si-btn" onclick="window.buyItem('${item.id}')">
                        TRIBUTE
                    </button>
                </div>
            </div>`;
    }).join('');
}

export function toggleStats() {
    const el = document.getElementById('statsContent');
    if (el) el.classList.toggle('open');
}

export function toggleSection(element) {
    const allItems = document.querySelectorAll('.protocol-item');
    const isActive = element.classList.contains('active');
    
    if (!isActive) {
        allItems.forEach(item => {
            if (item === element) {
                item.classList.add('active');
                item.style.display = 'block';
                const itemArrow = item.querySelector('.protocol-arrow');
                if (itemArrow) itemArrow.innerText = '▲';
            } else {
                item.style.display = 'none';
            }
        });
    } else {
        allItems.forEach(item => {
            item.classList.remove('active');
            item.style.display = 'block';
            const itemArrow = item.querySelector('.protocol-arrow');
            if (itemArrow) itemArrow.innerText = '▼';
        });
    }
}

// --- FLEXIBLE RENDERING FOR QKARIN FEED ---

export function renderDomVideos(videos) {
    const reel = document.getElementById('domVideoReel');
    if (!reel || !videos) return;
    
    reel.innerHTML = videos.slice(0, 10).map(v => {
        const src = v.page || v.url || v.media || v.image;
        if (!src) return "";
        
        const optimized = getOptimizedUrl(src, 100);
        return `
            <div class="hl-item">
                <div class="hl-circle">
                    <img src="${optimized}" class="hl-img" onerror="this.src='https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png'">
                </div>
            </div>`;
    }).join('');
}

export function renderNews(posts) {
    const grid = document.getElementById('newsGrid');
    if (!grid || !posts) return;

    grid.innerHTML = posts.map(p => {
        const mediaSource = p.page || p.url || p.media || p.image;
        if (!mediaSource) return "";

        const isVideo = typeof mediaSource === 'string' && 
                        (mediaSource.toLowerCase().includes('.mp4') || 
                         mediaSource.toLowerCase().includes('.mov'));
        
        const optimized = isVideo ? mediaSource : getOptimizedUrl(mediaSource, 400);

        if (isVideo) {
            return `
                <div class="sg-item">
                    <video src="${optimized}" class="sg-img" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
                    <div class="sg-icon">▶</div>
                </div>`;
        } else {
            return `
                <div class="sg-item" onclick="window.openChatPreview('${encodeURIComponent(mediaSource)}', false)">
                    <img src="${optimized}" class="sg-img" loading="lazy" onerror="this.src='https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png'">
                </div>`;
        }
    }).join('');
}

// --- SESSION UI ---

export function openSessionUI() {
    const overlay = document.getElementById('sessionOverlay');
    if(overlay) overlay.classList.add('active');
    const costDisp = document.getElementById('sessionCostDisplay');
    if(costDisp) costDisp.innerText = "3000";
}

export function closeSessionUI() {
    const overlay = document.getElementById('sessionOverlay');
    if(overlay) overlay.classList.remove('active');
}

export function updateSessionCost() {
    const checked = document.querySelector('input[name="sessionType"]:checked');
    if (checked) {
        const cost = checked.getAttribute('data-cost');
        const costDisp = document.getElementById('sessionCostDisplay');
        if(costDisp) costDisp.innerText = cost;
    }
}
