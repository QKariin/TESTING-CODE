
const channel = new BroadcastChannel('ecosystem_link');

export const Bridge = {
    // Send a command to the other side
    send: (type, data = {}) => {
        channel.postMessage({ type, ...data });
        console.log("OUTGOING:", type, data);
    },
    
    // Listen for commands from the other side
    listen: (callback) => {
        channel.onmessage = (event) => {
            console.log("INCOMING:", event.data.type, event.data);
            callback(event.data);
        };
    }
};

// Make it global so we can use it in HTML if needed
window.EcosystemBridge = Bridge;
