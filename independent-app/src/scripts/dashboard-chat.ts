// src/scripts/dashboard-chat.ts
// Dashboard Chat Management - Refactored for Supabase Realtime

import { currId, ACCOUNT_ID, API_KEY, users, adminEmail } from './dashboard-state';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl, mediaType } from './media';
import { clean } from './utils';
import { uploadToSupabase } from './mediaSupabase';

// Fallback if DOMPurify is not available or needs to be used from global
const purifier = (typeof window !== 'undefined' && (window as any).DOMPurify) || { sanitize: (s: string) => s };

let chatChannel: any = null;
let lastChatMsgId: string | null = null;

/**
 * Initializes the chat listener for a specific user (Slave).
 * Called when a user is selected in the sidebar.
 */
export async function initDashboardChat(slaveEmail: string) {
    const cleanEmail = slaveEmail.toLowerCase();
    console.log(`[DASHBOARD-CHAT] Initializing for ${cleanEmail}...`);

    // 1. Clean up existing subscription
    if (chatChannel) {
        console.log(`[DASHBOARD-CHAT] Cleaning up existing subscription.`);
        const supabase = createClient();
        supabase.removeChannel(chatChannel);
        chatChannel = null;
    }
    lastChatMsgId = null;

    const b = document.getElementById('adminChatBox');
    if (b) b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Orbitron; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';

    // 2. Load History
    await loadDashboardChatHistory(cleanEmail);

    // 3. Subscribe Realtime
    const supabase = createClient();
    console.log("[DASHBOARD-CHAT] Initializing Realtime subscription...");

    chatChannel = supabase
        .channel('chats-' + cleanEmail) // Unique channel per slave to avoid cross-pollination
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chats',
            filter: `member_id=eq.${cleanEmail}`
        }, (payload) => {
            console.log(`[DASHBOARD-CHAT] New message received via Realtime:`, payload.new);
            if (payload.new.id !== lastChatMsgId) {
                appendChatMessage(payload.new);
            }
        })
        .subscribe((status) => {
            // console.log(`[DASHBOARD-CHAT] Subscription status: ${status}`); // Quieted down
        });
}

async function loadDashboardChatHistory(email: string) {
    try {
        const supabase = createClient();
        let { data: { user } } = await supabase.auth.getUser();

        // LOCAL DEV BYPASS: If no user found on localhost, assume it's CEO
        let userEmail = user?.email;
        if (!userEmail && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            userEmail = 'ceo@qkarin.com';
        }

        let url = `/api/chat/history?email=${encodeURIComponent(email)}`;
        if (userEmail) {
            url += `&requester=${encodeURIComponent(userEmail)}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            const msgs = data.messages || [];
            if (msgs.length > 0) {
                lastChatMsgId = msgs[msgs.length - 1].id;
            }

            const html = msgs.map((m: any) => renderToHtml(m)).join('');
            const b = document.getElementById('adminChatBox');
            if (b) {
                b.innerHTML = html + '<div id="chat-anchor" style="height:1px;"></div>';
                forceBottom();
            }
        }
    } catch (err) {
        console.error("Failed to load dashboard chat history:", err);
    }
}

function appendChatMessage(msg: any) {
    const b = document.getElementById('adminChatBox');
    if (!b) return;

    // Prevent duplicates from instant-append + realtime sync
    if (msg.id && msg.id === lastChatMsgId) return;
    lastChatMsgId = msg.id;

    const html = renderToHtml(msg);
    const anchor = document.getElementById('chat-anchor');
    if (anchor) {
        anchor.insertAdjacentHTML('beforebegin', html);
    } else {
        b.insertAdjacentHTML('beforeend', html + '<div id="chat-anchor" style="height:1px;"></div>');
    }
    forceBottom();
}

function renderToHtml(m: any) {
    // Admin (Queen) message: sender differs from the member owning the conversation
    const isMe = m.type !== 'system' && m.sender_email && m.member_id
        && m.sender_email.toLowerCase() !== m.member_id.toLowerCase();

    const ts = new Date(m.created_at || Date.now()).getTime();
    const timeStr = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = m.content || m.message || "";

    const queenAvatar = `<img src="/queen-karin.png" class="cb-queen-av" alt="Q" onerror="this.style.display='none'" />`;

    // ── Tribute / wishlist card ── centered, no bubble
    if (m.type === 'wishlist') {
        const item = m.metadata || {};
        const itmTitle = item.title || "Tribute Item";
        const itmPrice = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
        const itmImg = item.image || item.url || "";
        return `
            <div class="chat-gift-wrap">
                <div class="chat-gift-card">
                    <div class="chat-gift-img" style="background-image:url('${getOptimizedUrl(itmImg, 200)}')">
                        ${itmPrice ? `<div class="chat-gift-price"><i class="fas fa-coins"></i> ${itmPrice.toLocaleString()}</div>` : ''}
                    </div>
                    <div class="chat-gift-body">
                        <div class="chat-gift-label">✦ Tribute Sent</div>
                        <div class="chat-gift-title">${clean(itmTitle)}</div>
                    </div>
                </div>
                <div class="chat-ts" style="text-align:center;margin-top:4px">${timeStr}</div>
            </div>`;
    }

    // ── Build bubble content ──
    // Dashboard perspective: admin (isMe) → RIGHT, slave → LEFT
    const bubbleClass = isMe ? 'cb-queen' : 'cb-slave';
    const slaveAvatar = users.find(u => u.memberId === m.member_id)?.avatar || '';
    const slaveAv = slaveAvatar ? `<img src="${getOptimizedUrl(slaveAvatar, 60)}" class="cb-queen-av" alt="" />` : '';

    let bubble = '';
    if (m.type === 'photo') {
        bubble = `<div class="${bubbleClass}"><img src="${getOptimizedUrl(content, 300)}" class="chat-img-attachment" style="cursor:pointer" onclick="openChatPreview('${encodeURIComponent(content)}', false)" /></div>`;
    } else if (m.type === 'video') {
        bubble = `<div class="${bubbleClass}" style="padding:4px;"><video src="${content}" controls playsinline class="chat-img-attachment"></video></div>`;
    } else {
        let safeHtml = purifier.sanitize(content);
        safeHtml = safeHtml.replace(/\n/g, '<br>');
        bubble = `<div class="${bubbleClass}">${safeHtml}</div>`;
    }

    // Admin (isMe) → RIGHT, no avatar
    if (isMe) {
        return `
            <div class="cb-row cb-row-me">
                <div class="cb-wrap-me">
                    ${bubble}
                    <div class="chat-ts chat-ts-right">${timeStr}</div>
                </div>
            </div>`;
    } else {
        // Slave → LEFT, slave avatar
        return `
            <div class="cb-row cb-row-queen">
                ${slaveAv}
                <div class="cb-wrap-queen">
                    ${bubble}
                    <div class="chat-ts chat-ts-left">${timeStr}</div>
                </div>
            </div>`;
    }
}

function forceBottom() {
    const b = document.getElementById('adminChatBox');
    if (b) b.scrollTop = b.scrollHeight;
}

export async function sendMsg() {
    const inp = document.getElementById('adminInp') as HTMLInputElement;
    const btn = document.querySelector('.btn-send') as HTMLButtonElement;

    const activeCurrId = currId || (window as any).currId;
    if (!inp || !activeCurrId) {
        console.warn(`[DASHBOARD-CHAT] Send failed: Missing input ${!inp} or currId ${!activeCurrId}`);
        return;
    }

    const text = inp.value.trim();
    if (!text) return;

    if (inp.disabled) return;
    inp.disabled = true;
    if (btn) btn.disabled = true;

    // Resolve admin email: state → window fallback → Supabase auth
    let senderEmail: string | null = adminEmail || (window as any).adminEmail || null;
    if (!senderEmail) {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            senderEmail = user?.email || null;
            if (senderEmail) {
                const { setAdminEmail } = await import('./dashboard-state');
                setAdminEmail(senderEmail);
            }
        } catch (_) {}
    }
    if (!senderEmail) {
        console.error(`[DASHBOARD-CHAT] Send failed: Admin email not available.`);
        alert("Authentication Error: Admin email not found. Please ensure you are logged in.");
        inp.disabled = false;
        if (btn) btn.disabled = false;
        return;
    }

    // console.log(`[DASHBOARD-CHAT] Sending message to ${currId} from ${adminEmail}...`); // Removed email from log

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: senderEmail,
                conversationId: activeCurrId, // sending TO this slave
                content: text,
                type: 'text'
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`[DASHBOARD-CHAT] Message sent successfully.`);
            inp.value = "";
            // Append instantly for UX
            if (data.data) {
                appendChatMessage(data.data);
            }
        } else {
            console.error(`[DASHBOARD-CHAT] Message send API error:`, data.error);
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        console.error(`[DASHBOARD-CHAT] Message send network error:`, err);
        alert("Network Error: Failed to reach the chat server.");
    } finally {
        inp.disabled = false;
        if (btn) btn.disabled = false;
        inp.focus();
    }
}

export async function handleAdminUpload(file: File) {
    if (!file) return;
    const activeCurrId = currId || (window as any).currId;
    if (!activeCurrId) return;

    const btn = document.querySelector('.btn-plus') as HTMLButtonElement;
    if (btn) { btn.innerText = '⏳'; btn.disabled = true; }

    try {
        const isVideo = file.type.startsWith('video/');
        const msgType = isVideo ? 'video' : 'photo';

        // Upload directly to Supabase (videos bypass API route size limit)
        const url = await uploadToSupabase('media', 'admin-chat', file);
        if (url === 'failed') {
            console.error('[DASHBOARD-CHAT] Media upload failed');
            return;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        let userEmail = user?.email;
        if (!userEmail && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            userEmail = 'ceo@qkarin.com';
        }
        if (!userEmail) return;

        const sendRes = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderEmail: userEmail,
                conversationId: activeCurrId,
                content: url,
                type: msgType,
            }),
        });
        const sendData = await sendRes.json();
        if (sendData.success && sendData.data) {
            appendChatMessage(sendData.data);
        } else {
            console.error('[DASHBOARD-CHAT] Send error:', sendData.error);
        }
    } catch (err) {
        console.error('[DASHBOARD-CHAT] Upload error:', err);
    } finally {
        if (btn) { btn.innerText = '+'; btn.disabled = false; }
    }
}

// iOS-safe media picker for admin chat — dynamic input avoids hidden-element restriction
export function triggerAdminMediaPick() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*';
    inp.style.position = 'fixed';
    inp.style.top = '-9999px';
    document.body.appendChild(inp);
    inp.onchange = () => {
        document.body.removeChild(inp);
        if (inp.files?.[0]) handleAdminUpload(inp.files[0]);
    };
    inp.click();
}

// Global Bindings
if (typeof window !== 'undefined') {
    (window as any).sendMsg = sendMsg;
    (window as any).handleAdminUpload = handleAdminUpload;
    (window as any).triggerAdminMediaPick = triggerAdminMediaPick;
}
