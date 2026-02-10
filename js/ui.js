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
        'record': 'historySection', // FIX: Button calls 'record', not 'history'
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

// *** QUEEN'S WALL RENDERER (ROYAL GAZETTE STYLE) ***
export function renderNews(posts) {
    const deskGrid = document.getElementById('newsGrid');
    const mobScroll = document.getElementById('qWall_ScrollTrack');

    if (!posts || !Array.isArray(posts)) {
        if (mobScroll) mobScroll.innerHTML = "<div style='color:#666; padding:20px; font-size:0.7rem;'>NO UPDATES</div>";
        if (deskGrid) deskGrid.innerHTML = "<div style='color:#666; padding:40px; text-align:center; font-family:\"Cinzel\";'>THE QUEEN HAS NOT SPOKEN.</div>";
        return;
    }

    // --- 1. MOBILE RENDER (SAFE RESTORATION) ---
    // We use the simpler, robust logic that allows fallbacks
    if (mobScroll) {
        mobScroll.innerHTML = posts.map(p => {
            // 1. Get Raw
            const raw = p.image || p.img || p.thumbnail || p.cover || p.media || p.url || "";
            if (!raw) return "";

            // 2. Use Global Optimizer (Safe Fallback built-in)
            // Mobile needs smaller images (400px is good balance)
            const thumb = getOptimizedUrl(raw, 400);
            // Full res for the modal
            const full = getOptimizedUrl(raw, 1000);

            const txt = p.text || p.title || "Update";

            return `
                <div class="mob-scroll-item" onclick="if(window.openModal) window.openModal('${full}', '${txt.replace(/'/g, "\\'")}')">
                    <img src="${thumb}" class="mob-scroll-img" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
            `;
        }).join('');
    }

    // --- 2. DESKTOP RENDER (ROYAL GAZETTE LAYOUT) ---
    if (deskGrid) {
        // Clear & Clean Class
        deskGrid.innerHTML = "";
        deskGrid.className = "";

        const layoutWrapper = document.createElement("div");
        layoutWrapper.className = "royal-gazette-layout";

        // Helper for Desktop logic (High Quality)
        const getDesktopMedia = (p) => {
            let raw = p.image || p.img || p.thumbnail || p.cover || p.media || p.url || "";

            // VIDEO HANDLING: If raw is a video, find a static image fallback
            if (typeof raw === 'string' && (raw.includes('.mp4') || raw.includes('.mov') || raw.includes('.webm'))) {
                // Try to find a specific cover/poster first
                if (p.cover) raw = p.cover;
                else if (p.thumbnail) raw = p.thumbnail;
                else if (p.poster) raw = p.poster;
                // If raw is STILL a video (no cover found), we can't display it in an <img> tag easily without a generated thumb.
                // We will let getOptimizedUrl try to handle it (if it's Wix/Cloudinary), otherwise it might fail.
            }

            // Desktop wants higher res
            return {
                thumb: getOptimizedUrl(raw, 600),
                full: getOptimizedUrl(raw, 1200),
                raw: raw
            };
        };

        // A. HERO SECTION (Latest Post)
        if (posts.length > 0) {
            const heroPost = posts[0];
            const heroMedia = getDesktopMedia(heroPost);

            if (heroMedia.raw) { // Only show if there is an image
                const heroTitle = heroPost.title || heroPost.text || "ROYAL DECREE";
                const heroDate = heroPost._createdDate ? new Date(heroPost._createdDate).toLocaleDateString() : "RECENT";

                const heroHTML = `
                <div class="news-hero-section" onclick="window.openChatPreview('${heroMedia.full}', false)">
                    <div class="hero-image-wrapper">
                        <img src="${heroMedia.full}" class="hero-img" onerror="this.closest('.news-hero-section').style.display='none'">
                        <div class="hero-overlay-grad"></div>
                    </div>
                    <div class="hero-content">
                        <div class="hero-label">LATEST TRANSMISSION</div>
                        <div class="hero-title">${heroTitle}</div>
                        <div class="hero-meta">${heroDate}</div>
                    </div>
                </div>`;
                layoutWrapper.innerHTML += heroHTML;
            }
        }

        // B. MASONRY GRID (Older Posts)
        if (posts.length > 1) {
            const gridHTML = `
            <div class="news-magazine-grid">
                ${posts.slice(1).map(p => {
                const media = getDesktopMedia(p);
                const txt = p.title || p.text || "Update";
                if (!media.raw) return "";

                return `
                    <div class="magazine-card" onclick="window.openChatPreview('${media.full}', false)">
                        <div class="mag-img-box">
                            <img src="${media.thumb}" class="magazine-img" loading="lazy" onerror="this.closest('.magazine-card').style.display='none'">
                            <div class="mag-overlay">
                                <span class="mag-view-btn">VIEW</span>
                            </div>
                        </div>
                        <div class="mag-footer">
                            <div class="mag-text">${txt.substring(0, 50)}${txt.length > 50 ? '...' : ''}</div>
                        </div>
                    </div>`;
            }).join('')}
            </div>`;
            layoutWrapper.innerHTML += gridHTML;
        }

        deskGrid.appendChild(layoutWrapper);
    }
}

// --- SESSION UI ---

export function openSessionUI() {
    const overlay = document.getElementById('sessionOverlay');
    if (overlay) overlay.classList.add('active');
    const costDisp = document.getElementById('sessionCostDisplay');
    if (costDisp) costDisp.innerText = "3000";
}

export function closeSessionUI() {
    const overlay = document.getElementById('sessionOverlay');
    if (overlay) overlay.classList.remove('active');
}

export function updateSessionCost() {
    const checked = document.querySelector('input[name="sessionType"]:checked');
    if (checked) {
        const cost = checked.getAttribute('data-cost');
        const costDisp = document.getElementById('sessionCostDisplay');
        if (costDisp) costDisp.innerText = cost;
    }
}
