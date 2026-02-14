// UI management functions - FULL LOGIC WITH WISHLIST & VAULT SYNC & SLAVE RECORD FIX
import { currentView, cmsHierarchyData, setCurrentView, WISHLIST_ITEMS, gameStats } from './state.js';
import { CMS_HIERARCHY } from './config.js';
import { renderGallery, loadMoreHistory } from './gallery.js';
import { getOptimizedUrl, getThumbnail, getSignedUrl } from './media.js';
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
        'serve': (document.getElementById('viewServingTopDesktop') ? 'viewServingTopDesktop' : 'viewServingTop'),
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
export async function renderNews(posts) {
    const deskGrid = document.getElementById('newsGrid');
    const mobScroll = document.getElementById('qWall_ScrollTrack');

    if (!posts || !Array.isArray(posts)) {
        if (mobScroll) mobScroll.innerHTML = "<div style='color:#666; padding:20px; font-size:0.7rem;'>NO UPDATES</div>";
        if (deskGrid) deskGrid.innerHTML = "<div style='color:#666; padding:40px; text-align:center; font-family:\"Cinzel\";'>THE QUEEN HAS NOT SPOKEN.</div>";
        return;
    }

    // --- ALTAR LOGIC COPIED FROM GALLERY.JS ---
    const getThumb = async (item, size) => {
        let raw = item.image || item.img || item.thumbnail || item.cover || item.media || item.url || "";

        // Video Cover Check
        if (typeof raw === 'string' && (raw.includes('.mp4') || raw.includes('.mov') || raw.includes('.webm') || raw.startsWith('wix:video'))) {
            if (item.cover) raw = item.cover;
            else if (item.thumbnail) raw = item.thumbnail;
            else if (item.poster) raw = item.poster;
        }

        // Wix Check (Manual Parsing - The "Altar" Way)
        if (raw && raw.startsWith('wix:image')) {
            try { raw = "https://static.wixstatic.com/media/" + raw.split('/')[3].split('#')[0]; } catch (e) { }
        }

        try {
            return await getSignedUrl(getThumbnail(getOptimizedUrl(raw, size)));
        } catch (e) { return raw; }
    };

    // --- 1. PRE-PROCESS DATA (ASYNC) ---
    // We resolve all URLs first to avoid partial rendering
    const processedPosts = await Promise.all(posts.map(async p => {
        const thumb = await getThumb(p, 400); // Mobile/Grid size
        const full = await getThumb(p, 1200); // Desktop Hero size
        let raw = p.image || p.img || p.thumbnail || p.cover || p.media || p.url || "";
        return { ...p, _thumbUrl: thumb, _fullUrl: full, _rawUrl: raw };
    }));

    // --- 2. MOBILE RENDER (SAFE RESTORATION) ---
    if (mobScroll) {
        mobScroll.innerHTML = processedPosts.map(p => {
            if (!p._thumbUrl) return "";
            const txt = p.text || p.title || "Update";

            return `
                <div class="mob-scroll-item" onclick="if(window.openModal) window.openModal('${p._fullUrl}', '${txt.replace(/'/g, "\\'")}')">
                    <img src="${p._thumbUrl}" class="mob-scroll-img" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
            `;
        }).join('');
    }

    // --- 3. DESKTOP RENDER (ROYAL GAZETTE LAYOUT) ---
    if (deskGrid) {
        deskGrid.innerHTML = "";
        deskGrid.className = "";

        const layoutWrapper = document.createElement("div");
        layoutWrapper.className = "royal-gazette-layout";

        // A. HERO SECTION (Latest Post)
        if (processedPosts.length > 0) {
            const heroPost = processedPosts[0];
            const heroTitle = heroPost.title || heroPost.text || "ROYAL DECREE";
            const heroDate = heroPost._createdDate ? new Date(heroPost._createdDate).toLocaleDateString() : "RECENT";

            if (heroPost._fullUrl) { // Only show if we explicitly have a full URL
                // Determine if video
                const isVideo = heroPost._rawUrl.toLowerCase().includes('.mp4') ||
                    heroPost._rawUrl.toLowerCase().includes('.mov') ||
                    heroPost._rawUrl.toLowerCase().includes('.webm') ||
                    heroPost._rawUrl.startsWith('wix:video');

                // For video, we try to construct the direct video URL if possible
                let videoSrc = heroPost._fullUrl;
                if (isVideo && heroPost._rawUrl.startsWith('wix:video')) {
                    try { videoSrc = `https://video.wixstatic.com/video/${heroPost._rawUrl.split('/')[3].split('#')[0]}/mp4/file.mp4`; } catch (e) { }
                }

                const mediaTag = isVideo
                    ? `<video src="${videoSrc}" class="hero-img" autoplay muted loop playsinline></video>`
                    : `<img src="${heroPost._fullUrl}" class="hero-img" onerror="this.closest('.news-hero-section').style.display='none'">`;

                const heroHTML = `
                <div class="news-hero-section" onclick="window.openChatPreview('${heroPost._fullUrl}', false)">
                    <div class="hero-image-wrapper">
                        ${mediaTag}
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
        if (processedPosts.length > 1) {
            const gridHTML = `
            <div class="news-magazine-grid">
                ${processedPosts.slice(1).map(p => {
                if (!p._thumbUrl) return "";
                const txt = p.title || p.text || "Update";

                const isVideo = p._rawUrl.toLowerCase().includes('.mp4') ||
                    p._rawUrl.toLowerCase().includes('.mov') ||
                    p._rawUrl.toLowerCase().includes('.webm') ||
                    p._rawUrl.startsWith('wix:video');

                let videoSrc = p._thumbUrl; // Default to thumb for video poster/src
                if (isVideo && p._rawUrl.startsWith('wix:video')) {
                    try { videoSrc = `https://video.wixstatic.com/video/${p._rawUrl.split('/')[3].split('#')[0]}/mp4/file.mp4`; } catch (e) { }
                }

                const mediaTag = isVideo
                    ? `<video src="${videoSrc}" class="magazine-img" autoplay muted loop playsinline></video>`
                    : `<img src="${p._thumbUrl}" class="magazine-img" loading="lazy" onerror="this.closest('.magazine-card').style.display='none'">`;

                return `
                    <div class="magazine-card" onclick="window.openChatPreview('${p._fullUrl}', false)">
                        <div class="mag-img-box">
                            ${mediaTag}
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
