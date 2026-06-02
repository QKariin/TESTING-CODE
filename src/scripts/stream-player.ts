/**
 * Floating livestream player + stream chat.
 * Call `initStreamPlayer()` on profile page load.
 * Call `initStreamPreview()` on home page for blurred teaser.
 */

const CF_SUBDOMAIN = 'customer-d8ziir1df1lqjii2.cloudflarestream.com';
const CF_STREAM_ID = '9a3ae8586ec9914c65a5c3a752671fd6';
const HLS_URL = `https://${CF_SUBDOMAIN}/${CF_STREAM_ID}/manifest/video.m3u8`;
const IFRAME_URL = `https://${CF_SUBDOMAIN}/${CF_STREAM_ID}/iframe`;

let _isLive = false;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _chatOpen = false;
let _playerMinimized = false;
let _getEmail: () => string = () => '';

// ── LIVE CHECK ──
async function checkLive(): Promise<boolean> {
    try {
        const res = await fetch('/api/stream/status', { cache: 'no-store' });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.live;
    } catch {
        return false;
    }
}

// ── PROFILE: FLOATING PLAYER ──
export async function initStreamPlayer(emailFn: () => string) {
    _getEmail = emailFn;

    // Initial check
    _isLive = await checkLive();
    if (_isLive) _showFloatingPlayer();
    _updateLiveDot();

    // Poll every 30s
    _pollTimer = setInterval(async () => {
        const was = _isLive;
        _isLive = await checkLive();
        if (_isLive && !was) _showFloatingPlayer();
        if (!_isLive && was) _hideFloatingPlayer();
        _updateLiveDot();
    }, 30000);
}

function _showFloatingPlayer() {
    if (document.getElementById('streamFloat')) return;

    const wrap = document.createElement('div');
    wrap.id = 'streamFloat';
    wrap.innerHTML = `
        <div id="streamFloatInner" style="
            position:fixed; bottom:80px; right:12px; z-index:10000010;
            width:200px; border-radius:12px; overflow:hidden;
            border:1px solid rgba(197,160,89,0.3);
            box-shadow:0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.8);
            background:#000; transition:all 0.3s ease;
        ">
            <div style="position:relative;">
                <iframe src="${IFRAME_URL}?muted=true&autoplay=true&controls=false"
                    style="width:100%;aspect-ratio:16/9;border:none;display:block;"
                    allow="autoplay;encrypted-media" allowfullscreen></iframe>
                <div style="position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:4px;">
                    <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#fff;letter-spacing:2px;text-shadow:0 1px 4px rgba(0,0,0,0.8);">LIVE</span>
                </div>
                <div style="position:absolute;top:4px;right:4px;display:flex;gap:4px;">
                    <button onclick="window._streamExpand()" style="width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;">⛶</button>
                    <button onclick="window._streamMinimize()" style="width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;">−</button>
                    <button onclick="window._streamClose()" style="width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;">×</button>
                </div>
            </div>
            <div style="display:flex;border-top:1px solid rgba(197,160,89,0.15);">
                <button onclick="window._streamToggleChat()" style="flex:1;padding:6px;background:rgba(197,160,89,0.06);border:none;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.6);letter-spacing:2px;">STREAM CHAT</button>
            </div>
        </div>
        <style>
            @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        </style>
    `;
    document.body.appendChild(wrap);
}

function _hideFloatingPlayer() {
    document.getElementById('streamFloat')?.remove();
    _closeStreamChat();
}

function _streamExpand() {
    const inner = document.getElementById('streamFloatInner');
    if (!inner) return;
    const isExpanded = inner.style.width === '92vw';
    inner.style.width = isExpanded ? '200px' : '92vw';
    inner.style.maxWidth = isExpanded ? '200px' : '500px';
    inner.style.bottom = isExpanded ? '80px' : '80px';
    inner.style.right = isExpanded ? '12px' : '4vw';
}

function _streamMinimize() {
    const inner = document.getElementById('streamFloatInner');
    if (!inner) return;
    _playerMinimized = !_playerMinimized;
    if (_playerMinimized) {
        inner.style.width = '120px';
        inner.style.maxWidth = '120px';
        const iframe = inner.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) iframe.style.display = 'none';
        _closeStreamChat();
    } else {
        inner.style.width = '200px';
        inner.style.maxWidth = '200px';
        const iframe = inner.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) iframe.style.display = 'block';
    }
}

function _streamClose() {
    _hideFloatingPlayer();
    // Show a small "LIVE" button to reopen
    if (document.getElementById('streamReopenBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'streamReopenBtn';
    btn.onclick = () => { btn.remove(); _showFloatingPlayer(); };
    btn.innerHTML = `<div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;display:inline-block;margin-right:4px;vertical-align:middle;"></div><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:rgba(197,160,89,0.7);letter-spacing:2px;vertical-align:middle;">LIVE</span>`;
    btn.style.cssText = 'position:fixed;bottom:85px;right:12px;z-index:10000010;padding:6px 12px;border-radius:20px;border:1px solid rgba(197,160,89,0.3);background:rgba(0,0,0,0.85);cursor:pointer;backdrop-filter:blur(8px);';
    document.body.appendChild(btn);
}

// ── STREAM CHAT ──
function _streamToggleChat() {
    _chatOpen ? _closeStreamChat() : _openStreamChat();
}

async function _openStreamChat() {
    _chatOpen = true;
    if (document.getElementById('streamChatOverlay')) return;

    const ov = document.createElement('div');
    ov.id = 'streamChatOverlay';
    ov.style.cssText = 'position:fixed;bottom:80px;right:12px;z-index:10000011;width:320px;max-width:90vw;height:400px;max-height:60vh;border-radius:14px;border:1px solid rgba(197,160,89,0.2);background:rgba(2,5,18,0.95);backdrop-filter:blur(20px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
    ov.innerHTML = `
        <div style="padding:10px 14px;border-bottom:1px solid rgba(197,160,89,0.1);display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                <span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.7);letter-spacing:2px;">STREAM CHAT</span>
            </div>
            <button onclick="window._closeStreamChat()" style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:0.9rem;padding:0;line-height:1;">×</button>
        </div>
        <div id="streamChatMsgs" style="flex:1;overflow-y:auto;padding:8px 12px;scrollbar-width:none;display:flex;flex-direction:column;gap:4px;"></div>
        <div style="padding:8px 10px;border-top:1px solid rgba(197,160,89,0.1);display:flex;gap:6px;">
            <input id="streamChatInput" type="text" placeholder="Say something..."
                onkeydown="if(event.key==='Enter')window._sendStreamChat()"
                style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(197,160,89,0.1);border-radius:8px;padding:8px 10px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:0.8rem;outline:none;" />
            <button onclick="window._sendStreamChat()" style="padding:8px 14px;background:rgba(197,160,89,0.1);border:1px solid rgba(197,160,89,0.2);border-radius:8px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:1px;">SEND</button>
        </div>
    `;
    document.body.appendChild(ov);
    _loadStreamChat();
    _startStreamChatPoll();
}

function _closeStreamChat() {
    _chatOpen = false;
    document.getElementById('streamChatOverlay')?.remove();
    if (_chatPollTimer) { clearInterval(_chatPollTimer); _chatPollTimer = null; }
}

let _chatPollTimer: ReturnType<typeof setInterval> | null = null;
function _startStreamChatPoll() {
    if (_chatPollTimer) clearInterval(_chatPollTimer);
    _chatPollTimer = setInterval(_loadStreamChat, 5000);
}

async function _loadStreamChat() {
    const container = document.getElementById('streamChatMsgs');
    if (!container) return;
    try {
        const res = await fetch('/api/global/messages?channel=stream');
        const data = await res.json();
        const msgs = data.messages || [];
        const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
        container.innerHTML = msgs.map((m: any) => {
            const name = m.sender_name || 'SUBJECT';
            const isQueen = m.is_queen;
            const nameColor = isQueen ? '#c5a059' : 'rgba(255,255,255,0.4)';
            const msgColor = isQueen ? 'rgba(197,160,89,0.8)' : 'rgba(255,255,255,0.65)';
            return `<div style="padding:3px 0;">
                <span style="font-family:'Orbitron',sans-serif;font-size:0.38rem;color:${nameColor};letter-spacing:1px;margin-right:6px;">${name}</span>
                <span style="font-family:'Rajdhani',sans-serif;font-size:0.75rem;color:${msgColor};">${m.message}</span>
            </div>`;
        }).join('');
        if (wasAtBottom) container.scrollTop = container.scrollHeight;
    } catch {}
}

async function _sendStreamChat() {
    const input = document.getElementById('streamChatInput') as HTMLInputElement;
    if (!input || !input.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderEmail: _getEmail(), message: msg, channel: 'stream' }),
        });
        _loadStreamChat();
    } catch {}
}

// ── NAV LIVE DOT ──
function _updateLiveDot() {
    let dot = document.getElementById('navLiveDot');
    if (_isLive && !dot) {
        dot = document.createElement('div');
        dot.id = 'navLiveDot';
        dot.style.cssText = 'position:fixed;top:8px;right:8px;z-index:10000012;display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;background:rgba(0,0,0,0.7);border:1px solid rgba(239,68,68,0.3);backdrop-filter:blur(8px);cursor:pointer;';
        dot.innerHTML = `<div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div><span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#ef4444;letter-spacing:2px;">LIVE</span>`;
        dot.onclick = () => {
            const player = document.getElementById('streamFloat');
            if (!player) _showFloatingPlayer();
            document.getElementById('streamReopenBtn')?.remove();
        };
        document.body.appendChild(dot);
    }
    if (!_isLive && dot) dot.remove();
}

// ── HOME: BLURRED PREVIEW ──
export async function initStreamPreview() {
    _isLive = await checkLive();
    if (!_isLive) {
        // Poll in background for when stream starts
        _pollTimer = setInterval(async () => {
            _isLive = await checkLive();
            if (_isLive) _showBlurredPreview();
            if (!_isLive) _hideBlurredPreview();
        }, 30000);
        return;
    }
    _showBlurredPreview();
}

function _showBlurredPreview() {
    if (document.getElementById('streamBlurPreview')) return;

    const section = document.createElement('div');
    section.id = 'streamBlurPreview';
    section.style.cssText = 'position:relative;width:100%;max-width:600px;margin:0 auto 20px;border-radius:16px;overflow:hidden;border:1px solid rgba(197,160,89,0.15);';
    section.innerHTML = `
        <div style="position:relative;">
            <iframe src="${IFRAME_URL}?muted=true&autoplay=true&controls=false&loop=true"
                style="width:100%;aspect-ratio:16/9;border:none;display:block;filter:blur(20px) brightness(0.6);transform:scale(1.1);"
                allow="autoplay;encrypted-media"></iframe>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(2,5,18,0.3);">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
                    <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.6rem;color:#fff;letter-spacing:3px;text-shadow:0 2px 8px rgba(0,0,0,0.8);">QUEEN IS LIVE</span>
                </div>
                <a href="/profile" style="padding:12px 32px;background:linear-gradient(135deg,rgba(197,160,89,0.15),rgba(197,160,89,0.05));border:1px solid rgba(197,160,89,0.5);border-radius:10px;text-decoration:none;font-family:'Orbitron',sans-serif;font-size:0.55rem;color:#c5a059;letter-spacing:3px;transition:all 0.2s;box-shadow:0 0 20px rgba(197,160,89,0.1);">JOIN TO WATCH</a>
            </div>
        </div>
        <style>
            @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        </style>
    `;

    // Insert after the hero section
    const hero = document.querySelector('.grow-card') || document.querySelector('.landing-page > header');
    if (hero && hero.nextSibling) {
        hero.parentNode?.insertBefore(section, hero.nextSibling);
    } else {
        document.querySelector('.landing-page')?.appendChild(section);
    }
}

function _hideBlurredPreview() {
    document.getElementById('streamBlurPreview')?.remove();
}

// ── CLEANUP ──
export function destroyStreamPlayer() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    if (_chatPollTimer) { clearInterval(_chatPollTimer); _chatPollTimer = null; }
    _hideFloatingPlayer();
    _hideBlurredPreview();
    document.getElementById('navLiveDot')?.remove();
    document.getElementById('streamReopenBtn')?.remove();
}

// ── WINDOW BINDINGS ──
export function bindStreamPlayer() {
    (window as any)._streamExpand = _streamExpand;
    (window as any)._streamMinimize = _streamMinimize;
    (window as any)._streamClose = _streamClose;
    (window as any)._streamToggleChat = _streamToggleChat;
    (window as any)._closeStreamChat = _closeStreamChat;
    (window as any)._sendStreamChat = _sendStreamChat;
    (window as any).initStreamPlayer = initStreamPlayer;
    (window as any).initStreamPreview = initStreamPreview;
}
