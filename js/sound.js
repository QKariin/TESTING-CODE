// -----------------------------
// 1. GLOBAL AUDIO CONTEXT
// -----------------------------
let audioCtx;
let audioBuffers = {}; // store decoded sounds

async function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// -----------------------------
// 2. LOAD & DECODE SOUNDS
// -----------------------------
async function loadSound(id, url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    audioBuffers[id] = await audioCtx.decodeAudioData(arrayBuffer);
}

// -----------------------------
// 3. PLAY SOUND
// -----------------------------
export function triggerSounds(id) {
    if (!audioCtx || !audioBuffers[id]) return;

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffers[id];
    src.connect(audioCtx.destination);
    src.start(0);
}

// -----------------------------
// 4. UNLOCK AUDIO ON FIRST CLICK
// -----------------------------
export async function unlockAudio() {
    await initAudioContext();

    // Preload your sounds here
    await loadSound("ding", "/audio/2019-preview1.mp3");
    await loadSound("message", "/audio/message.mp3");

    console.log("Audio unlocked and sounds preloaded");
}

// Attach unlock listeners
window.addEventListener("click", unlockAudio, { once: true });
window.addEventListener("touchstart", unlockAudio, { once: true });

// -----------------------------
// 5. KEEP AUDIO CONTEXT ALIVE
// -----------------------------
function keepAlive() {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0; // silent
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

setInterval(keepAlive, 5000);