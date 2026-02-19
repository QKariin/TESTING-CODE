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

// Global Exports
if (typeof window !== 'undefined') {
    (window as any).showHome = showHome;
    (window as any).showProfile = showProfile;
}
