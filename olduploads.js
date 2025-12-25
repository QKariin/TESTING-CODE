// File upload handling - FULL LOGIC RESTORED
import { CONFIG } from './config.js';
import { userProfile, currentTask } from './state.js'; // FIXED: Added currentTask import
import { finishTask } from './tasks.js';

export async function handleEvidenceUpload(input) {
    try {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const fd = new FormData();
            fd.append("file", file);
            
            const statusEl = document.getElementById("uploadStatus");
            if (statusEl) statusEl.innerText = "Uploading...";
            
            const folder = userProfile.name.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
            const res = await fetch(`https://api.bytescale.com/v2/accounts/${CONFIG.ACCOUNT_ID}/uploads/form_data?path=/evidence/${folder}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${CONFIG.API_KEY}`
                },
                body: fd
            });
            
            if (!res.ok) {
                if (statusEl) statusEl.innerText = "Upload failed.";
                return;
            }
            
            const d = await res.json();
            if (d.files && d.files[0] && d.files[0].fileUrl) {
                // FIXED: Now correctly reads currentTask.text
                window.parent.postMessage({
                    type: "uploadEvidence",
                    task: currentTask ? currentTask.text : "Task",
                    fileUrl: d.files[0].fileUrl,
                    mimeType: file.type
                }, "*");
                finishTask(true);
                if (statusEl) statusEl.innerText = "Upload complete!";
            } else {
                if (statusEl) statusEl.innerText = "Upload failed (unexpected response).";
            }
        }
    } catch (err) {
        const statusEl = document.getElementById("uploadStatus");
        if (statusEl) statusEl.innerText = "Upload failed (error).";
        console.error("Upload error:", err);
    }
}

export async function handleProfileUpload(input) {
    if (input.files && input.files[0]) {
        const fd = new FormData();
        fd.append('file', input.files[0]);
        fd.append('upload_preset', CONFIG.UPLOAD_PRESET);
        
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: fd
            });
            
            const d = await res.json();
            if (d.secure_url) {
                window.parent.postMessage({
                    type: "UPDATE_PROFILE_PIC",
                    url: d.secure_url
                }, "*");
            }
        } catch (err) {
            console.error("Profile upload error:", err);
        }
    }
}

// RESTORED: Full high-detail Admin Upload logic with Hourglass and Video Fix
export async function handleAdminUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const isVideo = file.type.startsWith('video') || file.name.match(/\.(mp4|mov|webm)$/i);
        const fd = new FormData();
        fd.append("file", file);

        try {
            // Visual feedback: Hourglass on the plus button
            const btn = document.querySelector('.btn-plus');
            const oldText = btn ? btn.innerText : "+";
            if (btn) btn.innerText = "⏳";

            const res = await fetch(
                `https://api.bytescale.com/v2/accounts/${CONFIG.ACCOUNT_ID}/uploads/form_data?path=/admin`,
                { 
                    method: "POST", 
                    headers: { "Authorization": `Bearer ${CONFIG.API_KEY}` }, 
                    body: fd 
                }
            );

            if (!res.ok) { 
                console.error("Upload failed");
                if (btn) btn.innerText = oldText;
                return; 
            }
            const d = await res.json();

            if (d.files && d.files[0] && d.files[0].fileUrl) {
                let finalUrl = d.files[0].fileUrl;
                
                // RESTORED VIDEO FIX: Ensures videos play correctly in the chat bubbles
                if (isVideo) {
                    finalUrl = finalUrl + "#.mp4"; 
                }

                window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: finalUrl }, "*");
            }
            if (btn) btn.innerText = oldText;
        } catch (err) { 
            console.error("Admin upload error", err); 
        }
    }
}
