// src/scripts/dashboard-navigation.ts
// Dashboard Navigation - Converted to TypeScript

import { cooldownInterval, setCurrId, setCooldownInterval } from './dashboard-state';
import { renderSidebar } from './dashboard-sidebar';

export function showHome() {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        setCooldownInterval(null);
    }

    setCurrId(null);
    const vUser = document.getElementById('viewUser');
    if (vUser) vUser.classList.remove('active');

    const vProfile = document.getElementById('viewProfile');
    if (vProfile) vProfile.style.display = 'none';

    const vHome = document.getElementById('viewHome');
    if (vHome) vHome.style.display = 'grid';

    renderSidebar();
}

export function showProfile() {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        setCooldownInterval(null);
    }

    setCurrId(null);
    const vUser = document.getElementById('viewUser');
    if (vUser) vUser.classList.remove('active');

    const vHome = document.getElementById('viewHome');
    if (vHome) vHome.style.display = 'none';

    const vProfile = document.getElementById('viewProfile');
    if (vProfile) vProfile.style.display = 'flex';

    // Profile rendering logic would go here
    console.log("Profile view requested");
}

export function switchProfileTab(tab: 'media' | 'text') {
    const media = document.getElementById('profileMediaGrid');
    const text = document.getElementById('profileTextGrid');
    const tabs = document.querySelectorAll('.qp-tab');

    if (media && text) {
        if (tab === 'media') {
            media.classList.remove('d-none');
            text.classList.add('d-none');
            tabs[0].classList.add('active');
            tabs[1].classList.remove('active');
        } else {
            media.classList.add('d-none');
            text.classList.remove('d-none');
            tabs[0].classList.remove('active');
            tabs[1].classList.add('active');
        }
    }
}

export function openProfileUpload(isStory: boolean = false) {
    console.log("Profile upload requested, isStory:", isStory);
}

// Global Exports
if (typeof window !== 'undefined') {
    (window as any).showHome = showHome;
    (window as any).showProfile = showProfile;
    (window as any).switchProfileTab = switchProfileTab;
    (window as any).openProfileUpload = openProfileUpload;
}
