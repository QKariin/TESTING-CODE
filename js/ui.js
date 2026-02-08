// UI management functions - FULL LOGIC WITH WISHLIST & VAULT SYNC & SLAVE RECORD FIX
import { currentView, cmsHierarchyData, setCurrentView, WISHLIST_ITEMS, gameStats } from './state.js';
import { CMS_HIERARCHY } from './config.js';
import { renderGallery, loadMoreHistory } from './gallery.js'; 
import { getOptimizedUrl } from './media.js';
import { renderVault } from '../profile/kneeling/reward.js';

export function switchTab(mode) {
    // 1. Update the buttons
    const allBtns = document.querySelectorAll('.tab-btn, .nav-btn'); 
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
    
    // 4. Hide all views
    const allViews = [
        'viewServingTop', 'viewNews', 'viewSession', 
        'viewVault', 'viewProtocol', 'viewBuy', 
        'viewTribute', 'viewHierarchy', 'viewRewards', 'historySection'
    ];
    
    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.style.display = 'none'; 
        }
    });

    // 5. THE CLEAN VIEW MAP
    const viewMap = {
        'serve': 'viewServingTop',
        'news': 'viewNews',
        'session': 'viewSession',
        'rewards': 'viewVault',    
        'protocol': 'viewProtocol',
        'buy': 'viewBuy',
        'history': 'historySection', 
        'vault': 'viewVault'
    };

    const targetId = viewMap[mode];
    if (targetId) {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            targetEl.classList.remove('hidden');
            
            // New Layout Logic
            if (['viewNews', 'viewVault', 'historySection', 'viewServingTop'].includes(targetId)) {
                targetEl.style.display = 'flex';
                targetEl.style.flexDirection = 'column';
            } else {
                targetEl.style.display = 'block';
            }
        }
    }
       
    // 6. TRIGGER RENDERS
    if (mode === 'news') {
        window.parent.postMessage({ type: "LOAD_Q_FEED" }, "*");
    }
    
    if (mode === 'rewards' || mode === 'vault') {
        renderVault(); 
    }
}

// --- THE WISHLIST RENDERER (Updated to match main.js logic) ---
export function renderWishlist(maxBudget = 999999) {
    // Supports both Desktop 'storeGrid' and Mobile 'huntStoreGrid' if needed
    const grids = [document.getElementById('storeGrid'), document.getElementById('huntStoreGrid')];
    
    // Filter items
    const items = (WISHLIST_ITEMS || []).filter(i => i.price <= maxBudget);

    grids.forEach(grid => {
        if (!grid) return;

        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: span 2; text-align:center; padding:40px; color:#666; font-family:'Rajdhani';">NOTHING FOUND IN THIS BUDGET.</div>`;
            return;
        }

        grid.innerHTML = items.map(item => {
            const canAfford = gameStats.coins >= item.price;
            // Handle image URL safely
            const displayImg = item.img || item.image || "";
            const safeImg = getOptimizedUrl(displayImg, 400);

            // UPDATED: Calls 'quickBuyItem' which we defined in main.js
            return `
                <div class="store-item ${canAfford ? 'can-afford' : 'locked'}" style="cursor:pointer;" onclick="window.quickBuyItem({name:'${item.name}', price:${item.price}})">
                    <div class="si-img-box">
                        <img src="${safeImg}" class="si-img" onerror="this.style.display='none'">
                        <div class="si-price">${item.price} 🪙</div>
                    </div>
                    <div class="si-info">
                        <div class="si-name">${item.name}</div>
                        <button class="si-btn">
                            TRIBUTE
                        </button>
                    </div>
                </div>`;
        }).join('');
    });
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

// --- FLEXIBLE RENDERING FOR QKARIN FEED (UPDATED FOR MOBILE) ---

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

// *** QUEEN'S WALL RENDERER (DESKTOP GRID + MOBILE PYRAMID) ***
export function renderNews(posts) {
    // 1. DESKTOP TARGET
    const deskGrid = document.getElementById('newsGrid');
    
    // 2. MOBILE TARGETS (The Pyramid)
    const q1 = document.getElementById('qWall_Img1'); // Center
    const q2 = document.getElementById('qWall_Img2'); // Left
    const q3 = document.getElementById('qWall_Img3'); // Right
    const mobScroll = document.getElementById('qWall_ScrollTrack'); // Drawer

    if (!posts || !Array.isArray(posts)) return;

    // --- HELPER: CLEAN URLS ---
    const getSafeImg = (p) => {
        // Find the key
        const raw = p.image || p.img || p.thumbnail || p.cover || p.media || p.url || "";
        if (!raw) return "";
        
        // Fix Wix URLs
        if (raw.startsWith("wix:image")) {
            try { 
                const parts = raw.split('/');
                return "https://static.wixstatic.com/media/" + parts[3].split('#')[0]; 
            } catch(e) { return ""; }
        }
        // Fix Standard URLs
        return getOptimizedUrl(raw, 400);
    };

    // --- RENDER DESKTOP (Standard Grid) ---
    if (deskGrid) {
        deskGrid.innerHTML = posts.map(p => {
            const src = getSafeImg(p);
            if(!src) return "";
            return `<div class="sg-item" onclick="window.openChatPreview('${src}', false)"><img src="${src}" class="sg-img"></div>`;
        }).join('');
    }

    // --- RENDER MOBILE (Pyramid Strategy) ---
    
    // A. Center Idol (Newest)
    if (q1 && posts[0]) { 
        q1.src = getSafeImg(posts[0]); 
        q1.style.display = 'block'; 
        // Optional: Click to open full view
        q1.parentElement.onclick = () => window.openChatPreview(getSafeImg(posts[0]), false);
    }

    // B. Left Idol (2nd Newest)
    if (q2 && posts[1]) { 
        q2.src = getSafeImg(posts[1]); 
        q2.style.display = 'block'; 
    }

    // C. Right Idol (3rd Newest)
    if (q3 && posts[2]) { 
        q3.src = getSafeImg(posts[2]); 
        q3.style.display = 'block'; 
    }

    // D. The Drawer (All Posts)
    if (mobScroll) {
        mobScroll.innerHTML = posts.map(p => {
            const img = getSafeImg(p);
            const txt = p.text || p.title || "Update";
            if (!img) return "";
            
            return `
                <div class="mob-scroll-item" onclick="if(window.openModal) window.openModal('${img}', '${txt.replace(/'/g, "\\'")}')">
                    <img src="${img}" class="mob-scroll-img">
                </div>
            `;
        }).join('');
    }
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
