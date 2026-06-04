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
let _notifSent = false;

// ── Drag state ──
let _dragStartX = 0;
let _dragStartY = 0;
let _dragOffsetX = 0;
let _dragOffsetY = 0;
let _dragging = false;
let _didDrag = false; // true if an actual drag occurred (prevents click-on-release)
let _playerX = -1; // -1 = use default position
let _playerY = -1;

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

// ── AUTO PUSH NOTIFICATION ──
async function _sendGoLiveNotif() {
    if (_notifSent) return;
    _notifSent = true;
    try {
        await fetch('/api/stream/status', { method: 'POST' });
    } catch {}
}

// ── PROFILE: FLOATING PLAYER ──
export async function initStreamPlayer(emailFn: () => string) {
    _getEmail = emailFn;

    // Initial check
    _isLive = await checkLive();
    if (_isLive) {
        _showFloatingPlayer();
        _sendGoLiveNotif();
    }
    _updateLiveDot();

    // Poll every 30s
    _pollTimer = setInterval(async () => {
        const was = _isLive;
        _isLive = await checkLive();
        if (_isLive && !was) {
            _showFloatingPlayer();
            _sendGoLiveNotif();
        }
        if (!_isLive && was) {
            _hideFloatingPlayer();
            _notifSent = false; // reset so next stream sends notif again
        }
        _updateLiveDot();
    }, 30000);
}

function _getPlayerPos() {
    if (_playerX < 0 || _playerY < 0) {
        return { right: '12px', bottom: '80px', left: 'auto', top: 'auto', transform: 'none' };
    }
    return { left: _playerX + 'px', top: _playerY + 'px', right: 'auto', bottom: 'auto', transform: 'none' };
}

function _applyPos(el: HTMLElement) {
    const pos = _getPlayerPos();
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.style.right = pos.right;
    el.style.bottom = pos.bottom;
    el.style.transform = pos.transform;
}

function _showFloatingPlayer() {
    if (document.getElementById('streamFloat')) return;

    const wrap = document.createElement('div');
    wrap.id = 'streamFloat';

    const pos = _getPlayerPos();
    wrap.innerHTML = `
        <div id="streamFloatInner" style="
            position:fixed; ${pos.bottom !== 'auto' ? 'bottom:' + pos.bottom : 'top:' + pos.top}; ${pos.right !== 'auto' ? 'right:' + pos.right : 'left:' + pos.left}; z-index:10000010;
            width:200px; border-radius:12px; overflow:hidden;
            border:1px solid rgba(197,160,89,0.3);
            box-shadow:0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.8);
            background:#000; touch-action:none; user-select:none;
        ">
            <div id="streamDragHandle" style="position:relative;cursor:grab;">
                <iframe src="${IFRAME_URL}?muted=true&autoplay=true&controls=false"
                    style="width:100%;aspect-ratio:16/9;border:none;display:block;pointer-events:none;"
                    allow="autoplay;encrypted-media" allowfullscreen></iframe>
                <div style="position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:4px;">
                    <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                    <span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#fff;letter-spacing:2px;text-shadow:0 1px 4px rgba(0,0,0,0.8);">LIVE</span>
                </div>
                <div style="position:absolute;top:4px;right:4px;display:flex;gap:4px;">
                    <button onclick="window._streamExpand()" style="width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;">&#x26F6;</button>
                    <button onclick="window._streamMinimize()" style="width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;">&minus;</button>
                    <button onclick="window._streamClose()" style="width:22px;height:22px;border-radius:6px;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:0.6rem;display:flex;align-items:center;justify-content:center;">&times;</button>
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
    _initDrag();
    window.addEventListener('resize', _clampToViewport);
}

// ── DRAG LOGIC ──
function _initDrag() {
    const handle = document.getElementById('streamDragHandle');
    if (!handle) return;

    const onStart = (cx: number, cy: number) => {
        const inner = document.getElementById('streamFloatInner');
        if (!inner) return;
        _dragging = true;
        _didDrag = false;
        _dragStartX = cx;
        _dragStartY = cy;
        handle.style.cursor = 'grabbing';
        const rect = inner.getBoundingClientRect();
        _dragOffsetX = cx - rect.left;
        _dragOffsetY = cy - rect.top;
        inner.style.transition = 'none';
    };

    const onMove = (cx: number, cy: number) => {
        if (!_dragging) return;
        // Only count as drag if moved more than 5px
        if (!_didDrag && (Math.abs(cx - _dragStartX) > 5 || Math.abs(cy - _dragStartY) > 5)) {
            _didDrag = true;
        }
        const inner = document.getElementById('streamFloatInner');
        if (!inner) return;
        // If expanded, collapse back to small when dragging
        if (inner.dataset.expanded === '1') {
            inner.dataset.expanded = '0';
            inner.style.width = '200px';
            inner.style.maxWidth = '';
            const iframe = inner.querySelector('iframe') as HTMLIFrameElement;
            if (iframe) iframe.style.pointerEvents = 'none';
        }
        let x = cx - _dragOffsetX;
        let y = cy - _dragOffsetY;
        // Clamp to viewport
        x = Math.max(0, Math.min(x, window.innerWidth - inner.offsetWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - inner.offsetHeight));
        _playerX = x;
        _playerY = y;
        inner.style.left = x + 'px';
        inner.style.top = y + 'px';
        inner.style.right = 'auto';
        inner.style.bottom = 'auto';
        inner.style.transform = 'none';
    };

    const onEnd = () => {
        _dragging = false;
        handle.style.cursor = 'grab';
        const inner = document.getElementById('streamFloatInner');
        if (inner) inner.style.transition = 'width 0.3s ease, max-width 0.3s ease';
        _clampToViewport();
        _repositionChat();
    };

    // Mouse
    handle.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientX, e.clientY); });
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    // Touch
    handle.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        onStart(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (!_dragging) return;
        const t = e.touches[0];
        onMove(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchend', onEnd);
}

function _clampToViewport() {
    const inner = document.getElementById('streamFloatInner');
    if (!inner || inner.dataset.expanded === '1') return;
    const rect = inner.getBoundingClientRect();
    let changed = false;
    let x = rect.left;
    let y = rect.top;
    if (rect.right > window.innerWidth) { x = window.innerWidth - rect.width; changed = true; }
    if (rect.bottom > window.innerHeight) { y = window.innerHeight - rect.height; changed = true; }
    if (x < 0) { x = 0; changed = true; }
    if (y < 0) { y = 0; changed = true; }
    if (changed) {
        _playerX = x;
        _playerY = y;
        inner.style.left = x + 'px';
        inner.style.top = y + 'px';
        inner.style.right = 'auto';
        inner.style.bottom = 'auto';
        inner.style.transform = 'none';
    }
}

function _hideFloatingPlayer() {
    document.getElementById('streamFloat')?.remove();
    _closeStreamChat();
}

function _streamExpand() {
    if (_didDrag) { _didDrag = false; return; }
    const inner = document.getElementById('streamFloatInner');
    if (!inner) return;
    const isExpanded = inner.dataset.expanded === '1';
    if (isExpanded) {
        // Collapse back to small, restore drag position or default
        inner.dataset.expanded = '0';
        inner.style.width = '200px';
        inner.style.maxWidth = '';
        inner.style.transform = 'none';
        if (_playerX >= 0 && _playerY >= 0) {
            inner.style.left = _playerX + 'px';
            inner.style.top = _playerY + 'px';
            inner.style.right = 'auto';
            inner.style.bottom = 'auto';
        } else {
            inner.style.left = 'auto';
            inner.style.top = 'auto';
            inner.style.right = '12px';
            inner.style.bottom = '80px';
        }
        const iframe = inner.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) iframe.style.pointerEvents = 'none';
        requestAnimationFrame(_clampToViewport);
    } else {
        // Expand to above footer, centered horizontally
        inner.dataset.expanded = '1';
        inner.style.width = '92vw';
        inner.style.maxWidth = '500px';
        inner.style.left = '50%';
        inner.style.top = 'auto';
        inner.style.right = 'auto';
        inner.style.bottom = '70px';
        inner.style.transform = 'translateX(-50%)';
        const iframe = inner.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) iframe.style.pointerEvents = 'auto';
    }
    _repositionChat();
}

function _streamMinimize() {
    if (_didDrag) { _didDrag = false; return; }
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
        inner.style.maxWidth = '';
        const iframe = inner.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) iframe.style.display = 'block';
    }
}

function _streamClose() {
    if (_didDrag) { _didDrag = false; return; }
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

function _repositionChat() {
    const ov = document.getElementById('streamChatOverlay');
    const inner = document.getElementById('streamFloatInner');
    if (!ov || !inner) return;
    const rect = inner.getBoundingClientRect();
    // Match player width
    ov.style.width = rect.width + 'px';
    ov.style.maxWidth = '90vw';
    ov.style.left = rect.left + 'px';
    ov.style.top = (rect.bottom + 6) + 'px';
    ov.style.right = 'auto';
    ov.style.bottom = 'auto';
    // If chat would go off screen bottom, position above instead
    const chatH = ov.offsetHeight;
    if (rect.bottom + 6 + chatH > window.innerHeight) {
        ov.style.top = Math.max(0, rect.top - chatH - 6) + 'px';
    }
}

async function _openStreamChat() {
    _chatOpen = true;
    if (document.getElementById('streamChatOverlay')) return;

    // Move player to top when chat opens
    const inner = document.getElementById('streamFloatInner');
    if (inner && inner.dataset.expanded === '1') {
        inner.style.top = '10px';
        inner.style.bottom = 'auto';
    }

    const ov = document.createElement('div');
    ov.id = 'streamChatOverlay';
    ov.style.cssText = 'position:fixed;z-index:10000011;width:200px;max-width:90vw;height:350px;max-height:50vh;border-radius:14px;border:1px solid rgba(197,160,89,0.2);background:rgba(2,5,18,0.95);backdrop-filter:blur(20px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
    ov.innerHTML = `
        <div style="padding:10px 14px;border-bottom:1px solid rgba(197,160,89,0.1);display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                <span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.7);letter-spacing:2px;">STREAM CHAT</span>
            </div>
            <button onclick="window._closeStreamChat()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.6);cursor:pointer;font-size:1.1rem;width:26px;height:26px;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;">&times;</button>
        </div>
        <div id="streamChatMsgs" style="flex:1;overflow-y:auto;padding:8px 12px;scrollbar-width:none;display:flex;flex-direction:column;gap:4px;"></div>
        <div style="padding:8px 10px;border-top:1px solid rgba(197,160,89,0.1);display:flex;gap:6px;">
            <input id="streamChatInput" type="text" placeholder="Say something..."
                onkeydown="if(event.key==='Enter')window._sendStreamChat()"
                style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(197,160,89,0.1);border-radius:8px;padding:8px 10px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:16px;outline:none;" />
            <button onclick="window._sendStreamChat()" style="padding:8px 14px;background:rgba(197,160,89,0.1);border:1px solid rgba(197,160,89,0.2);border-radius:8px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:1px;">SEND</button>
        </div>
    `;
    document.body.appendChild(ov);
    _repositionChat();
    _loadStreamChat();
    _startStreamChatPoll();
}

function _closeStreamChat() {
    _chatOpen = false;
    document.getElementById('streamChatOverlay')?.remove();
    if (_chatPollTimer) { clearInterval(_chatPollTimer); _chatPollTimer = null; }
    // Move player back above footer
    const inner = document.getElementById('streamFloatInner');
    if (inner && inner.dataset.expanded === '1') {
        inner.style.top = 'auto';
        inner.style.bottom = '70px';
    }
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
    window.removeEventListener('resize', _clampToViewport);
    _hideFloatingPlayer();
    _hideBlurredPreview();
    document.getElementById('navLiveDot')?.remove();
    document.getElementById('streamReopenBtn')?.remove();
}

// ── DASHBOARD: STREAM CHAT (Queen only — no video player, just chat) ──
let _dashStreamChatOpen = false;
let _dashStreamPollTimer: ReturnType<typeof setInterval> | null = null;
let _dashStreamLivePollTimer: ReturnType<typeof setInterval> | null = null;
let _dashGetEmail: () => string = () => '';

export async function initDashStreamChat(emailFn: () => string) {
    _dashGetEmail = emailFn;
    const live = await checkLive();
    if (live) _showDashStreamBtn();
    _dashStreamLivePollTimer = setInterval(async () => {
        const nowLive = await checkLive();
        if (nowLive && !document.getElementById('dashStreamBtn')) _showDashStreamBtn();
        if (!nowLive) {
            document.getElementById('dashStreamBtn')?.remove();
            _closeDashStreamChat();
        }
    }, 30000);
}

function _showDashStreamBtn() {
    if (document.getElementById('dashStreamBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'dashStreamBtn';
    btn.onclick = () => _dashStreamChatOpen ? _closeDashStreamChat() : _openDashStreamChat();
    btn.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;display:inline-block;margin-right:6px;vertical-align:middle;"></div><span style="font-family:'Orbitron',sans-serif;font-size:0.45rem;color:#c5a059;letter-spacing:2px;vertical-align:middle;">STREAM CHAT</span>`;
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000010;padding:10px 18px;border-radius:25px;border:1px solid rgba(197,160,89,0.4);background:rgba(0,0,0,0.9);cursor:pointer;backdrop-filter:blur(12px);box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    const style = document.createElement('style');
    style.textContent = `@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }`;
    btn.appendChild(style);
    document.body.appendChild(btn);
}

function _openDashStreamChat() {
    _dashStreamChatOpen = true;
    if (document.getElementById('dashStreamChatPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'dashStreamChatPanel';
    panel.style.cssText = 'position:fixed;bottom:70px;right:20px;z-index:10000011;width:360px;max-width:90vw;height:420px;max-height:60vh;border-radius:14px;border:1px solid rgba(197,160,89,0.25);background:rgba(2,5,18,0.97);backdrop-filter:blur(20px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.7);';
    panel.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid rgba(197,160,89,0.12);display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:7px;height:7px;border-radius:50%;background:#ef4444;animation:livePulse 1.5s ease-in-out infinite;"></div>
                <span style="font-family:'Orbitron',sans-serif;font-size:0.5rem;color:rgba(197,160,89,0.8);letter-spacing:2px;">STREAM CHAT</span>
            </div>
            <button onclick="window._closeDashStreamChat()" style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:1rem;padding:0;line-height:1;">&times;</button>
        </div>
        <div id="dashStreamMsgs" style="flex:1;overflow-y:auto;padding:10px 14px;scrollbar-width:none;display:flex;flex-direction:column;gap:4px;"></div>
        <div style="padding:10px 12px;border-top:1px solid rgba(197,160,89,0.12);display:flex;gap:8px;">
            <input id="dashStreamInput" type="text" placeholder="Message stream chat..."
                onkeydown="if(event.key==='Enter')window._sendDashStreamMsg()"
                style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(197,160,89,0.12);border-radius:8px;padding:10px 12px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:16px;outline:none;" />
            <button onclick="window._sendDashStreamMsg()" style="padding:10px 16px;background:rgba(197,160,89,0.12);border:1px solid rgba(197,160,89,0.25);border-radius:8px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:0.4rem;color:#c5a059;letter-spacing:1px;">SEND</button>
        </div>
    `;
    document.body.appendChild(panel);
    _loadDashStreamMsgs();
    _dashStreamPollTimer = setInterval(_loadDashStreamMsgs, 4000);
}

function _closeDashStreamChat() {
    _dashStreamChatOpen = false;
    document.getElementById('dashStreamChatPanel')?.remove();
    if (_dashStreamPollTimer) { clearInterval(_dashStreamPollTimer); _dashStreamPollTimer = null; }
}

async function _loadDashStreamMsgs() {
    const container = document.getElementById('dashStreamMsgs');
    if (!container) return;
    try {
        const res = await fetch('/api/global/messages?channel=stream');
        const data = await res.json();
        const msgs = data.messages || [];
        const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
        container.innerHTML = msgs.map((m: any) => {
            const name = m.sender_name || 'SUBJECT';
            const isQueen = m.is_queen;
            const isSystem = m.sender_email === 'system';
            if (isSystem) return '';
            const nameColor = isQueen ? '#c5a059' : 'rgba(255,255,255,0.4)';
            const msgColor = isQueen ? 'rgba(197,160,89,0.8)' : 'rgba(255,255,255,0.65)';
            return `<div style="padding:3px 0;">
                <span style="font-family:'Orbitron',sans-serif;font-size:0.4rem;color:${nameColor};letter-spacing:1px;margin-right:6px;">${name}</span>
                <span style="font-family:'Rajdhani',sans-serif;font-size:0.8rem;color:${msgColor};">${m.message}</span>
            </div>`;
        }).join('');
        if (wasAtBottom) container.scrollTop = container.scrollHeight;
    } catch {}
}

async function _sendDashStreamMsg() {
    const input = document.getElementById('dashStreamInput') as HTMLInputElement;
    if (!input || !input.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    const email = _dashGetEmail();
    if (!email) return;
    try {
        await fetch('/api/global/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderEmail: email, message: msg, channel: 'stream' }),
        });
        _loadDashStreamMsgs();
    } catch {}
}

export function destroyDashStreamChat() {
    _closeDashStreamChat();
    if (_dashStreamLivePollTimer) { clearInterval(_dashStreamLivePollTimer); _dashStreamLivePollTimer = null; }
    document.getElementById('dashStreamBtn')?.remove();
}

// ── WINDOW BINDINGS ──
export function bindStreamPlayer() {
    (window as any)._streamExpand = _streamExpand;
    (window as any)._streamMinimize = _streamMinimize;
    (window as any)._streamClose = _streamClose;
    (window as any)._streamToggleChat = _streamToggleChat;
    (window as any)._closeStreamChat = _closeStreamChat;
    (window as any)._sendStreamChat = _sendStreamChat;
    (window as any)._closeDashStreamChat = _closeDashStreamChat;
    (window as any)._sendDashStreamMsg = _sendDashStreamMsg;
    (window as any).initStreamPlayer = initStreamPlayer;
    (window as any).initStreamPreview = initStreamPreview;
    (window as any).initDashStreamChat = initDashStreamChat;
}
