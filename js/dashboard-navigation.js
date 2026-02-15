// Dashboard Navigation
// View switching and navigation functions

import { currId, cooldownInterval, setCurrId, setCooldownInterval } from './dashboard-state.js';
import { renderSidebar } from './dashboard-sidebar.js';

export function showHome() {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        setCooldownInterval(null);
    }
    
    setCurrId(null);
    document.getElementById('viewUser').classList.remove('active');
    document.getElementById('viewProfile').style.display = 'none';
    document.getElementById('viewHome').style.display = 'grid';
    
    renderSidebar();
}

export function showProfile() {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        setCooldownInterval(null);
    }
    
    setCurrId(null);
    document.getElementById('viewUser').classList.remove('active');
    document.getElementById('viewHome').style.display = 'none';
    document.getElementById('viewProfile').style.display = 'flex';
    
    import('./dashboard-profile.js').then(({ renderProfile }) => {
        renderProfile();
    });
}

export function openApplicationView() {
    const u = users.find(x => x.memberId === currId);
    if (u && u.application) {
        import('./dashboard-modals.js').then(({ openModal }) => {
            openModal(null, null, u.application, 'text', 'APPLICATION REVIEW', true, 'APPLICATION');
        });
    }
}

// Make functions available globally
window.showHome = showHome;
window.showProfile = showProfile;
window.openApplicationView = openApplicationView;
