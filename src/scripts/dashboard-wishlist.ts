// src/scripts/dashboard-wishlist.ts
// Admin Wishlist Manager - CRUD panel on the dashboard
import { getOptimizedUrl } from './media';

let wishlistItems: any[] = [];
let editingId: string | null = null;

// ─── LOAD & RENDER ───────────────────────────────────────────────────────────
export async function loadWishlistManager() {
    const container = document.getElementById('wishlistPanel');
    if (!container) return;
    container.innerHTML = `<div style="padding:20px;font-family:'Orbitron';font-size:0.65rem;color:#c5a059;">LOADING WISHLIST...</div>`;

    try {
        const res = await fetch('/api/admin/wishlist');
        const data = await res.json();
        wishlistItems = data.items || [];
        renderWishlistPanel();
    } catch (err) {
        const container = document.getElementById('wishlistPanel');
        if (container) container.innerHTML = `<div style="padding:20px;color:#ff4444;font-family:'Orbitron';font-size:0.65rem;">FAILED TO LOAD WISHLIST</div>`;
    }
}

function renderWishlistPanel() {
    const container = document.getElementById('wishlistPanel');
    if (!container) return;

    const itemsHtml = wishlistItems.map(item => {
        const isCrowdfund = item.is_crowdfund || item.Is_Crowdfund || false;
        const price = parseInt(item.Price || item.price || 0);
        const raised = parseInt(item.raised_amount || 0);
        const goal = parseInt(item.goal_amount || item.Goal_Amount || 0);
        const img = item.Image || item.image || '';
        const id = item.ID || item.id || item.Title;
        const title = item.Title || item.title || '-';
        const category = item.Category || item.category || '';
        const typeColor = isCrowdfund ? '#64b4ff' : '#c5a059';
        const typeBg = isCrowdfund ? 'rgba(100,180,255,0.15)' : 'rgba(197,160,89,0.15)';
        const progressBar = isCrowdfund && goal > 0
            ? `<div style="margin-top:4px;height:2px;background:rgba(255,255,255,0.1);border-radius:1px;overflow:hidden;"><div style="height:100%;width:${Math.min((raised / goal) * 100, 100)}%;background:#c5a059;"></div></div>`
            : '';

        return `
        <div class="wl-card" style="position:relative;border-radius:10px;overflow:hidden;background:#0a0a14;border:1px solid rgba(197,160,89,0.15);cursor:pointer;"
             onmouseenter="this.querySelector('.wl-actions').style.opacity='1'"
             onmouseleave="this.querySelector('.wl-actions').style.opacity='0'">
            <!-- Image area -->
            <div style="width:100%;aspect-ratio:1;overflow:hidden;background:#050510;">
                ${img
                    ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;display:block;">`
                    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#222;font-size:2rem;">📷</div>`
                }
            </div>
            <!-- Info area -->
            <div style="padding:10px 10px 8px;">
                <div style="font-family:'Orbitron';font-size:0.72rem;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;">${title}</div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:'Orbitron';font-size:0.55rem;color:#c5a059;font-weight:700;">${price.toLocaleString()} coins</span>
                    <span style="font-family:'Orbitron';font-size:0.45rem;padding:2px 6px;border-radius:10px;background:${typeBg};color:${typeColor};">${isCrowdfund ? 'CROWDFUND' : 'GIFT'}</span>
                    ${category ? `<span style="font-family:'Orbitron';font-size:0.42rem;color:rgba(255,255,255,0.25);">${category}</span>` : ''}
                </div>
                ${progressBar}
            </div>
            <!-- Hover actions -->
            <div class="wl-actions" style="position:absolute;bottom:0;left:0;right:0;display:flex;gap:0;opacity:0;transition:opacity 0.15s;">
                <button onclick="event.stopPropagation();window.openWishlistEdit('${id}')" style="flex:1;padding:8px 0;background:rgba(197,160,89,0.9);border:none;color:#000;font-family:'Orbitron';font-size:0.5rem;font-weight:700;cursor:pointer;letter-spacing:1px;">EDIT</button>
                <button onclick="event.stopPropagation();window.deleteWishlistItem('${id}')" style="flex:1;padding:8px 0;background:rgba(180,0,40,0.9);border:none;color:#fff;font-family:'Orbitron';font-size:0.5rem;font-weight:700;cursor:pointer;letter-spacing:1px;">DEL</button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-family:'Orbitron';font-size:0.6rem;color:rgba(197,160,89,0.6);letter-spacing:2px;">${wishlistItems.length} ITEMS</div>
                <button onclick="window.openWishlistAdd()" style="padding:7px 16px;background:linear-gradient(135deg,#c5a059,#8b6914);color:#000;font-family:'Orbitron';font-size:0.55rem;font-weight:700;border:none;border-radius:4px;cursor:pointer;letter-spacing:1px;">+ ADD ITEM</button>
            </div>
            <div id="wishlistItemsList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;">
                ${itemsHtml || `<div style="color:rgba(255,255,255,0.3);font-family:'Orbitron';font-size:0.6rem;text-align:center;padding:40px;grid-column:1/-1;">NO ITEMS YET</div>`}
            </div>
        </div>

        <!-- Modal -->
        <div id="wishlistModal" style="display:none;position:fixed;top:0;right:0;bottom:0;left:320px;background:rgba(0,0,0,0.85);z-index:9999;align-items:center;justify-content:center;backdrop-filter:blur(8px);">
            <div style="background:#0d0d1a;border:1px solid rgba(197,160,89,0.4);border-radius:12px;padding:28px;width:90%;max-width:420px;max-height:90vh;overflow-y:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <div id="wishlistModalTitle" style="font-family:'Orbitron';font-size:1rem;color:#c5a059;letter-spacing:2px;">ADD ITEM</div>
                    <button onclick="window.closeWishlistModal()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:1.2rem;cursor:pointer;">✕</button>
                </div>

                <!-- Photo upload -->
                <div style="margin-bottom:16px;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:6px;">PHOTO</div>
                    <div id="wishlistImgPreview" style="width:100%;height:140px;background:#050510;border:1px dashed rgba(197,160,89,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;margin-bottom:6px;" onclick="document.getElementById('wishlistImgInput').click()">
                        <span style="color:rgba(255,255,255,0.2);font-family:'Orbitron';font-size:0.55rem;">CLICK TO UPLOAD</span>
                    </div>
                    <input type="file" id="wishlistImgInput" accept="image/*" style="display:none;" onchange="window.handleWishlistImageSelect(this)">
                    <input type="text" id="wishlistImgUrl" placeholder="Or paste image URL..." style="width:100%;box-sizing:border-box;padding:7px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.2);border-radius:4px;color:#fff;font-family:'Orbitron';font-size:0.55rem;outline:none;" oninput="window.previewWishlistUrl(this.value)">
                </div>

                <div style="margin-bottom:12px;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:6px;">NAME *</div>
                    <input type="text" id="wishlistFieldTitle" placeholder="Item name..." style="width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.2);border-radius:4px;color:#fff;font-family:'Orbitron';font-size:0.8rem;outline:none;">
                </div>

                <div id="priceRow" style="margin-bottom:12px;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:6px;">PRICE (COINS) *</div>
                    <input type="number" id="wishlistFieldPrice" placeholder="e.g. 500" min="0" style="width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.2);border-radius:4px;color:#c5a059;font-family:'Orbitron';font-size:0.8rem;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:6px;">CATEGORY</div>
                    <input type="text" id="wishlistFieldCategory" placeholder="e.g. Food, Experience..." style="width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(197,160,89,0.2);border-radius:4px;color:#fff;font-family:'Orbitron';font-size:0.7rem;outline:none;">
                </div>

                <div style="margin-bottom:12px;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:8px;">TYPE</div>
                    <div style="display:flex;gap:10px;">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'Orbitron';font-size:0.6rem;color:#fff;">
                            <input type="radio" name="wishlistType" id="wishlistTypeGift" value="gift" checked style="accent-color:#c5a059;"> GIFT
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'Orbitron';font-size:0.6rem;color:#64b4ff;">
                            <input type="radio" name="wishlistType" id="wishlistTypeCrowdfund" value="crowdfund" style="accent-color:#64b4ff;"> CROWDFUND
                        </label>
                    </div>
                </div>

                <div id="goalAmountRow" style="margin-bottom:16px;display:none;">
                    <div style="font-family:'Orbitron';font-size:0.55rem;color:rgba(197,160,89,0.7);letter-spacing:1px;margin-bottom:6px;">GOAL AMOUNT (COINS)</div>
                    <input type="number" id="wishlistFieldGoal" placeholder="e.g. 10000" min="0" style="width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(100,180,255,0.2);border-radius:4px;color:#64b4ff;font-family:'Orbitron';font-size:0.8rem;outline:none;">
                </div>

                <div id="wishlistSaveErr" style="display:none;color:#ff4444;font-family:'Orbitron';font-size:0.55rem;margin-bottom:10px;"></div>

                <button onclick="window.saveWishlistItem()" style="width:100%;padding:12px;background:linear-gradient(135deg,#c5a059,#8b6914);color:#000;font-family:'Orbitron';font-size:0.65rem;font-weight:700;border:none;border-radius:6px;cursor:pointer;letter-spacing:2px;">SAVE ITEM</button>
            </div>
        </div>
    `;

    // Show/hide price vs goal fields based on type selection
    ['wishlistTypeGift', 'wishlistTypeCrowdfund'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            const isCrowdfund = (document.getElementById('wishlistTypeCrowdfund') as HTMLInputElement)?.checked;
            const goalRow = document.getElementById('goalAmountRow');
            const priceRow = document.getElementById('priceRow');
            if (goalRow) goalRow.style.display = isCrowdfund ? 'block' : 'none';
            if (priceRow) priceRow.style.display = isCrowdfund ? 'none' : 'block';
        });
    });
}

// ─── MODAL OPEN/CLOSE ─────────────────────────────────────────────────────────
export function openWishlistAdd() {
    editingId = null;
    const modal = document.getElementById('wishlistModal');
    const modalTitle = document.getElementById('wishlistModalTitle');
    if (modalTitle) modalTitle.textContent = 'ADD ITEM';
    resetWishlistForm();
    if (modal) { modal.style.display = 'flex'; }
}

export function openWishlistEdit(id: string) {
    const item = wishlistItems.find(i => String(i.ID || i.id || i.Title) === String(id));
    if (!item) return;
    editingId = id;

    const modal = document.getElementById('wishlistModal');
    const modalTitle = document.getElementById('wishlistModalTitle');
    if (modalTitle) modalTitle.textContent = 'EDIT ITEM';
    resetWishlistForm();

    const isCrowdfund = item.is_crowdfund || item.Is_Crowdfund || false;

    (document.getElementById('wishlistFieldTitle') as HTMLInputElement).value = item.Title || item.title || '';
    (document.getElementById('wishlistFieldPrice') as HTMLInputElement).value = String(item.Price || item.price || '');
    (document.getElementById('wishlistFieldCategory') as HTMLInputElement).value = item.Category || item.category || '';
    (document.getElementById('wishlistImgUrl') as HTMLInputElement).value = item.Image || item.image || '';
    (document.getElementById(isCrowdfund ? 'wishlistTypeCrowdfund' : 'wishlistTypeGift') as HTMLInputElement).checked = true;

    const goalRow = document.getElementById('goalAmountRow');
    const priceRow = document.getElementById('priceRow');
    if (goalRow) goalRow.style.display = isCrowdfund ? 'block' : 'none';
    if (priceRow) priceRow.style.display = isCrowdfund ? 'none' : 'block';
    if (isCrowdfund) {
        (document.getElementById('wishlistFieldGoal') as HTMLInputElement).value = String(item.goal_amount || item.Goal_Amount || '');
    }

    const preview = document.getElementById('wishlistImgPreview');
    if (preview && (item.Image || item.image)) {
        preview.innerHTML = `<img src="${item.Image || item.image}" style="width:100%;height:100%;object-fit:cover;">`;
    }

    if (modal) modal.style.display = 'flex';
}

export function closeWishlistModal() {
    const modal = document.getElementById('wishlistModal');
    if (modal) modal.style.display = 'none';
}

function resetWishlistForm() {
    ['wishlistFieldTitle', 'wishlistFieldPrice', 'wishlistFieldCategory', 'wishlistFieldGoal', 'wishlistImgUrl'].forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = '';
    });
    (document.getElementById('wishlistTypeGift') as HTMLInputElement).checked = true;
    const goalRow = document.getElementById('goalAmountRow');
    if (goalRow) goalRow.style.display = 'none';
    const preview = document.getElementById('wishlistImgPreview');
    if (preview) preview.innerHTML = `<span style="color:rgba(255,255,255,0.2);font-family:'Orbitron';font-size:0.55rem;">CLICK TO UPLOAD</span>`;
    const err = document.getElementById('wishlistSaveErr');
    if (err) err.style.display = 'none';
}

// ─── IMAGE HANDLING ───────────────────────────────────────────────────────────
export async function handleWishlistImageSelect(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;

    const preview = document.getElementById('wishlistImgPreview');
    if (preview) preview.innerHTML = `<span style="color:#c5a059;font-family:'Orbitron';font-size:0.55rem;">UPLOADING...</span>`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/admin/wishlist/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
            (document.getElementById('wishlistImgUrl') as HTMLInputElement).value = data.url;
            if (preview) preview.innerHTML = `<img src="${data.url}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            const errMsg = data.error || 'Upload failed';
            console.error('[wishlist/upload]', errMsg);
            if (preview) preview.innerHTML = `<span style="color:#ff4444;font-family:'Orbitron';font-size:0.48rem;padding:8px;text-align:center;display:block;">${errMsg}</span>`;
        }
    } catch (err: any) {
        console.error('[wishlist/upload] network error', err);
        if (preview) preview.innerHTML = `<span style="color:#ff4444;font-family:'Orbitron';font-size:0.48rem;">NETWORK ERROR</span>`;
    }
}

export function previewWishlistUrl(url: string) {
    const preview = document.getElementById('wishlistImgPreview');
    if (!preview) return;
    if (url && url.startsWith('http')) {
        preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=\\'color:#ff4444;font-family:Orbitron;font-size:0.55rem;\\'>INVALID URL</span>'">`;
    } else {
        preview.innerHTML = `<span style="color:rgba(255,255,255,0.2);font-family:'Orbitron';font-size:0.55rem;">CLICK TO UPLOAD</span>`;
    }
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────
export async function saveWishlistItem() {
    const title = (document.getElementById('wishlistFieldTitle') as HTMLInputElement)?.value.trim();
    const price = parseInt((document.getElementById('wishlistFieldPrice') as HTMLInputElement)?.value || '0');
    const imageUrl = (document.getElementById('wishlistImgUrl') as HTMLInputElement)?.value.trim();
    const category = (document.getElementById('wishlistFieldCategory') as HTMLInputElement)?.value.trim();
    const isCrowdfund = (document.getElementById('wishlistTypeCrowdfund') as HTMLInputElement)?.checked;
    const goalAmount = parseInt((document.getElementById('wishlistFieldGoal') as HTMLInputElement)?.value || '0');

    const errEl = document.getElementById('wishlistSaveErr');
    if (!title) { if (errEl) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; } return; }
    if (!isCrowdfund && (!price || price <= 0)) { if (errEl) { errEl.textContent = 'Price must be greater than 0.'; errEl.style.display = 'block'; } return; }
    if (isCrowdfund && (!goalAmount || goalAmount <= 0)) { if (errEl) { errEl.textContent = 'Goal amount must be greater than 0.'; errEl.style.display = 'block'; } return; }
    if (errEl) errEl.style.display = 'none';

    const saveBtn = document.querySelector('#wishlistModal button[onclick="window.saveWishlistItem()"]') as HTMLButtonElement;
    if (saveBtn) { saveBtn.textContent = 'SAVING...'; saveBtn.disabled = true; }

    try {
        const payload: any = { title, price: isCrowdfund ? goalAmount : price, imageUrl, category, is_crowdfund: isCrowdfund, goal_amount: isCrowdfund ? goalAmount : 0 };
        if (editingId) payload.id = editingId;

        const res = await fetch('/api/admin/wishlist', {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            closeWishlistModal();
            loadWishlistManager();
        } else {
            if (errEl) { errEl.textContent = data.error || 'Save failed.'; errEl.style.display = 'block'; }
        }
    } finally {
        if (saveBtn) { saveBtn.textContent = 'SAVE ITEM'; saveBtn.disabled = false; }
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function deleteWishlistItem(id: string) {
    if (!confirm('Delete this item from the wishlist?')) return;
    try {
        const res = await fetch(`/api/admin/wishlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadWishlistManager();
        else alert('Delete failed: ' + data.error);
    } catch (err) {
        alert('Delete failed.');
    }
}
