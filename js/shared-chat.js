/**
 * SHARED CHAT COMPONENT
 * Centralized chat functionality for both Dashboard and User Profile
 */

// Chat state management
let chatState = {
    currentUserId: null,
    currentUserName: '',
    currentUserAvatar: '',
    messages: [],
    isConnected: false,
    lastSeen: '',
    status: 'offline'
};

// Chat configuration
const chatConfig = {
    maxMessages: 100,
    autoScroll: true,
    soundEnabled: true,
    mediaPreview: true
};

/**
 * Initialize the shared chat component
 * @param {Object} config - Chat configuration
 * @param {string} config.containerId - ID of the chat container element
 * @param {string} config.userId - Current user ID
 * @param {string} config.userName - Current user name
 * @param {string} config.userAvatar - Current user avatar URL
 */
export function initializeChat(config) {
    chatState.currentUserId = config.userId;
    chatState.currentUserName = config.userName;
    chatState.currentUserAvatar = config.userAvatar;
    
    const container = document.getElementById(config.containerId);
    if (!container) {
        console.error('Chat container not found:', config.containerId);
        return;
    }
    
    // Render the chat interface
    renderChatInterface(container);
    
    // Initialize event listeners
    initializeChatEvents(container);
    
    // Load chat history
    loadChatHistory();
    
    console.log('Shared chat initialized for:', config.userName);
}

/**
 * Render the complete chat interface
 */
function renderChatInterface(container) {
    container.innerHTML = `
        <div class="shared-chat-container">
            <!-- Chat Header -->
            <div class="shared-chat-header">
                <div class="chat-user-info">
                    <div class="chat-avatar-container">
                        <div id="chatStatusRing" class="status-ring ${chatState.isConnected ? 'online' : 'offline'}"></div>
                        <img src="${chatState.currentUserAvatar}" class="chat-avatar" alt="User Avatar">
                    </div>
                    <div class="chat-user-details">
                        <div class="chat-user-name">${chatState.currentUserName}</div>
                        <div class="chat-user-status" id="chatUserStatus">${chatState.lastSeen || 'Last seen: Unknown'}</div>
                    </div>
                </div>
                <div class="chat-controls">
                    <button class="chat-control-btn" onclick="toggleChatSettings()" title="Chat Settings">
                        <svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>
                    </button>
                </div>
            </div>

            <!-- Chat Messages Area -->
            <div class="shared-chat-messages" id="sharedChatMessages">
                <div class="chat-messages-container" id="chatMessagesContainer">
                    <!-- Messages will be rendered here -->
                </div>
            </div>

            <!-- Media Preview Overlay -->
            <div class="chat-media-overlay hidden" id="chatMediaOverlay">
                <div class="media-overlay-close" onclick="closeChatMediaPreview()">&times;</div>
                <div class="media-overlay-content" id="chatMediaContent"></div>
            </div>

            <!-- Chat Input Area -->
            <div class="shared-chat-input">
                <div class="chat-input-row">
                    <button class="chat-tribute-btn" onclick="openTributeModal()" title="Send Tribute">
                        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.69 1.64 1.83 1.64 1.22 0 1.6-.64 1.6-1.26 0-.81-.42-1.22-2.34-1.67-2.37-.59-3.54-1.7-3.54-3.41 0-1.68 1.29-2.94 3.28-3.29V4h2.66v1.93c1.61.27 2.87 1.28 3.01 3.05h-1.95c-.14-.99-.68-1.55-1.7-1.55-1.04 0-1.55.56-1.55 1.15 0 .75.46 1.2 2.37 1.65 2.51.6 3.58 1.74 3.58 3.52 0 1.82-1.46 3.09-3.28 3.34z"/></svg>
                        TRIBUTE
                    </button>
                    <input type="file" id="chatMediaInput" accept="image/*,video/*" class="hidden-input" onchange="handleChatMediaUpload(this)">
                    <button class="chat-media-btn" onclick="document.getElementById('chatMediaInput').click()" title="Upload Media">+</button>
                    <input type="text" id="chatMessageInput" class="chat-message-input" placeholder="Message..." onkeypress="handleChatKeyPress(event)">
                    <button class="chat-send-btn" onclick="sendChatMessage()" title="Send Message">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize chat event listeners
 */
function initializeChatEvents(container) {
    // Auto-scroll to bottom when new messages arrive
    const messagesContainer = container.querySelector('#chatMessagesContainer');
    if (messagesContainer) {
        messagesContainer.addEventListener('DOMNodeInserted', () => {
            if (chatConfig.autoScroll) {
                scrollToBottom();
            }
        });
    }

    // Handle window resize for responsive design
    window.addEventListener('resize', () => {
        adjustChatLayout();
    });
}

/**
 * Send a chat message
 */
function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    if (!input || !input.value.trim()) return;

    const message = {
        id: generateMessageId(),
        text: input.value.trim(),
        timestamp: new Date(),
        sender: 'user',
        type: 'text'
    };

    addMessage(message);
    input.value = '';
    
    // Play send sound if enabled
    if (chatConfig.soundEnabled) {
        playSound('send');
    }

    // Simulate response (replace with actual API call)
    setTimeout(() => {
        simulateResponse(message);
    }, 1000 + Math.random() * 2000);
}

/**
 * Add a message to the chat
 */
function addMessage(message) {
    chatState.messages.push(message);
    
    // Limit message history
    if (chatState.messages.length > chatConfig.maxMessages) {
        chatState.messages = chatState.messages.slice(-chatConfig.maxMessages);
    }
    
    renderMessage(message);
    scrollToBottom();
}

/**
 * Render a single message
 */
function renderMessage(message) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${message.sender === 'user' ? 'user-message' : 'other-message'}`;
    messageEl.innerHTML = `
        <div class="message-content">
            ${message.type === 'text' ? escapeHtml(message.text) : renderMediaMessage(message)}
        </div>
        <div class="message-timestamp">${formatTimestamp(message.timestamp)}</div>
    `;

    container.appendChild(messageEl);
}

/**
 * Handle chat key press events
 */
function handleChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

/**
 * Handle media upload
 */
function handleChatMediaUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Validate file type and size
    if (!isValidMediaFile(file)) {
        alert('Invalid file type or size. Please upload an image or video under 10MB.');
        return;
    }

    // Create message with media
    const message = {
        id: generateMessageId(),
        file: file,
        timestamp: new Date(),
        sender: 'user',
        type: file.type.startsWith('image/') ? 'image' : 'video'
    };

    addMessage(message);
    input.value = ''; // Clear the input
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Update chat status
 */
export function updateChatStatus(status, lastSeen = '') {
    chatState.status = status;
    chatState.lastSeen = lastSeen;
    chatState.isConnected = status === 'online';

    // Update UI elements
    const statusRing = document.getElementById('chatStatusRing');
    const statusText = document.getElementById('chatUserStatus');
    
    if (statusRing) {
        statusRing.className = `status-ring ${chatState.isConnected ? 'online' : 'offline'}`;
    }
    
    if (statusText) {
        statusText.textContent = chatState.isConnected ? 'Online' : `Last seen: ${lastSeen}`;
    }
}

/**
 * Load chat history
 */
function loadChatHistory() {
    // This would typically load from an API or local storage
    // For now, we'll add a welcome message
    const welcomeMessage = {
        id: generateMessageId(),
        text: 'Chat initialized. Ready to communicate.',
        timestamp: new Date(),
        sender: 'system',
        type: 'text'
    };
    
    addMessage(welcomeMessage);
}

/**
 * Utility functions
 */
function generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isValidMediaFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    return validTypes.includes(file.type) && file.size <= maxSize;
}

function renderMediaMessage(message) {
    if (message.type === 'image') {
        return `<img src="${URL.createObjectURL(message.file)}" class="chat-media-image" onclick="openChatMediaPreview(this.src)" alt="Shared image">`;
    } else if (message.type === 'video') {
        return `<video src="${URL.createObjectURL(message.file)}" class="chat-media-video" controls onclick="openChatMediaPreview(this.src)"></video>`;
    }
    return message.text || '';
}

function simulateResponse(userMessage) {
    const responses = [
        'Message received.',
        'Understood.',
        'Processing your request...',
        'Thank you for the update.',
        'Noted.'
    ];
    
    const response = {
        id: generateMessageId(),
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
        sender: 'other',
        type: 'text'
    };
    
    addMessage(response);
    
    if (chatConfig.soundEnabled) {
        playSound('receive');
    }
}

function playSound(type) {
    const sounds = {
        send: document.getElementById('msgSound'),
        receive: document.getElementById('sfx-notify')
    };
    
    if (sounds[type]) {
        sounds[type].play().catch(() => {
            // Ignore audio play errors
        });
    }
}

function adjustChatLayout() {
    // Responsive adjustments can be added here
    const container = document.querySelector('.shared-chat-container');
    if (container && window.innerWidth < 768) {
        container.classList.add('mobile-layout');
    } else if (container) {
        container.classList.remove('mobile-layout');
    }
}

// Global functions for HTML onclick handlers
window.sendChatMessage = sendChatMessage;
window.handleChatKeyPress = handleChatKeyPress;
window.handleChatMediaUpload = handleChatMediaUpload;

// Media preview functions
window.openChatMediaPreview = function(src) {
    const overlay = document.getElementById('chatMediaOverlay');
    const content = document.getElementById('chatMediaContent');
    
    if (overlay && content) {
        content.innerHTML = `<img src="${src}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        overlay.classList.remove('hidden');
    }
};

window.closeChatMediaPreview = function() {
    const overlay = document.getElementById('chatMediaOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
};

// Placeholder functions (to be implemented based on specific needs)
window.toggleChatSettings = function() {
    console.log('Chat settings toggled');
};

window.openTributeModal = function() {
    console.log('Tribute modal opened');
};

// Export the main initialization function
export default { initializeChat, updateChatStatus };
