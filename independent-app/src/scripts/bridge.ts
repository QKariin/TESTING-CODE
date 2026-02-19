// src/scripts/bridge.ts
// THE SHARED ECOSYSTEM BRAIN - Converted to TypeScript

// Use a conditional check for BroadcastChannel which might not be available in all SSR contexts
let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
    channel = new BroadcastChannel('ecosystem_link');
}

export const Bridge = {
    // 1. SAVE to the Shared Brain
    saveState: (data: any) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('ecosystem_state', JSON.stringify(data));
        // Tell everyone else to sync
        channel?.postMessage({ type: "STATE_SYNC", state: data });
    },

    // 2. READ from the Shared Brain
    getState: () => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem('ecosystem_state');
        return saved ? JSON.parse(saved) : null;
    },

    // 3. SHOUT commands (used for ENFORCE, SEND, SKIP)
    send: (type: string, data?: any) => {
        channel?.postMessage({ type, ...data });
        console.log("OUTGOING COMMAND:", type, data);
    },

    // 4. LISTEN for changes
    listen: (callback: (data: any) => void) => {
        if (channel) {
            channel.onmessage = (e) => {
                console.log("INCOMING COMMAND:", e.data.type, e.data);
                callback(e.data);
            };
        }
    }
};
