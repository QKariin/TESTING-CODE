// js/bridge.js
const channel = new BroadcastChannel('ecosystem_link');

export const Bridge = {
    // 1. SAVE to the Shared Brain
    saveState: (data) => {
        localStorage.setItem('ecosystem_state', JSON.stringify(data));
        // Tell everyone else to sync
        channel.postMessage({ type: "STATE_SYNC", state: data });
    },

    // 2. READ from the Shared Brain
    getState: () => {
        const saved = localStorage.getItem('ecosystem_state');
        return saved ? JSON.parse(saved) : null;
    },

    // 3. SHOUT commands
    send: (type, data) => channel.postMessage({ type, ...data }),

    // 4. LISTEN for changes
    listen: (callback) => {
        channel.onmessage = (e) => callback(e.data);
    }
};
