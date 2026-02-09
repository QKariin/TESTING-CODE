// uploads.js - ROBUST & CRASH-PROOF
import { CONFIG } from './config.js';
import { userProfile, currentTask } from './state.js';
import { finishTask } from './tasks.js';
import { uploadToBytescale } from './mediaBytescale.js';

export async function handleEvidenceUpload(input, category = "Task") {
    // 1. Define UI Elements globally within function scope so 'catch' can see them
    const statusEl = document.getElementById("uploadStatus"); // Desktop
    const mobBtn = document.getElementById("mobBtnUpload");   // Mobile

    try {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            let cat = category;
            
            // 2. Set Text Description & UI Loading State
            if (category === "Task") {
                cat = currentTask ? currentTask.text : "Task";
                if (statusEl) statusEl.innerText = "Uploading...";
                if (mobBtn) mobBtn.innerText = "SENDING...";
            }
            else if (category === "Routine") {
                const rName = userProfile.routine || "Standard Protocol";
                cat = `Daily Routine: ${rName}`;
                if (mobBtn) mobBtn.innerText = "UPLOADING...";
            }
            
            // 3. Upload to Cloud
            const folder = (userProfile.name || "slave").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
            const finalUrl = await uploadToBytescale("evidence", file, folder);
            
            // 4. Handle Failure
            if (finalUrl === "failed") {
                if (category === "Task" && statusEl) statusEl.innerText = "Upload failed.";
                if (mobBtn) mobBtn.innerText = "FAILED";
                return;
            }
            
            // 5. Send to Backend (The "Write")
            window.parent.postMessage({
                type: "uploadEvidence",
                task: cat,          // The Text (e.g. "Daily Routine: Kneel")
                fileUrl: finalUrl,  // The Image Link
                mimeType: file.type,
                category: category  // THE CRITICAL TAG ("Routine" or "Task")
            }, "*");

            // 6. Cleanup Logic
            if (category === "Task") {
                finishTask(true);
                if (statusEl) statusEl.innerText = "Upload complete!";
            }
            
            // Note: Mobile button reset is handled by main.js logic to keep it synced
        }
    } catch (err) {
        // 7. Safe Error Handling
        console.error("Upload error:", err);
        if (category === "Task" && statusEl) statusEl.innerText = "Error.";
        if (mobBtn) mobBtn.innerText = "ERROR";
    }
}

export async function handleProfileUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        try {
            const folder = (userProfile.name || "slave").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
            const finalUrl = await uploadToBytescale("profile", file, folder);

            if (finalUrl === "failed") return;

            window.parent.postMessage({ type: "UPDATE_PROFILE_PIC", url: finalUrl }, "*");
        } catch (err) { console.error("Profile upload error:", err); }
    }
}

export async function handleAdminUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const btn = document.querySelector('.btn-plus') || document.getElementById('btnMediaPlus'); // Check both desktop/mobile buttons
        const oldText = btn ? btn.innerText : "+";
        
        try {
            if (btn) btn.innerText = "⏳";

            const folder = (userProfile.name || "slave").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
            let finalUrl = await uploadToBytescale("chat", file, folder);

            if (finalUrl === "failed") { 
                if (btn) btn.innerText = oldText;
                return; 
            }

            window.parent.postMessage({ type: "SEND_CHAT_TO_BACKEND", text: finalUrl }, "*");
            
            // Clear input so same file can be selected again
            input.value = ""; 
            if (btn) btn.innerText = oldText;
            
        } catch (err) { 
            console.error("Admin upload error", err); 
            if (btn) btn.innerText = oldText;
        }
    }
}
