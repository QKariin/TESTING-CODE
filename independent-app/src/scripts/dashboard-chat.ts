// src/scripts/dashboard-chat.ts
// Dashboard Chat Management - Refactored for Supabase Realtime

import { currId, ACCOUNT_ID, API_KEY, users } from './dashboard-state';
import { createClient } from '@/utils/supabase/client';
import { getOptimizedUrl, mediaType } from './media';

const DOMPurify = (globalThis as any).DOMPurify || { sanitize: (s: string) => s };

let chatChannel: any = null;

/**
 * Initializes the chat listener for a specific user (Slave).
 * Called when a user is selected in the sidebar.
 */
export async function initDashboardChat(slaveEmail: string) {
    console.log(`[DASHBOARD-CHAT] Initializing for ${slaveEmail}...`);
    // 1. Clean up existing subscription
    if (chatChannel) {
        console.log(`[DASHBOARD-CHAT] Cleaning up existing subscription.`);
        chatChannel.unsubscribe();
        chatChannel = null;
    }

    const b = document.getElementById('adminChatBox');
    if (b) b.innerHTML = '<div style="color:#444; text-align:center; padding:20px; font-family:Orbitron; font-size:0.7rem;">ESTABLISHING ENCRYPTED LINK...</div>';

    // 2. Load History
    await loadDashboardChatHistory(slaveEmail);

    // 3. Subscribe Realtime
    const supabase = createClient();
    console.log(`[DASHBOARD-CHAT] Subscribing to Realtime for ${slaveEmail}...`);
    chatChannel = supabase
        .channel('chats') // Use the same global channel as profile
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chats',
            filter: `member_id=eq.${slaveEmail}`
        }, (payload) => {
            console.log(`[DASHBOARD-CHAT] New message received:`, payload.new);
            appendChatMessage(payload.new);
        })
        .subscribe((status) => {
            console.log(`[DASHBOARD-CHAT] Subscription status: ${status}`);
        });
}

async function loadDashboardChatHistory(email: string) {
    try {
        const res = await fetch(`/api/chat/history?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.success) {
            const html = data.messages.map((m: any) => renderToHtml(m)).join('');
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
    const isMe = m.metadata?.isQueen === true || m.sender_email.includes('queen') || m.sender_email.includes('admin'); // Fallback check
    const timeStr = new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contentHtml = '';
    const msgClass = isMe ? 'm-out' : 'm-in';
    const rowClass = isMe ? 'mr-out' : 'mr-in';

    if (m.type === 'wishlist') {
        const item = m.metadata || {};
        contentHtml = `
            <div class="msg-wishlist-card" style="margin: 0 auto; padding:0; overflow:hidden; background:linear-gradient(180deg, #1a1a1a, #000); border:1px solid #c5a059; border-radius:4px; max-width:200px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                <div style="width:100%; height:120px; overflow:hidden; position:relative;">
                     <img src="${item.image}" style="width:100%; height:100%; object-fit:cover;">
                     <div style="position:absolute; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.7); color:#c5a059; font-size:0.6rem; padding:2px; text-align:center;">
                         TRIBUTE SENT
                     </div>
                </div>
                <div style="padding:8px; text-align:center;">
                    <div style="color:#eee; font-family:'Cinzel'; font-size:0.6rem; margin-bottom:2px; opacity:0.8;">SLAVE sent</div>
                    <div style="color:#fff; font-family:'Cinzel'; font-size:0.7rem; margin-bottom:4px;">${item.title}</div>
                    <div style="color:#c5a059; font-family:'Orbitron'; font-size:0.8rem; font-weight:bold;">${item.price.toLocaleString()}</div>
                </div>
            </div>`;
        return `<div class="msg-row" style="justify-content:center; margin-bottom:15px; width:100%; display:flex;"><div class="msg-col" style="align-items:center;">${contentHtml}<div class="msg-time" style="text-align:center; width:100%; margin-top:5px;">${timeStr}</div></div></div>`;
    }

    if (m.type === 'photo') {
        contentHtml = `<div class="msg ${msgClass}"><img src="${m.content}" onclick="openChatPreview('${encodeURIComponent(m.content)}', false)" style="cursor:pointer; display:block; max-width:100%;"></div>`;
    } else {
        let safeHtml = DOMPurify.sanitize(m.content);
        safeHtml = safeHtml.replace(/\n/g, "<br>");
        contentHtml = `<div class="msg ${msgClass}">${safeHtml}</div>`;
    }

    const avatarUrl = isMe
        ? "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png"
        : (users.find(u => u.memberId === m.member_id)?.avatar || "https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png");

    const avatarHtml = `<img src="${avatarUrl}" class="chat-av">`;

    return `<div class="msg-row ${rowClass}">${!isMe ? avatarHtml : ''}${contentHtml}${isMe ? avatarHtml : ''}<div class="msg-meta ${isMe ? 'mm-out' : 'mm-in'}">${timeStr}</div></div>`;
}

function forceBottom() {
    const b = document.getElementById('adminChatBox');
    if (b) b.scrollTop = b.scrollHeight;
}

export async function sendMsg() {
    const inp = document.getElementById('adminInp') as HTMLInputElement;
    if (!inp || !currId) {
        console.warn(`[DASHBOARD-CHAT] Send failed: Missing input ${!inp} or currId ${!currId}`);
        return;
    }

    const text = inp.value.trim();
    if (!text) return;

    // We need to know the Admin's email to send it
    const supabase = createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user?.email) {
        console.error(`[DASHBOARD-CHAT] Send failed: No authenticated user email found.`, userErr);
        alert("Authentication Error: Failed to identify admin email. Please re-login.");
        return;
    }

    console.log(`[DASHBOARD-CHAT] Sending message to ${currId} from ${user.email}...`);

    try {
        const res = await fetch('/api/chat/send', {
            method: 'POST',
            body: JSON.stringify({
                senderEmail: user.email,
                conversationId: currId, // sending TO this slave
                content: text,
                type: 'text'
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`[DASHBOARD-CHAT] Message sent successfully.`);
            inp.value = "";
        } else {
            console.error(`[DASHBOARD-CHAT] Message send API error:`, data.error);
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        console.error(`[DASHBOARD-CHAT] Message send network error:`, err);
        alert("Network Error: Failed to reach the chat server.");
    }
}

export async function handleAdminUpload(input: HTMLInputElement) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fd = new FormData();
        fd.append("file", file);

        try {
            const btn = document.querySelector('.btn-plus') as HTMLButtonElement;
            const originalText = btn.innerText;
            btn.innerText = "⏳";

            const res = await fetch(
                `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=/admin`,
                { method: "POST", headers: { "Authorization": `Bearer ${API_KEY}` }, body: fd }
            );

            if (!res.ok) {
                btn.innerText = originalText;
                return;
            }

            const d = await res.json();
            if (d.files && d.files[0] && d.files[0].fileUrl) {
                const url = d.files[0].fileUrl;
                // Send as photo message
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) {
                    await fetch('/api/chat/send', {
                        method: 'POST',
                        body: JSON.stringify({
                            senderEmail: user.email,
                            conversationId: currId,
                            content: url,
                            type: 'photo'
                        })
                    });
                }
            }
            btn.innerText = originalText;
        } catch (err) {
            console.error("Upload error", err);
            const btn = document.querySelector('.btn-plus') as HTMLButtonElement;
            if (btn) btn.innerText = "+";
        }
    }
}

// Global Bindings
if (typeof window !== 'undefined') {
    (window as any).sendMsg = sendMsg;
    (window as any).handleAdminUpload = handleAdminUpload;
}
